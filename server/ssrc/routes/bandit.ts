import { Router, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPromptById } from "../lib/promptIds";
import { LuqoBanditBrain, type UserMode, type ArmSelectionResult } from "../lib/banditBrain";
import { dbClient, getTeamRecentLogs, getBanditState, saveBanditState } from "../lib/dbClient";
import { supabaseAdmin } from "../services/supabaseClient";
import { openai } from "../lib/openaiClient";
import { ACCOUNTING_EVENTS } from "../types/accounting";
import type { BanditArmId } from "../types/banditState";

const router = Router();
const brain = new LuqoBanditBrain();

const TEAM_SEASON_DAYS = 42; // 6週間
const INDIVIDUAL_MISSION_DAYS = 14; // 2週間

type PhaseWindow = {
  phaseIndex: number; // 0-based
  phaseCount: number;
  phaseStartAt: string;
  phaseEndAt: string;
};

function computePhaseWindow(season: Pick<TeamSeason, "startAt" | "endAt">, now: Date = new Date()): PhaseWindow {
  const seasonStartMs = new Date(season.startAt).getTime();
  const seasonEndMs = new Date(season.endAt).getTime();
  const nowMs = now.getTime();

  const phaseMs = INDIVIDUAL_MISSION_DAYS * 24 * 60 * 60 * 1000;
  const phaseCount = Math.max(1, Math.ceil((seasonEndMs - seasonStartMs) / phaseMs));

  // seasonの範囲外でも安全に扱う（基本はアクティブシーズンなので範囲内の想定）
  const unclampedIndex = Math.floor((nowMs - seasonStartMs) / phaseMs);
  const phaseIndex = Math.min(Math.max(unclampedIndex, 0), phaseCount - 1);

  const phaseStartMs = seasonStartMs + phaseIndex * phaseMs;
  const phaseEndMs = Math.min(seasonStartMs + (phaseIndex + 1) * phaseMs, seasonEndMs);

  return {
    phaseIndex,
    phaseCount,
    phaseStartAt: new Date(phaseStartMs).toISOString(),
    phaseEndAt: new Date(phaseEndMs).toISOString(),
  };
}

type TeamSeason = {
  id: string;
  targetDimension: "LU" | "Q" | "O";
  focusKpi: string;
  objective: string;
  keyResult: string;
  strategyName: string;
  aiMessage: string;
  iconChar: string;
  themeColor: string;
  startAt: string;
  endAt: string;
};

// 運用データの取得（変更なし）
async function fetchOpsMetrics(month: string) {
  const start = `${month}-01T00:00:00.000Z`;
  const { data } = await supabaseAdmin
    .from("events")
    .select("payload")
    .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
    .gte("created_at", start);

  let totalSales = 0;
  const sites = new Set<string>();

  (data || []).forEach((row: any) => {
    const p = row.payload;
    totalSales += Number(p.amount) || 0;
    if (p.siteName) sites.add(p.siteName);
  });

  return { totalSales, siteCount: sites.size };
}

// ★修正: active_seasonsテーブルを用いた排他制御
async function getOrCreateCurrentSeason(triggerUserId: string, client?: SupabaseClient): Promise<TeamSeason> {
  const now = new Date();

  // 1. アクティブなシーズンがあるか確認 (0件でもエラーにしない)
  const { data: activeRows, error: fetchError } = await supabaseAdmin
    .from("active_seasons")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch active season:", fetchError);
    // エラー時も処理は継続し、新規生成にフォールバックする
  }

  if (activeRows) {
    const expiresAt = new Date(activeRows.expires_at);
    if (expiresAt > now) {
      // 有効期間内なら、そのイベント定義を取得して返す
      const { data: eventData } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", activeRows.season_event_id)
        .single();

      if (eventData) {
        const p = eventData.payload as any;
        return {
          id: eventData.id,
          targetDimension: p.targetDimension || "Q",
          focusKpi: p.focusKpi || "quality",
          objective: p.objective,
          keyResult: p.keyResult,
          strategyName: p.strategyName,
          aiMessage: p.aiMessage,
          iconChar: p.iconChar || "🎯",
          themeColor: p.themeColor || "#00639b",
          startAt: p.startAt,
          endAt: p.endAt
        };
      }
    } else {
      // 期限切れなら無効化 (次のステップで新規作成へ)
      await supabaseAdmin
        .from("active_seasons")
        .update({ is_active: false })
        .eq("id", activeRows.id);
    }
  }

  // 2. 新規生成 (AI or Default)
  console.log("[Season] Creating NEW Season...");

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [opsMetrics, orgStats, teamLogsRaw] = await Promise.all([
    fetchOpsMetrics(currentMonth),
    dbClient.getOrgLuqoStats(currentMonth, client),
    getTeamRecentLogs(40, client)
  ]);

  const teamLogsText = teamLogsRaw.join("\n");

  // デフォルト値
  let generatedOkr = {
    objective: "組織基盤の強化",
    keyResult: "LUQOスコア平均 80pt",
    strategy: "基本動作の徹底",
    message: "足元を固めて次へ備えよう",
    icon: "construction",
    color: "#475569",
    targetDim: "Q" as "LU" | "Q" | "O"
  };

  try {
    const systemInstruction = await loadPromptById("bandit_ceo.prompt");
    const userPrompt = `
【定量データ (Ops/KPI)】
- 今月の売上: ¥${opsMetrics.totalSales.toLocaleString()}
- 稼働現場数: ${opsMetrics.siteCount}件
- 組織健全性スコア(LUQO平均): LU=${orgStats.LU}, Q=${orgStats.Q}, O=${orgStats.O}

【定性データ (現場のログ・生の声)】
${teamLogsText.substring(0, 3000)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("Empty response from OpenAI");
    }
    const json = JSON.parse(text);

    if (json.objective) {
      generatedOkr = {
        ...generatedOkr,
        objective: json.objective,
        keyResult: json.keyResult,
        strategy: json.strategy,
        message: json.message,
        icon: json.icon,
        color: json.color,
        targetDim: json.targetDim
      };
    }
  } catch (e) {
    console.error("CEO AI generation failed, using DEFAULT OKR.", e);
  }

  const startAt = now.toISOString();
  const endAt = new Date(now.getTime() + TEAM_SEASON_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const newSeasonData = {
    targetDimension: generatedOkr.targetDim,
    focusKpi: "custom_okr",
    objective: generatedOkr.objective,
    keyResult: generatedOkr.keyResult,
    strategyName: generatedOkr.strategy,
    aiMessage: generatedOkr.message,
    iconChar: generatedOkr.icon,
    themeColor: generatedOkr.color,
    startAt,
    endAt
  };

  // 3. イベント保存
  const { data: savedEvent, error: saveError } = await supabaseAdmin.from("events").insert({
    user_id: triggerUserId,
    kind: "team_season_definition",
    text: `【OKR策定】${generatedOkr.objective} / ${generatedOkr.keyResult}`,
    created_at: startAt,
    payload: newSeasonData
  }).select().single();

  if (saveError || !savedEvent) {
    throw new Error("Failed to save season event");
  }

  // 4. active_seasons に登録 (ここで排他制御)
  const { error: lockError } = await supabaseAdmin.from("active_seasons").insert({
    season_event_id: savedEvent.id,
    expires_at: endAt,
    is_active: true
  });

  if (lockError) {
    // 重複エラー(23505)なら、他が先に作ったということ -> 再帰呼び出しで取得し直す
    console.warn("Race condition detected in season creation. Retrying fetch...");
    return getOrCreateCurrentSeason(triggerUserId, client);
  }

  return { id: savedEvent.id, ...newSeasonData };
}


router.post("/suggest", async (req, res: Response, next: NextFunction) => {
  const r = req as AuthedRequest;
  try {
    if (!r.userId) return res.status(401).json({ ok: false });

    const { score, history, mode } = req.body;
    const userMode: UserMode = mode || "EARN"; // デフォルトはEARN

    // 1. OKR (Season) の取得
    const season = await getOrCreateCurrentSeason(r.userId, r.supabase);

    // 1.5 OKRを 14日×3フェーズ に分割し、今いるフェーズの期間を確定させる
    const phase = computePhaseWindow(season);

    // 2. 個人ミッションの取得 (既存チェック)
    // 同一フェーズ内の「bandit_suggestion_log」を最新から検索（フェーズ単位で固定）
    const { data: existingLogs, error: fetchError } = await supabaseAdmin
      .from("events")
      .select("payload, created_at")
      .eq("user_id", r.userId)
      .eq("kind", "bandit_suggestion_log")
      .gte("created_at", phase.phaseStartAt)
      .lt("created_at", phase.phaseEndAt)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("[Bandit] Failed to fetch existing logs:", fetchError);
    }

    let personalizedAction = "日報で戦略への貢献を記録する";
    let personalizedHint = "チームの目標を意識して行動しよう";
    let shouldUseExisting = false;
    let selectedArmId: BanditArmId = brain.getArmForDimension(season.targetDimension);
    let armSelectionResult: ArmSelectionResult | null = null;

    // 既存ログがあり、かつ以下の条件を満たせば再利用
    if (existingLogs && existingLogs.length > 0) {
      const log = existingLogs[0];

      // ペイロードの構造を正規化（入れ子構造に対応）
      // DBの構造によっては payload.payload に実際のデータが入っている場合がある
      const actualPayload = log.payload?.payload || log.payload;
      const payloadSeasonId = actualPayload?.seasonId;
      const payloadAction = actualPayload?.generatedAction;
      const payloadHint = actualPayload?.generatedHint;

      console.log(`[Bandit] Existing log found for ${r.userId}:`, {
        created_at: log.created_at,
        payloadSeasonId,
        currentSeasonId: season.id,
        seasonIdMatch: payloadSeasonId === season.id,
        generatedAction: payloadAction,
        generatedHint: payloadHint,
        phaseIndex: phase.phaseIndex,
        phaseStartAt: phase.phaseStartAt,
        phaseEndAt: phase.phaseEndAt,
      });

      // (A) 同一フェーズ内であること（クエリ条件で担保）
      // (B) シーズンIDが一致していること (OKRが変わったらミッションも変える)
      // (C) ペイロードに必要な情報があること
      if (actualPayload && payloadSeasonId === season.id) {
        if (payloadAction) personalizedAction = payloadAction;
        if (payloadHint) personalizedHint = payloadHint;
        shouldUseExisting = true;
        console.log(`[Bandit] Reusing existing mission: action="${personalizedAction}", hint="${personalizedHint}"`);
      } else {
        console.log(`[Bandit] Not reusing existing mission:`, {
          reason: !actualPayload ? "no payload" :
            payloadSeasonId !== season.id ? `seasonId mismatch (${payloadSeasonId} vs ${season.id})` : "unknown",
        });
      }
    } else {
      console.log(`[Bandit] No existing logs found for ${r.userId}`);
    }

    // 個人ミッションの期限は「フェーズ終了日」に固定する（全ユーザーで帳尻が合う）
    const missionEndAt = phase.phaseEndAt;

    console.log(`[Bandit] Mission calculation for ${r.userId}:`, {
      missionEndAt,
      daysFromNow: ((new Date(missionEndAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)).toFixed(2),
      shouldUseExisting,
      phaseIndex: phase.phaseIndex,
    });

    // 3. 既存がなければ新規生成 (AI or Default)
    if (!shouldUseExisting) {
      console.log(`[Bandit] Generating NEW Mission for ${r.userId}`);

      // ★ Context Injection (Past 2 weeks context)
      const { getUserContext } = await import("../services/contextService");
      // フェーズ開始から現在までのコンテキストを取得（または直近2週間）
      // フェーズ開始が未来の場合は学習データがないので、直近2週間をとる
      let contextStart = phase.phaseStartAt;
      if (new Date(contextStart) > new Date()) {
        contextStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      }
      const userContext = await getUserContext(r.userId, contextStart, new Date().toISOString());

      try {
        // ★ UCB-Adjusted Thompson Sampling でアーム選択
        const banditState = await getBanditState(r.userId, r.supabase);

        // Contextに基づくモード推定（簡易ロジック）
        // 売上が低い場合は "EARN" モードを強めるなど、ここで userMode を上書きすることも可能
        // 今回は単純に prompt に混ぜるだけに留めるが、将来的には brain.selectArm に渡す mode を動的に決定できる

        armSelectionResult = brain.selectArm(userMode, banditState, season.targetDimension);
        selectedArmId = armSelectionResult.armId;

        console.log(`[Bandit] Selected arm for ${r.userId}:`, {
          armId: selectedArmId,
          dimension: armSelectionResult.armInfo.dimension,
          sampleValue: armSelectionResult.sampleValue.toFixed(3),
          ucbBonus: armSelectionResult.ucbBonus.toFixed(3),
          contextBoost: armSelectionResult.contextBoost.toFixed(3),
          finalScore: armSelectionResult.finalScore.toFixed(3),
        });

        const myRecentLogs =
          Array.isArray(history) && history.length > 0
            ? history.slice(-5).map((h: any) => h.text).join("\n")
            : "（ログなし：まだ活動記録がありません）";

        // ★学習機能: 過去のミッション変更履歴を取得
        const { data: pastMissions } = await supabaseAdmin
          .from("events")
          .select("payload, created_at")
          .eq("user_id", r.userId)
          .eq("kind", "bandit_suggestion_log")
          .order("created_at", { ascending: false })
          .limit(10); // 直近10件のミッション履歴を取得

        // 変更履歴を抽出（changeReasonがあるもの = ユーザーが編集したもの）
        const feedbackHistory: Array<{
          originalAction: string;
          originalHint: string;
          editedAction?: string;
          editedHint?: string;
          changeReason: string;
          editedAt: string;
        }> = [];

        if (pastMissions && pastMissions.length > 0) {
          for (const mission of pastMissions) {
            const payload = mission.payload as any;
            // 変更理由がある = ユーザーが編集したミッション
            if (payload?.changeReason) {
              feedbackHistory.push({
                originalAction: payload.originalAction || payload.generatedAction || "不明",
                originalHint: payload.originalHint || payload.generatedHint || "不明",
                editedAction: payload.generatedAction,
                editedHint: payload.generatedHint,
                changeReason: payload.changeReason,
                editedAt: payload.editedAt || mission.created_at,
              });
            }
          }
        }

        // フィードバック履歴をテキスト化
        let feedbackItems = "";
        if (feedbackHistory.length > 0) {
          // フィードバック項目を整形
          feedbackItems = feedbackHistory.slice(0, 3).map((fb, idx) => `
${idx + 1}. 【元のミッション】
   ・アクション: ${fb.originalAction}
   ・理由: ${fb.originalHint}
   【ユーザーの変更理由】
   ${fb.changeReason}
   ${fb.editedAction ? `【変更後のミッション】\n   ・アクション: ${fb.editedAction}\n   ・理由: ${fb.editedHint || "なし"}` : ""}
`).join("\n");
        }

        // メインプロンプトを読み込む
        let systemInstruction = await loadPromptById("bandit_mission.prompt");

        // フィードバック項目を挿入
        systemInstruction = systemInstruction.replace("{{FEEDBACK_ITEMS}}", feedbackItems);

        // フィードバック履歴セクションを有効化/無効化
        if (feedbackHistory.length > 0) {
          // フィードバック履歴がある場合は、セクション全体を有効化
          systemInstruction = systemInstruction.replace("{{FEEDBACK_HISTORY}}", "");
        } else {
          // フィードバック履歴がない場合は、セクション全体を削除
          systemInstruction = systemInstruction.replace(/{{FEEDBACK_HISTORY}}[\s\S]*?⚠️ 上記のようなミッションは避け、ユーザーの実際の活動ログと組織目標をより深く分析して提案してください。\n\n/, "");
        }

        const userPrompt = `
【組織の全体目標 (Team OKR)】
・目標 (Objective): ${season.objective}
・必達指標 (Key Result): ${season.keyResult}
・戦略 (Strategy): ${season.strategyName}

【ユーザーの状態 (User Context)】
・直近のログ数: ${userContext.activity.logCount}件 (文字数: ${userContext.activity.totalChars})
・経理貢献: 売上 ¥${Number(userContext.accounting.totalSales).toLocaleString()} / 経費 ${userContext.accounting.expenseCount}件
・Opsポイント: ${userContext.ops.earnedPoints}pt

【ユーザーの直近の活動ログ (Personal Context)】
${myRecentLogs}
`;
        const completion = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) {
          throw new Error("Empty response from OpenAI");
        }
        const json = JSON.parse(text);

        if (json.action && json.hint) {
          personalizedAction = json.action;
          personalizedHint = json.hint;
        }
      } catch (e) {
        console.warn("Mission AI generation failed, using DEFAULT mission.", e);
        // デフォルト値のまま進む
      }

      // ★重要: 生成結果（またはデフォルト）をDBに保存し、次回から再利用可能にする
      const currentMonth = new Date().toISOString().slice(0, 7);
      await dbClient.appendEvent({
        userId: r.userId,
        kind: "bandit_suggestion_log",
        text: `[2-Week Mission] ${armSelectionResult?.armInfo.dimension || season.targetDimension} -> ${personalizedAction}`,
        createdAt: new Date().toISOString(),
        payload: {
          month: currentMonth,
          seasonId: season.id, // これで紐付ける
          // ★修正: armIdを保存（学習ループの完結性）
          armId: selectedArmId,
          targetDimension: armSelectionResult?.armInfo.dimension || season.targetDimension,
          // UCB-Thompson Sampling のデバッグ情報
          banditInfo: armSelectionResult ? {
            sampleValue: armSelectionResult.sampleValue,
            ucbBonus: armSelectionResult.ucbBonus,
            contextBoost: armSelectionResult.contextBoost,
            finalScore: armSelectionResult.finalScore,
          } : null,
          // フェーズ情報（フェーズ単位で再利用・表示を安定させる）
          phaseIndex: phase.phaseIndex,
          phaseStartAt: phase.phaseStartAt,
          phaseEndAt: phase.phaseEndAt,
          generatedAction: personalizedAction,
          generatedHint: personalizedHint,
          userContext: userContext // 生成時のコンテキストも保存（分析用）
        },
      }, r.supabase);
    } else {
      // 既存ミッションを再利用する場合、既存のarmIdを取得
      if (existingLogs && existingLogs.length > 0) {
        const actualPayload = existingLogs[0].payload?.payload || existingLogs[0].payload;
        selectedArmId = actualPayload?.armId || selectedArmId;
      }
    }

    const logsCount = Array.isArray(history) ? history.length : 0;
    const potential = brain.calculatePotential(score?.total || 0, logsCount);

    const systemPrompt = `
今、全社の経営目標(OKR)は「${season.objective}」です。
ユーザーへの個人ミッションとして「${personalizedAction}」を提案しました。
この文脈を踏まえて会話してください。
`;

    const response = {
      ok: true,
      suggestion: {
        action: personalizedAction,
        luqoHint: personalizedHint,
        systemPrompt,
        missionEndAt,
      },
      potential,
      baseKpi: season.focusKpi as any,
      chosenKpi: season.focusKpi as any,
      focusDimension: season.targetDimension as any,
      context: {
        reason: season.aiMessage,
        strategyType: "CEO_GENERATED_OKR",
        orgStats: { LU: 0, Q: 0, O: 0 },
        okr: {
          objective: season.objective,
          keyResult: season.keyResult,
          strategy: season.strategyName,
          iconChar: season.iconChar,
          themeColor: season.themeColor,
          startAt: season.startAt,
          endAt: season.endAt,
        },
      },
    };

    console.log(`[Bandit] Response for ${r.userId}:`, {
      action: response.suggestion.action,
      luqoHint: response.suggestion.luqoHint,
      missionEndAt: response.suggestion.missionEndAt,
      daysFromNow: ((new Date(response.suggestion.missionEndAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)).toFixed(2),
    });

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// ★明示的フィードバックAPI (Explicit Feedback)
router.post("/feedback", async (req, res: Response, next: NextFunction) => {
  const r = req as AuthedRequest;
  try {
    if (!r.userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { missionId, rating, comment } = req.body;
    // rating: 1(悪い) ~ 5(良い)

    if (!missionId || typeof rating !== "number") {
      return res.status(400).json({ ok: false, error: "missionId and rating are required" });
    }

    // 1. ミッションログを取得して ArmID を特定
    // missionId は bandit_suggestion_log イベントの ID で渡ってくる想定
    let targetLog;

    // IDがUUID形式か確認 (簡易チェック)
    if (missionId.length > 10) {
      const { data } = await supabaseAdmin.from("events").select("*").eq("id", missionId).single();
      targetLog = data;
    } else {
      // 古い形式や不正なIDの場合は最新を検索
      const { data } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("user_id", r.userId)
        .eq("kind", "bandit_suggestion_log")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      targetLog = data;
    }

    if (!targetLog) {
      return res.status(404).json({ ok: false, error: "Mission not found" });
    }

    const payload = targetLog.payload as any;
    const armId = payload.armId as BanditArmId;

    if (!armId) {
      return res.status(400).json({ ok: false, error: "Mission has no Arm ID associated" });
    }

    // 2. 報酬計算 (1-5 -> 0-1)
    // 5=1.0, 4=0.75, 3=0.5, 2=0.25, 1=0.0
    const rawReward = (Math.max(1, Math.min(5, rating)) - 1) / 4;

    // 3. 学習 (Update Bandit State)
    const currentState = await getBanditState(r.userId, r.supabase);
    // brain.updateState は内部でsigmoidを通すが、ここでは直接フィードバックなので
    // 明示的な報酬更新ロジックを呼ぶか、rawScoreとして渡すか。
    // updateState は "rawScore(0-100)" を期待しているので、100点満点に換算して渡す
    const scoreEquivalent = rawReward * 100;

    const newState = brain.updateState(currentState, armId, scoreEquivalent);
    await saveBanditState(r.userId, newState, r.supabase);

    // 4. ログ保存
    await dbClient.appendEvent({
      userId: r.userId,
      kind: "bandit_explicit_feedback",
      text: `[Feedback] Rating=${rating} for ${armId}`,
      payload: {
        missionId,
        rating,
        comment,
        armId,
        reward: rawReward,
        scoreEquivalent
      }
    }, r.supabase);

    return res.json({ ok: true, message: "Feedback received and learned." });

  } catch (err) {
    next(err);
  }
});

// ミッション更新API
router.post("/update-mission", async (req, res: Response, next: NextFunction) => {
  const r = req as AuthedRequest;
  try {
    if (!r.userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { action, hint, changeReason } = req.body;

    if (!action || !hint || !changeReason) {
      return res.status(400).json({ ok: false, error: "action, hint, and changeReason are required" });
    }

    // 1. 現在のシーズンを取得
    const season = await getOrCreateCurrentSeason(r.userId, r.supabase);
    const phase = computePhaseWindow(season);

    // 2. 既存のbandit_suggestion_logイベントを取得
    const { data: existingLogs, error: fetchError } = await supabaseAdmin
      .from("events")
      .select("id, payload, created_at")
      .eq("user_id", r.userId)
      .eq("kind", "bandit_suggestion_log")
      .gte("created_at", phase.phaseStartAt)
      .lt("created_at", phase.phaseEndAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[Bandit] Failed to fetch existing mission:", fetchError);
      return res.status(500).json({ ok: false, error: "Failed to fetch existing mission" });
    }

    // 3. 既存のイベントがある場合は更新、ない場合は新規作成
    const currentMonth = new Date().toISOString().slice(0, 7);

    // 元のミッション情報を保存（学習用）
    const originalAction = existingLogs?.payload?.generatedAction || existingLogs?.payload?.originalAction || action;
    const originalHint = existingLogs?.payload?.generatedHint || existingLogs?.payload?.originalHint || hint;

    const updatedPayload = {
      month: currentMonth,
      seasonId: season.id,
      targetDimension: season.targetDimension,
      phaseIndex: phase.phaseIndex,
      phaseStartAt: phase.phaseStartAt,
      phaseEndAt: phase.phaseEndAt,
      generatedAction: action, // 変更後のアクション
      generatedHint: hint, // 変更後のヒント
      // ★学習用: 元のミッション情報を保存
      originalAction: originalAction, // AIが生成した元のアクション
      originalHint: originalHint, // AIが生成した元のヒント
      changeReason: changeReason, // 変更理由を記録
      editedAt: new Date().toISOString(), // 編集時刻を記録
    };

    if (existingLogs && existingLogs.id) {
      // 既存イベントを更新
      const { error: updateError } = await supabaseAdmin
        .from("events")
        .update({
          text: `[2-Week Mission] ${season.targetDimension} -> ${action} (編集済み)`,
          payload: updatedPayload,
        })
        .eq("id", existingLogs.id);

      if (updateError) {
        console.error("[Bandit] Failed to update mission:", updateError);
        return res.status(500).json({ ok: false, error: "Failed to update mission" });
      }
    } else {
      // 新規作成（通常は既存があるはずだが、念のため）
      await dbClient.appendEvent({
        userId: r.userId,
        kind: "bandit_suggestion_log",
        text: `[2-Week Mission] ${season.targetDimension} -> ${action}`,
        createdAt: new Date().toISOString(),
        payload: updatedPayload,
      }, r.supabase);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
