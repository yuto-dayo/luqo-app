import { Router, Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { getEventsByUserMonth, dbClient, getFixedScore, getBanditState, saveBanditState } from "../lib/dbClient";
import { generateLuqoScore } from "../lib/openaiClient";
import type { EventRow } from "../models/events";
import { LuqoBanditBrain } from "../lib/banditBrain";

const router = Router();

/**
 * POST /api/v1/luqo/score-month
 * body: { month: "2025-11", logText?: string, focus?: string, finalize?: boolean }
 */
router.post(
  "/score-month",
  async (req: Request, res: Response, next: NextFunction) => {
    const r = req as AuthedRequest;

    try {
      if (!r.userId) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const { month, logText, focus, finalize, force } = req.body ?? {};
      if (!month) {
        return res.status(400).json({ ok: false, error: "Month is required" });
      }

      const userId = r.userId;

      // 1. 既に確定済みのスコアがあるか確認
      const fixedData = await getFixedScore(userId, month, r.supabase);

      // 確定済みデータがあり、force指定がない場合は即返却（リロード時の揺れ防止）
      if (fixedData && !force) {
        console.log(`[LUQO] Returning fixed score for ${userId} (${month})`);
        return res.json({
          ok: true,
          score: fixedData,
          isFixed: true, // フロント判定用
        });
      }

      // 2. 確定データがない、または「今すぐ確定したい」場合は計算へ進む
      console.log(`[LUQO] Generating score for ${userId} (${month})...`);

      let logs: Array<{ text: string }> = [];

      if (typeof logText === "string" && logText.trim().length > 0) {
        logs = [{ text: logText.trim() }];
      } else {
        const events = await getEventsByUserMonth(userId, month, r.supabase);

        if (!events || events.length === 0) {
          // ログゼロでもスコア0として返すべきだが、一旦エラーハンドリング
          // return res.status(404).json(...) // ここは運用に合わせて調整
        }

        logs = events.map((event: EventRow) => ({
          text: event.text ?? "",
        }));
      }

      // OpenAIで計算
      const baseScore = await generateLuqoScore(logs, focus);

      // ★追加: Just Culture 調整ロジック
      // 今月の q_score_adjustment イベントを取得して合算する
      // 日付範囲の定義
      const [y, m] = month.split("-").map(Number);
      const startDate = `${month}-01T00:00:00.000Z`;
      const nextDate = new Date(Date.UTC(y, m, 1));
      const endDate = nextDate.toISOString();

      const { data: adjustments } = await r.supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("kind", "q_score_adjustment")
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      let totalDelta = 0;
      const badges: string[] = [];
      const hiddenReasons: string[] = [];

      if (adjustments) {
        for (const adj of adjustments) {
          const payload = adj.payload as { delta: number; reason: string; badge?: string; visibility?: string };

          // 隠蔽フラグがある場合（ペナルティなど）、即時反映するか月末まで隠すかの制御が可能
          // ここでは「計算には含めるが、理由は隠す」または「ドラフト段階では含めない」などの制御ができる
          // 今回は「Just Culture」として、ドラフト段階から反映し、行動変容を促す設定にします

          totalDelta += (payload.delta || 0);

          // バッジがあれば収集 (Guardian Bonusなど)
          if (payload.badge) {
            badges.push(payload.badge);
          }

          // 理由の収集 (ペナルティの場合はオブラートに包む処理が必要かも)
          if (payload.reason) {
            hiddenReasons.push(payload.reason);
          }
        }
      }

      // スコアの合算と整形
      const finalQ = Math.max(0, Math.min(100, baseScore.Q + totalDelta));

      // UI用メッセージの上書き（ボーナス等がある場合）
      let ui = { ...baseScore.ui };
      if (totalDelta > 0) {
        ui.headline = `貢献ボーナス獲得 (+${totalDelta}pt)`;
        ui.icon = "guardian"; // Guardian
        ui.color = "#059669"; // Emerald
      } else if (totalDelta < 0) {
        ui.headline = "行動指針の再確認が必要です";
        ui.icon = "alert";
        ui.color = "#b91c1c"; // Red
      }

      const finalScore = {
        ...baseScore,
        Q: finalQ,
        total: Math.round(baseScore.LU * 0.3 + finalQ * 0.5 + baseScore.O * 0.2), // 重み付け再計算
        // フロントエンドに渡す拡張メタデータ
        adjustments: {
          delta: totalDelta,
          badges: badges,
          reasons: hiddenReasons
        },
        ui
      };

      // 3. 確定フラグ（デフォルト true）なら保存
      const shouldFinalize = finalize !== false;
      if (shouldFinalize) {
        // A. スコア保存
        try {
          await dbClient.appendEvent({
            userId,
            kind: "luqo_score_fixed",
            text: `【評価確定】${month} LUQO Score (Adj: ${totalDelta})`,
            createdAt: new Date().toISOString(), // その時点の日時
            // payloadにスコア詳細と対象月を入れる
            ...finalScore, // LU, Q, O, total, reasoning
            month,
          }, r.supabase);
        } catch (e: any) {
          // 既に確定済みだった場合などの競合は黙認して確定扱いで返す
          if (e?.message?.includes("unique constraint") || e?.code === "23505") {
            console.warn("Race condition prevented: Score already finalized.");
            return res.json({ ok: true, score: finalScore, isFixed: true });
          }
          throw e;
        }

        // B. ★AI学習 (Feedback Loop Implementation)
        try {
          // 1. その月の最新の提案ログを取得
          // (本来はmonthで厳密にフィルタすべきだが、簡易的に直近1件を取得して月を照合する)
          const { data: suggestions } = await r.supabase
            .from("events")
            .select("payload")
            .eq("user_id", userId)
            .eq("kind", "bandit_suggestion_log")
            .order("created_at", { ascending: false })
            .limit(5); // 直近5件から該当月を探す

          // 該当月の提案を探す
          const targetSuggestion = suggestions?.find((s: any) => s.payload?.month === month);

          if (targetSuggestion) {
            const { armId, targetDimension } = targetSuggestion.payload;

            // 2. 報酬計算 (Reward Calculation)
            // ターゲット次元のスコア (0-100) を (0.0-1.0) に正規化
            // 例: Qを提案され、Qが80点なら報酬0.8
            const dim = targetDimension as "LU" | "Q" | "O";
            const rawScore = finalScore[dim] || 0;
            const reward = Math.max(0, Math.min(1, rawScore / 100));

            // 3. 状態更新 (Bayesian Update)
            const brain = new LuqoBanditBrain();
            const currentState = await getBanditState(userId, r.supabase);
            const newState = brain.updateState(currentState, armId, reward);

            await saveBanditState(userId, newState, r.supabase);

            console.log(`[Bandit] Learned: User=${userId}, Arm=${armId}, Reward=${reward} (Score=${rawScore})`);
          } else {
            console.log(`[Bandit] No suggestion found for month ${month}, skipping learning.`);
          }
        } catch (e) {
          console.warn("[Bandit] Learning process failed (non-critical):", e);
        }

        console.log(`[LUQO] Score finalized for ${userId} (${month})`);

        return res.json({
          ok: true,
          score: finalScore,
          isFixed: true,
        });
      }

      // ドラフト（未確定）として返す
      return res.status(200).json({
        ok: true,
        score: finalScore,
        isFixed: false
      });

    } catch (err) {
      console.error("[LUQO] score error:", err);
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  },
);

export { router as luqoScoreRouter };
