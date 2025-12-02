import { Router } from "express";
import { supabaseAdmin } from "../services/supabaseClient";
import type { AuthedRequest } from "../types/authed-request";
import { loadPromptById } from "../lib/promptIds";
import { openai } from "../lib/openaiClient";
import {
  ACCOUNTING_EVENTS,
  type DashboardResponse,
  type ExpenseManualInput,
  type HistoryItem,
  type ExpensePayload,
  type SalePayload,
} from "../types/accounting";

const accountingRouter = Router();

// 定数設定
const COMPANY_RETAINED_RATE = 0.3; // 会社留保率 30%
const MANUAL_ENTRY_REWARD = 50;
const OCR_ENTRY_REWARD = 30;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * レシート/請求書 解析 (AI Analysis)
 */
accountingRouter.post("/analyze", async (req, res) => {
  try {
    const { fileBase64, mode } = req.body;
    const inputBase64 = fileBase64 || req.body.imageBase64;

    if (!inputBase64) {
      return res.status(400).json({ error: "ファイルデータが必要です" });
    }

    const isSales = mode === "sales";
    const promptId = isSales ? "sales_audit.prompt" : "expense_audit.prompt";

    // MIMEタイプの簡易判定
    const match = inputBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    const mimeType = match ? match[1] : "image/jpeg";
    const base64Data = match ? match[2] : inputBase64;

    const systemPrompt = await loadPromptById(promptId);
    
    // OpenAI Vision APIを使用（画像解析）
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { 
          role: "system", 
          content: systemPrompt 
        },
        {
          role: "user",
          content: [
            {
              type: "image_url" as const,
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            },
            {
              type: "text" as const,
              text: "この画像を解析して、JSON形式で結果を返してください。"
            }
          ]
        }
      ] as any,
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }
    const analysis = JSON.parse(responseText);

    return res.json({ ok: true, analysis, mode });
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({ error: "解析に失敗しました。画像またはPDFを確認してください。" });
  }
});

/**
 * 取引の取り消し (Void / Reversal)
 */
accountingRouter.post("/void", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  const { eventId, reason } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const { data: originalEvent, error: fetchError } = await r.supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !originalEvent) {
      return res.status(404).json({ error: "対象のデータが見つかりません" });
    }

    const { data: alreadyVoided } = await r.supabase
      .from("events")
      .select("id")
      .eq("user_id", userId)
      .contains("payload", { isReversal: true, originalEventId: eventId })
      .limit(1)
      .maybeSingle();

    if (alreadyVoided) {
      return res.status(409).json({ error: "Already voided", message: "この取引は既に取り消されています。" });
    }

    const originalPayload = originalEvent.payload as any;
    const now = new Date().toISOString();
    const reversalEvents = [];

    if (originalEvent.kind === ACCOUNTING_EVENTS.SALE_REGISTERED) {
      reversalEvents.push({
        user_id: userId,
        kind: ACCOUNTING_EVENTS.SALE_REGISTERED,
        created_at: now,
        text: `【訂正】売上取り消し: ${originalPayload.clientName}`,
        payload: {
          ...originalPayload,
          amount: -1 * Number(originalPayload.amount),
          tax: -1 * Number(originalPayload.tax),
          description: `取り消し (元ID: ${eventId}) - ${reason || ""}`,
          isReversal: true,
          originalEventId: eventId,
        }
      });
    } else if (originalEvent.kind === ACCOUNTING_EVENTS.EXPENSE_REGISTERED) {
      reversalEvents.push({
        user_id: userId,
        kind: ACCOUNTING_EVENTS.EXPENSE_REGISTERED,
        created_at: now,
        text: `【訂正】経費取り消し: ${originalPayload.merchant}`,
        payload: {
          ...originalPayload,
          amount: -1 * Number(originalPayload.amount),
          description: `取り消し (元ID: ${eventId}) - ${reason || ""}`,
          isReversal: true,
          originalEventId: eventId,
          status: "approved"
        }
      });
    } else {
      return res.status(400).json({ error: "このイベントは取り消せません" });
    }

    if (originalPayload.opsReward > 0) {
      reversalEvents.push({
        user_id: userId,
        kind: ACCOUNTING_EVENTS.OPS_POINT_GRANTED,
        created_at: now,
        text: `【OPS】ポイント没収 (取り消し)`,
        payload: {
          amount: -1 * Number(originalPayload.opsReward),
          reason: `取引取り消しによる返還 (元ID: ${eventId})`,
          sourceEvent: eventId
        }
      });
    }

    const { error: insertError } = await r.supabase.from("events").insert(reversalEvents);
    if (insertError) throw insertError;

    return res.json({ ok: true, message: "取引を取り消しました" });

  } catch (err) {
    console.error("Void transaction error:", err);
    return res.status(500).json({ error: "取り消し処理に失敗しました" });
  }
});

/**
 * A. 売上登録
 */
accountingRouter.post("/sales", async (req, res) => {
  const r = req as AuthedRequest;
  try {
    const { amount, clientName, date, inputType, description, evidenceImage, siteName } = req.body || {};
    const userId = r.userId;
    const numericAmount = Number(amount);

    if (!userId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !isNonEmptyString(clientName) || !isNonEmptyString(date)) {
      return res.status(400).json({ error: "必須項目が不足しています" });
    }

    const isManual = inputType === "manual" || inputType === "manual_entry";
    const rewardPoints = isManual ? MANUAL_ENTRY_REWARD : OCR_ENTRY_REWARD;

    const salePayload: SalePayload = {
      amount: numericAmount,
      tax: Math.floor(numericAmount * 0.1),
      clientName,
      siteName: siteName || undefined,
      occurredAt: date,
      description: description || undefined,
      evidenceUrl: evidenceImage || undefined,
      inputType: isManual ? "manual_entry" : "ocr_verified",
      opsReward: rewardPoints,
    };

    const now = new Date().toISOString();

    const { error } = await r.supabase.from("events").insert([
      {
        user_id: userId,
        kind: ACCOUNTING_EVENTS.SALE_REGISTERED,
        payload: salePayload,
        created_at: now,
        text: `【売上】${clientName} ¥${numericAmount.toLocaleString()}`,
      },
      {
        user_id: userId,
        kind: ACCOUNTING_EVENTS.OPS_POINT_GRANTED,
        payload: {
          amount: rewardPoints,
          reason: `売上登録: ${clientName}`,
          sourceEvent: ACCOUNTING_EVENTS.SALE_REGISTERED,
        },
        created_at: now,
        text: `【OPS】+${rewardPoints}pt (${clientName})`,
      },
    ]);

    if (error) throw error;

    return res.status(201).json({
      message: "売上が登録されました",
      earnedPoints: rewardPoints,
      aiMessage: "手入力お疲れ様です！このデータがみんなの給与になります💰",
    });
  } catch (err) {
    console.error("Sales registration error:", err);
    return res.status(500).json({ error: "売上登録に失敗しました" });
  }
});

/**
 * 経費申請
 */
accountingRouter.post("/expenses", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { manualData, siteName: bodySiteName } = req.body;
    if (!manualData) return res.status(400).json({ error: "データ不足" });

    const { amount, merchantName, date, category, description, siteName: manualSiteName } = manualData as ExpenseManualInput;
    const numericAmount = Number(amount);

    // 重複チェック
    const { data: duplicates } = await r.supabase
      .from("events")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", ACCOUNTING_EVENTS.EXPENSE_REGISTERED)
      .contains("payload", { date, amount: numericAmount, merchant: merchantName });

    if (duplicates && duplicates.length > 0) {
      return res.status(409).json({ error: "Duplicate", message: "既に登録されています。" });
    }

    const isHighRisk = (numericAmount > 5000 && category !== "material") || numericAmount > 30000;
    const status = isHighRisk ? "pending_vote" : "approved";

    const payload: ExpensePayload = {
      amount: numericAmount,
      merchant: merchantName,
      category: category || "other",
      description: description || "マニュアル入力",
      date,
      risk_level: isHighRisk ? "HIGH" : "LOW",
      status,
      voteId: status === "pending_vote" ? `vote-${Date.now()}` : undefined,
      manual: true,
      siteName: manualSiteName || bodySiteName || undefined,
    };

    const { error } = await r.supabase.from("events").insert([
      {
        user_id: userId,
        kind: ACCOUNTING_EVENTS.EXPENSE_REGISTERED,
        payload,
        created_at: new Date().toISOString(),
        text: `【経費】${merchantName} ¥${numericAmount.toLocaleString()} (${status})`,
      },
    ]);

    if (error) throw error;

    return res.json({
      ok: true,
      status,
      message: status === "approved" ? "経費を登録しました" : "金額が大きいため審議に入ります",
      earnedPoints: 10,
    });

  } catch (err) {
    console.error("Expense error:", err);
    return res.status(500).json({ error: "経費登録に失敗しました" });
  }
});

/**
 * B. ダッシュボード・可視化 (高速化対応)
 * GET /api/v1/accounting/dashboard
 */
accountingRouter.get("/dashboard", async (_req, res) => {
  try {
    const now = new Date();
    // 今月1日 (Dateオブジェクトのまま渡すことで、timestamp with time zone型として認識される)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // 翌月1日 (範囲終了用)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ★修正: DB側関数 (RPC) で集計を実行
    const [statsRes, rankingRes, historyRes] = await Promise.all([
      // 1. 売上・経費集計
      supabaseAdmin.rpc("get_accounting_stats", {
        start_date: startOfMonth,
        end_date: endOfMonth
      }),
      // 2. Opsランキング
      supabaseAdmin.rpc("get_ops_ranking", {
        start_date: startOfMonth,
        end_date: endOfMonth,
        limit_count: 5
      }),
      // 3. 直近履歴 (20件のみ取得)
      supabaseAdmin
        .from("events")
        .select("*")
        .in("kind", [ACCOUNTING_EVENTS.SALE_REGISTERED, ACCOUNTING_EVENTS.EXPENSE_REGISTERED])
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (statsRes.error) throw statsRes.error;
    if (rankingRes.error) throw rankingRes.error;
    if (historyRes.error) throw historyRes.error;

    // 集計結果の取り出し
    const { sales, expenses } = statsRes.data as { sales: number; expenses: number };
    const profit = sales - expenses;
    const distributable = Math.max(0, Math.floor(profit * (1 - COMPANY_RETAINED_RATE)));

    // ランキング整形
    const opsRanking = (rankingRes.data || []).map((r: any, i: number) => ({
      userId: r.user_id,
      points: r.points,
      badge: i === 0 ? "Admin Hero" : undefined
    }));

    // 履歴整形 (UI用)
    const history: HistoryItem[] = (historyRes.data || []).map((ev: any) => {
      const p = ev.payload;
      const isSale = ev.kind === ACCOUNTING_EVENTS.SALE_REGISTERED;
      return {
        id: ev.id,
        kind: isSale ? "sale" : "expense",
        date: p.occurredAt || p.date || ev.created_at,
        title: isSale ? p.clientName : p.merchant,
        amount: Number(p.amount) || 0,
        category: p.category,
        status: p.status || "recorded",
      };
    });

    // 現場数カウント (概算: 履歴の中でユニークな現場名があれば数える簡易ロジック、あるいは別途RPC化も可)
    // ここでは軽量化のため、履歴に含まれる範囲でのユニーク数とするか、
    // 正確に知りたい場合は別途 count query を投げる。今回は固定値または履歴ベースで返す。
    const uniqueSites = new Set(history.map(h => h.title)); // 仮

    const response: DashboardResponse = {
      currentMonth: currentMonthStr,
      pl: {
        sales: Number(sales),
        expenses: Number(expenses),
        profit,
        distributable,
      },
      metrics: {
        siteCount: uniqueSites.size,
        salesGrowth: 1.0, // 必要なら別途計算
      },
      opsRanking,
      history,
    };

    return res.json(response);

  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return res.status(500).json({ error: "ダッシュボードの取得に失敗しました" });
  }
});

export default accountingRouter;
