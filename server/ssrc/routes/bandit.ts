import { Router, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPromptById } from "../lib/promptIds";
import { LuqoBanditBrain } from "../lib/banditBrain";
import { dbClient, getTeamRecentLogs } from "../lib/dbClient";
import { supabaseAdmin } from "../services/supabaseClient";
import { openai } from "../lib/openaiClient";
import { ACCOUNTING_EVENTS } from "../types/accounting";

const router = Router();
const brain = new LuqoBanditBrain();

const TEAM_SEASON_DAYS = 42; // 6週間
const INDIVIDUAL_MISSION_DAYS = 14; // 2週間

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

    const { score, history } = req.body;

    // 1. OKR (Season) の取得
    const season = await getOrCreateCurrentSeason(r.userId, r.supabase);

    // 2. 個人ミッションの取得 (既存チェック)
    // 過去の自分の「bandit_suggestion_log」を最新から検索
    const { data: existingLogs } = await supabaseAdmin
      .from("events")
      .select("payload, created_at")
      .eq("user_id", r.userId)
      .eq("kind", "bandit_suggestion_log")
      .order("created_at", { ascending: false })
      .limit(1);

    let personalizedAction = "日報で戦略への貢献を記録する";
    let personalizedHint = "チームの目標を意識して行動しよう";
    let shouldUseExisting = false;

    // 既存ログがあり、かつ以下の条件を満たせば再利用
    if (existingLogs && existingLogs.length > 0) {
      const log = existingLogs[0];
      const logTime = new Date(log.created_at).getTime();
      const nowTime = Date.now();
      const diffDays = (nowTime - logTime) / (1000 * 60 * 60 * 24);

      // (A) 14日以内であること（14日目まで含む = 2週間固定）
      // (B) シーズンIDが一致していること (OKRが変わったらミッションも変える)
      // (C) ペイロードに必要な情報があること
      if (
        diffDays <= INDIVIDUAL_MISSION_DAYS &&
        log.payload &&
        log.payload.seasonId === season.id
      ) {
        if (log.payload.generatedAction) personalizedAction = log.payload.generatedAction;
        if (log.payload.generatedHint) personalizedHint = log.payload.generatedHint;
        shouldUseExisting = true;
      }
    }

    // 個人ミッションの期限を計算（既存ミッションがあればその開始時刻を基準に）
    let missionStartAt = new Date();
    if (shouldUseExisting && existingLogs && existingLogs.length > 0) {
      missionStartAt = new Date(existingLogs[0].created_at);
    }
    const missionEndAt = new Date(
      missionStartAt.getTime() + INDIVIDUAL_MISSION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // 3. 既存がなければ新規生成 (AI or Default)
    if (!shouldUseExisting) {
      console.log(`[Bandit] Generating NEW Mission for ${r.userId}`);
      try {
        const myRecentLogs =
          Array.isArray(history) && history.length > 0
            ? history.slice(-5).map((h: any) => h.text).join("\n")
            : "（ログなし：まだ活動記録がありません）";

        const systemInstruction = await loadPromptById("bandit_mission.prompt");
        const userPrompt = `
【組織の全体目標 (Team OKR)】
・目標 (Objective): ${season.objective}
・必達指標 (Key Result): ${season.keyResult}
・戦略 (Strategy): ${season.strategyName}

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
        text: `[2-Week Mission] ${season.targetDimension} -> ${personalizedAction}`,
        createdAt: new Date().toISOString(),
        payload: {
          month: currentMonth,
          seasonId: season.id, // これで紐付ける
          targetDimension: season.targetDimension,
          generatedAction: personalizedAction,
          generatedHint: personalizedHint,
        },
      }, r.supabase);
    } else {
      // console.log(`[Bandit] Reusing existing mission for ${r.userId}`);
    }

    const logsCount = Array.isArray(history) ? history.length : 0;
    const potential = brain.calculatePotential(score?.total || 0, logsCount);

    const systemPrompt = `
今、全社の経営目標(OKR)は「${season.objective}」です。
ユーザーへの個人ミッションとして「${personalizedAction}」を提案しました。
この文脈を踏まえて会話してください。
`;

    return res.status(200).json({
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
          endAt: season.endAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
