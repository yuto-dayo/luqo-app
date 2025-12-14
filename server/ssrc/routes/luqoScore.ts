import { Router, Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { getEventsByUserMonth, dbClient, getFixedScore, getBanditState, saveBanditState } from "../lib/dbClient";
import { generateLuqoScore } from "../lib/openaiClient";
import type { EventRow } from "../models/events";
import { LuqoBanditBrain } from "../lib/banditBrain";
import type { BanditArmId } from "../types/banditState";

const router = Router();
const brain = new LuqoBanditBrain();

/**
 * POST /api/v1/luqo/score-month
 * body: { month?: "2025-11", startDate?: string, endDate?: string, logText?: string, focus?: string, finalize?: boolean }
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
      let { startDate, endDate } = req.body ?? {};

      // monthがあればstartDate/endDateを自動計算（後方互換）
      if (month) {
        const [y, m] = month.split("-").map(Number);
        startDate = `${month}-01T00:00:00.000Z`;
        const nextDate = new Date(Date.UTC(y, m, 1)); // 翌月1日
        endDate = nextDate.toISOString();
      }

      if (!startDate || !endDate) {
        return res.status(400).json({ ok: false, error: "startDate and endDate (or month) are required" });
      }

      const userId = r.userId;

      // 1. 既に確定済みのスコアがあるか確認
      const fixedData = await getFixedScore(userId, startDate.slice(0, 10), r.supabase);

      // 確定済みデータがあり、force指定がない場合は即返却
      if (fixedData && !force) {
        console.log(`[LUQO] Returning fixed score for ${userId} (${startDate})`);
        return res.json({
          ok: true,
          score: fixedData,
          isFixed: true,
        });
      }

      console.log(`[LUQO] Generating score for ${userId} (${startDate} ~ ${endDate})...`);

      // ★ Context Injection: ユーザーの活動コンテキストを取得
      const { getUserContext } = await import("../services/contextService");
      const userContext = await getUserContext(userId, startDate, endDate);

      let logs: Array<{ text: string }> = [];

      if (typeof logText === "string" && logText.trim().length > 0) {
        logs = [{ text: logText.trim() }];
      } else {
        const events = await dbClient.getEventsByUserPeriod(userId, startDate, endDate, r.supabase);
        // ログのみ抽出 (contextServiceで既に集計しているが、テキストが必要なので再抽出)
        logs = events
          .filter(e => e.kind === "log" || e.kind === "daily_report")
          .map((event: EventRow) => ({ text: event.text ?? "" }));
      }

      // OpenAIで計算 (Contextも渡す)
      const baseScore = await generateLuqoScore(logs, focus, userContext);

      // ★追加: Just Culture 調整ロジック
      // 今月の q_score_adjustment イベントを取得して合算する
      // startDate ～ endDate の範囲で取得
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
          totalDelta += (payload.delta || 0);
          if (payload.badge) badges.push(payload.badge);
          if (payload.reason) hiddenReasons.push(payload.reason);
        }
      }

      // スコアの合算と整形
      const finalQ = Math.max(0, Math.min(100, baseScore.Q + totalDelta));

      // UI用メッセージの上書き
      let ui = { ...baseScore.ui };
      if (totalDelta > 0) {
        ui.headline = `貢献ボーナス獲得 (+${totalDelta}pt)`;
        ui.icon = "guardian";
        ui.color = "#059669";
      } else if (totalDelta < 0) {
        ui.headline = "行動指針の再確認が必要です";
        ui.icon = "alert";
        ui.color = "#b91c1c";
      }

      const finalScore = {
        ...baseScore,
        Q: finalQ,
        total: Math.round(baseScore.LU * 0.3 + finalQ * 0.5 + baseScore.O * 0.2),
        adjustments: {
          delta: totalDelta,
          badges: badges,
          reasons: hiddenReasons
        },
        ui,
        // Context情報をレスポンスにも含める（デバッグ・UI表示用）
        context: userContext
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
            month: month || startDate.slice(0, 7), // month互換のため、ない場合は開始月を入れる
            startDate,
            endDate,
          }, r.supabase);
        } catch (e: any) {
          // 既に確定済みだった場合などの競合は黙認して確定扱いで返す
          if (e?.message?.includes("unique constraint") || e?.code === "23505") {
            console.warn("Race condition prevented: Score already finalized.");
            return res.json({ ok: true, score: finalScore, isFixed: true });
          }
          throw e;
        }

        // B. ★AI学習 (Feedback Loop Implementation - UCB-adjusted Thompson Sampling)
        try {
          // 1. 評価終了日(endDate)以前の最新の提案ログを取得
          // 期間指定に対応するため、評価対象期間の終了日より前の最新の提案を探す
          const { data: suggestions } = await r.supabase
            .from("events")
            .select("payload")
            .eq("user_id", userId)
            .eq("kind", "bandit_suggestion_log")
            .lt("created_at", endDate) // 評価期間終了日より前
            .order("created_at", { ascending: false })
            .limit(1);

          const targetSuggestion = suggestions && suggestions.length > 0 ? suggestions[0] : null;

          if (targetSuggestion) {
            // ★修正: armIdを正しく取得（新形式対応）
            const payload = targetSuggestion.payload;
            const armId = payload?.armId as BanditArmId | undefined;
            const targetDimension = payload?.targetDimension as "LU" | "Q" | "O" | undefined;

            if (armId && targetDimension) {
              // 2. 報酬計算 (シグモイド変換で学習シグナル強化)
              const rawScore = finalScore[targetDimension] || 0;

              // 3. 状態更新 (UCB-adjusted Thompson Sampling)
              const currentState = await getBanditState(userId, r.supabase);

              // シグモイド報酬変換は brain.updateState 内で実行される
              const newState = brain.updateState(currentState, armId, rawScore);

              await saveBanditState(userId, newState, r.supabase);

              // 報酬値をログ用に計算（シグモイド変換後）
              const reward = brain.sigmoidReward(rawScore);

              console.log(`[Bandit] Learned: User=${userId}, Arm=${armId}, Reward=${reward.toFixed(3)} (Score=${rawScore}, Dim=${targetDimension})`);
              console.log(`[Bandit] New State for ${armId}: α=${newState.arms[armId].alpha.toFixed(2)}, β=${newState.arms[armId].beta.toFixed(2)}, trials=${newState.arms[armId].trials}`);
            } else if (targetDimension && !armId) {
              // 旧形式のログ（armIdがない）の場合、targetDimensionからarmIdを推定
              const inferredArmId = brain.getArmForDimension(targetDimension);
              const rawScore = finalScore[targetDimension] || 0;

              const currentState = await getBanditState(userId, r.supabase);
              const newState = brain.updateState(currentState, inferredArmId, rawScore);

              await saveBanditState(userId, newState, r.supabase);

              const reward = brain.sigmoidReward(rawScore);
              console.log(`[Bandit] Learned (legacy): User=${userId}, Arm=${inferredArmId} (inferred from ${targetDimension}), Reward=${reward.toFixed(3)}`);
            } else {
              console.log(`[Bandit] No valid armId or targetDimension found for month ${month}, skipping learning.`);
            }
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
