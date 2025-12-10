import { Router } from "express";
import { supabaseAdmin } from "../services/supabaseClient";
import type { AuthedRequest } from "../types/authed-request";
import { loadPromptById } from "../lib/promptIds";
import { openai } from "../lib/openaiClient";
import { gemini } from "../lib/geminiClient";
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
    
    // コストを考慮してGPT-4oを優先使用
    // 優先順位: OpenAI GPT-4o → Gemini 3 Pro → Gemini 2.5 Flash
    let analysis: any;
    let usedProvider = "gpt-4o";
    
    // OpenAI GPT-4oを優先（コスト効率と精度のバランス）
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
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
      analysis = JSON.parse(responseText);
    } catch (openaiError: any) {
      console.warn("GPT-4o解析失敗、Geminiにフォールバック:", openaiError?.message);
      usedProvider = "gemini";
      
      // Geminiモデルの優先順位（最新・高精度 → コスト効率）
      const geminiModels = [
        { name: "gemini-3-pro", label: "Gemini 3 Pro" }, // 世界最高のマルチモーダル理解
        { name: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }, // 低レイテンシー・コスト効率
      ];
      
      let geminiSuccess = false;
      for (const geminiModelInfo of geminiModels) {
        try {
          const geminiModel = gemini.getGenerativeModel({
            model: geminiModelInfo.name,
            systemInstruction: systemPrompt,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          });
          
          // 画像データをGemini形式に変換
          const imagePart = {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          };
          
          const prompt = "この画像を解析して、JSON形式で結果を返してください。";
          const result = await geminiModel.generateContent([prompt, imagePart]);
          const responseText = result.response.text();
          
          if (!responseText) {
            throw new Error("Empty response from Gemini");
          }
          
          analysis = JSON.parse(responseText);
          usedProvider = geminiModelInfo.name;
          geminiSuccess = true;
          break; // 成功したらループを抜ける
        } catch (geminiError: any) {
          console.warn(`${geminiModelInfo.label}解析失敗、次のモデルを試行:`, geminiError?.message);
          // 次のモデルを試行
          continue;
        }
      }
      
      if (!geminiSuccess) {
        // すべてのモデルが失敗した場合
        throw new Error("すべてのAIモデルで解析に失敗しました");
      }
    }
    
    // 使用したプロバイダーをログに記録（デバッグ用）
    console.log(`[Receipt Analysis] Used provider: ${usedProvider}, mode: ${mode}`);

    return res.json({ ok: true, analysis, mode, provider: usedProvider });
  } catch (err: any) {
    console.error("Analysis error:", err);
    
    // より詳細なエラーメッセージを返す
    const errorMessage = err?.message || err?.toString() || "Unknown error";
    const errorCode = err?.code || err?.status || "UNKNOWN_ERROR";
    const isModelError = errorMessage.toLowerCase().includes("model") || 
                        errorMessage.toLowerCase().includes("invalid") ||
                        errorMessage.toLowerCase().includes("not found");
    const isApiKeyError = errorMessage.toLowerCase().includes("api key") || 
                         errorMessage.toLowerCase().includes("authentication") ||
                         errorMessage.toLowerCase().includes("unauthorized");
    const isRateLimitError = errorMessage.toLowerCase().includes("rate limit") ||
                            errorCode === "rate_limit_exceeded";
    
    // エラータイプに応じたメッセージを返す
    if (isModelError) {
      return res.status(500).json({ 
        ok: false,
        error: "AIモデルの設定エラーが発生しました。利用可能なモデルを確認してください。",
        code: "MODEL_ERROR",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
    if (isApiKeyError) {
      return res.status(500).json({ 
        ok: false,
        error: "API認証エラーが発生しました。管理者に連絡してください。",
        code: "AUTH_ERROR",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
    if (isRateLimitError) {
      return res.status(429).json({ 
        ok: false,
        error: "APIの利用制限に達しました。しばらく待ってから再度お試しください。",
        code: "RATE_LIMIT",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
    
    return res.status(500).json({ 
      ok: false,
      error: "解析に失敗しました。画像またはPDFを確認してください。",
      code: "PARSE_ERROR",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined
    });
  }
});

/**
 * 取引の取り消し (逆仕訳 / Reversal Entry)
 * 
 * 【会計原則】
 * - 削除は絶対に行わない（監査証跡を保持）
 * - マイナス金額で新しいイベントを挿入（逆仕訳）
 * - 元のイベントはそのまま残し、逆仕訳で相殺
 * - 取り消し理由を記録（監査証跡）
 */
accountingRouter.post("/void", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  const { eventId, reason } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: "Invalid request" });
  }

  // 取り消し理由は必須（監査証跡のため）
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: "取り消し理由が必要です" });
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

    // 既に取り消されていないか確認（重複防止）
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

    // 元のイベントが既に取り消しデータでないか確認
    const originalPayload = originalEvent.payload as any;
    if (originalPayload?.isReversal === true) {
      return res.status(400).json({ error: "取り消しデータは取り消せません" });
    }

    const now = new Date().toISOString();
    const reversalEvents = [];

    // 逆仕訳イベントの作成（マイナス金額で相殺）
    if (originalEvent.kind === ACCOUNTING_EVENTS.SALE_REGISTERED) {
      reversalEvents.push({
        user_id: userId,
        kind: ACCOUNTING_EVENTS.SALE_REGISTERED,
        created_at: now,
        text: `【逆仕訳】売上取り消し: ${originalPayload.clientName}`,
        payload: {
          ...originalPayload,
          amount: -1 * Number(originalPayload.amount), // マイナス金額で相殺
          tax: -1 * Number(originalPayload.tax),
          description: `逆仕訳 (元ID: ${eventId}) - 理由: ${reason}`,
          isReversal: true, // 逆仕訳フラグ
          originalEventId: eventId, // 元のイベントID（監査証跡）
          reversalReason: reason, // 取り消し理由（監査証跡）
          reversedAt: now, // 取り消し日時（監査証跡）
        }
      });
    } else if (originalEvent.kind === ACCOUNTING_EVENTS.EXPENSE_REGISTERED) {
      reversalEvents.push({
        user_id: userId,
        kind: ACCOUNTING_EVENTS.EXPENSE_REGISTERED,
        created_at: now,
        text: `【逆仕訳】経費取り消し: ${originalPayload.merchant}`,
        payload: {
          ...originalPayload,
          amount: -1 * Number(originalPayload.amount), // マイナス金額で相殺
          description: `逆仕訳 (元ID: ${eventId}) - 理由: ${reason}`,
          isReversal: true, // 逆仕訳フラグ
          originalEventId: eventId, // 元のイベントID（監査証跡）
          reversalReason: reason, // 取り消し理由（監査証跡）
          reversedAt: now, // 取り消し日時（監査証跡）
          status: "approved" // 逆仕訳は自動承認
        }
      });
    } else {
      return res.status(400).json({ error: "このイベントは取り消せません" });
    }

    // OPSポイントも逆仕訳で返還
    if (originalPayload.opsReward > 0) {
      reversalEvents.push({
        user_id: userId,
        kind: ACCOUNTING_EVENTS.OPS_POINT_GRANTED,
        created_at: now,
        text: `【逆仕訳】OPSポイント返還 (取引取り消し)`,
        payload: {
          amount: -1 * Number(originalPayload.opsReward), // マイナスポイントで返還
          reason: `取引取り消しによる返還 (元ID: ${eventId}) - 理由: ${reason}`,
          sourceEvent: eventId,
          isReversal: true,
          originalEventId: eventId,
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
 * 工事カテゴリ対応版
 */
accountingRouter.post("/sales", async (req, res) => {
  const r = req as AuthedRequest;
  try {
    const { 
      amount, clientName, date, inputType, description, evidenceImage, siteName,
      workCategoryId, workCategoryLabel // 工事カテゴリ情報
    } = req.body || {};
    const userId = r.userId;
    const numericAmount = Number(amount);

    if (!userId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !isNonEmptyString(clientName) || !isNonEmptyString(date)) {
      return res.status(400).json({ error: "必須項目が不足しています" });
    }

    const isManual = inputType === "manual" || inputType === "manual_entry";
    const rewardPoints = isManual ? MANUAL_ENTRY_REWARD : OCR_ENTRY_REWARD;

    // 工事カテゴリ情報をペイロードに追加
    // カテゴリラベルはスナップショットとして保存（将来のカテゴリ名変更に備える）
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
      workCategoryId: workCategoryId || undefined,
      workCategoryLabel: workCategoryLabel || undefined,
    };

    const now = new Date().toISOString();
    
    // テキストにカテゴリ情報を含める（履歴表示用）
    const categoryText = workCategoryLabel ? ` [${workCategoryLabel}]` : "";

    const { error } = await r.supabase.from("events").insert([
      {
        user_id: userId,
        kind: ACCOUNTING_EVENTS.SALE_REGISTERED,
        payload: salePayload,
        created_at: now,
        text: `【売上】${clientName} ¥${numericAmount.toLocaleString()}${categoryText}`,
      },
      {
        user_id: userId,
        kind: ACCOUNTING_EVENTS.OPS_POINT_GRANTED,
        payload: {
          amount: rewardPoints,
          reason: `売上登録: ${clientName}${categoryText}`,
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

    const { amount, merchantName, date, category, description, siteName: manualSiteName, items } = manualData as ExpenseManualInput;
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

    // 審議が必要な場合、ランダムでレビュアーを選定
    let reviewerId: string | undefined;
    let reviewerName: string | undefined;
    if (status === "pending_vote") {
      // チームメンバー全員を取得（自分を除く）
      const { data: allUsers, error: usersError } = await r.supabase
        .from("profiles")
        .select("id, name")
        .neq("id", userId); // 自分以外

      if (!usersError && allUsers && allUsers.length > 0) {
        // ランダムで1人選定
        const randomIndex = Math.floor(Math.random() * allUsers.length);
        const selectedReviewer = allUsers[randomIndex];
        reviewerId = selectedReviewer.id;
        reviewerName = selectedReviewer.name || "不明";
      } else {
        // レビュアーが見つからない場合は承認待ちのまま（後で手動対応）
        console.warn("[Expense] No reviewers available, expense will remain pending");
      }
    }

    const payload: ExpensePayload = {
      amount: numericAmount,
      merchant: merchantName,
      category: category || "other",
      description: description || "マニュアル入力",
      date,
      risk_level: isHighRisk ? "HIGH" : "LOW",
      status,
      voteId: status === "pending_vote" ? `vote-${Date.now()}` : undefined,
      reviewerId,
      reviewerName,
      manual: true,
      siteName: manualSiteName || bodySiteName || undefined,
      items: items && items.length > 0 ? items : undefined, // 品名リスト
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

    // エラーチェック（接続タイムアウトエラーの詳細ログ）
    if (statsRes.error) {
      const isTimeout = statsRes.error.message?.includes("timeout") || 
                       statsRes.error.message?.includes("fetch failed");
      if (isTimeout) {
        console.error("Dashboard: get_accounting_stats timeout", {
          error: statsRes.error.message,
          url: process.env.SUPABASE_URL,
        });
      }
      throw statsRes.error;
    }
    if (rankingRes.error) {
      const isTimeout = rankingRes.error.message?.includes("timeout") || 
                       rankingRes.error.message?.includes("fetch failed");
      if (isTimeout) {
        console.error("Dashboard: get_ops_ranking timeout", {
          error: rankingRes.error.message,
          url: process.env.SUPABASE_URL,
        });
      }
      throw rankingRes.error;
    }
    if (historyRes.error) {
      const isTimeout = historyRes.error.message?.includes("timeout") || 
                       historyRes.error.message?.includes("fetch failed");
      if (isTimeout) {
        console.error("Dashboard: events query timeout", {
          error: historyRes.error.message,
          url: process.env.SUPABASE_URL,
        });
      }
      throw historyRes.error;
    }

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

  } catch (err: any) {
    // 接続タイムアウトエラーの特別な処理
    const isTimeoutError = 
      err?.message?.includes("timeout") ||
      err?.message?.includes("fetch failed") ||
      err?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      err?.error?.message?.includes("timeout") ||
      err?.error?.message?.includes("fetch failed");
    
    if (isTimeoutError) {
      console.error("Dashboard fetch error: Supabase connection timeout", {
        message: err?.message || err?.error?.message,
        code: err?.code || err?.error?.code,
        url: process.env.SUPABASE_URL,
      });
      return res.status(503).json({ 
        error: "サービスが一時的に利用できません。しばらくしてから再度お試しください。",
        type: "ConnectionTimeout"
      });
    }
    
    console.error("Dashboard fetch error:", err);
    return res.status(500).json({ error: "ダッシュボードの取得に失敗しました" });
  }
});

/**
 * 月別利益データ取得（予測用）
 * GET /api/v1/accounting/monthly-profit
 * 過去数ヶ月の利益データを返す
 */
accountingRouter.get("/monthly-profit", async (_req, res) => {
  try {
    const now = new Date();
    const months: Array<{ month: string; profit: number; sales: number; expenses: number }> = [];
    
    // 過去6ヶ月分のデータを取得
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;

      try {
        const statsRes = await supabaseAdmin.rpc("get_accounting_stats", {
          start_date: startOfMonth,
          end_date: endOfMonth
        });

        if (statsRes.error) {
          console.warn(`[Monthly Profit] Failed to get stats for ${monthStr}:`, statsRes.error);
          months.push({ month: monthStr, profit: 0, sales: 0, expenses: 0 });
          continue;
        }

        const { sales, expenses } = statsRes.data as { sales: number; expenses: number };
        const profit = Number(sales) - Number(expenses);
        months.push({ month: monthStr, profit, sales: Number(sales), expenses: Number(expenses) });
      } catch (err) {
        console.warn(`[Monthly Profit] Error for ${monthStr}:`, err);
        months.push({ month: monthStr, profit: 0, sales: 0, expenses: 0 });
      }
    }

    // 予測計算（簡単な移動平均）
    const profits = months.map(m => m.profit).filter(p => p > 0);
    let predictedProfit = 0;
    
    if (profits.length > 0) {
      // 直近3ヶ月の平均
      const recentMonths = profits.slice(-3);
      const avg = recentMonths.reduce((sum, p) => sum + p, 0) / recentMonths.length;
      
      // トレンドを考慮（直近2ヶ月の変化率）
      if (profits.length >= 2) {
        const lastTwo = profits.slice(-2);
        const trend = lastTwo[1] - lastTwo[0];
        predictedProfit = Math.max(0, Math.round(avg + trend * 0.5)); // トレンドの50%を反映
      } else {
        predictedProfit = Math.round(avg);
      }
    }

    return res.json({
      ok: true,
      months,
      predicted: {
        currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        profit: predictedProfit,
      },
    });
  } catch (err: any) {
    console.error("[Monthly Profit] Error:", err);
    return res.status(500).json({ ok: false, error: "月別利益データの取得に失敗しました" });
  }
});

/**
 * 請求書生成
 * GET /api/v1/accounting/invoice
 * query: { startDate: string, endDate: string, clientName: string }
 */
accountingRouter.get("/invoice", async (req, res) => {
  try {
    const { startDate, endDate, clientName } = req.query;

    if (!startDate || !endDate || !clientName) {
      return res.status(400).json({ error: "startDate, endDate, clientName が必要です" });
    }

    // URLデコードされた取引先名を取得
    const decodedClientName = decodeURIComponent(clientName as string);
    console.log("[Invoice] Request params:", { startDate, endDate, clientName: decodedClientName });

    // 期間内の該当取引先の売上データを取得
    const { data: events, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
      .eq("payload->>clientName", decodedClientName)
      .gte("payload->>occurredAt", startDate as string)
      .lte("payload->>occurredAt", endDate as string)
      .order("payload->>occurredAt", { ascending: true });

    if (error) {
      console.error("[Invoice] Database error:", error);
      throw error;
    }

    console.log(`[Invoice] Found ${events?.length || 0} events for client: ${decodedClientName}`);

    // 取り消しデータを除外（isReversalがtrueのものは除外）
    const validEvents = (events || []).filter((ev: any) => {
      const payload = ev.payload as SalePayload;
      return !(payload as any).isReversal;
    });

    if (validEvents.length === 0) {
      // デバッグ情報を含めて返す
      const allEventsInPeriod = await supabaseAdmin
        .from("events")
        .select("payload->>clientName, payload->>occurredAt")
        .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
        .gte("payload->>occurredAt", startDate as string)
        .lte("payload->>occurredAt", endDate as string);

      const availableClients = new Set(
        (allEventsInPeriod.data || []).map((ev: any) => ev.payload?.clientName).filter(Boolean)
      );

      return res.status(404).json({
        error: "該当する売上データが見つかりません",
        details: {
          requestedClient: decodedClientName,
          period: { startDate, endDate },
          availableClients: Array.from(availableClients),
          totalEventsInPeriod: allEventsInPeriod.data?.length || 0,
        },
      });
    }

    // 明細を生成
    const items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      date: string;
      siteName?: string;
    }> = [];

    // 消費税の内訳を計算（10%対象と対象外に分ける）
    let taxableAmount = 0; // 10%対象金額（税抜）
    let taxExemptAmount = 0; // 対象外金額（税抜）
    let totalTax = 0;

    validEvents.forEach((ev: any) => {
      const payload = ev.payload as SalePayload;
      const amount = Number(payload.amount) || 0; // 税抜金額
      const tax = Number(payload.tax) || 0;
      
      // 消費税がある場合は10%対象、ない場合は対象外
      if (tax > 0) {
        taxableAmount += amount;
        totalTax += tax;
      } else {
        taxExemptAmount += amount;
      }
    });

    // 明細を生成（税抜金額で表示 - 会計上一般的な形式）
    validEvents.forEach((ev: any) => {
      const payload = ev.payload as SalePayload;
      const amount = Number(payload.amount) || 0; // 税抜金額
      const tax = Number(payload.tax) || 0;

      // 日付と現場名を分離
      const dateStr = payload.occurredAt.split("T")[0];
      const dateLabel = new Date(dateStr).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      });
      
      // 現場名と説明を分離
      // 1. payload.siteName があればそれを優先
      // 2. payload.description から日付パターン（例: "12/1"）を除去して現場名として使用
      // 3. それでも取得できない場合は undefined
      let siteName: string | undefined = payload.siteName;
      let description: string = "工事代金";
      
      if (!siteName && payload.description) {
        // description から日付パターン（"12/1" や "1/15" など）を除去
        const datePattern = /^\d{1,2}\/\d{1,2}\s*/;
        const cleanedDescription = payload.description.replace(datePattern, "").trim();
        
        if (cleanedDescription.length > 0) {
          // 日付を除去した後に文字が残っている場合は、それを現場名として使用
          siteName = cleanedDescription;
          description = "工事代金";
        } else {
          // 日付パターンしかない、または日付パターンで始まらない場合は、description をそのまま使用
          // ただし、日付パターンで始まる場合は "工事代金" に統一
          if (datePattern.test(payload.description)) {
            description = "工事代金";
          } else {
            description = payload.description;
          }
        }
      } else if (payload.description && payload.description !== siteName) {
        // siteName と description が異なる場合は、description をそのまま使用
        // ただし、日付パターンで始まる場合は除去
        const datePattern = /^\d{1,2}\/\d{1,2}\s*/;
        description = payload.description.replace(datePattern, "").trim() || "工事代金";
      }

      items.push({
        description: description, // 日付と現場名を分離した説明
        quantity: 1,
        unitPrice: amount, // 税抜単価
        amount: amount, // 税抜金額
        date: dateLabel, // 日付ラベル（表示用）
        siteName: siteName, // 現場名（分離表示用）
      });
    });

    // 合計計算
    const subtotal = taxableAmount + taxExemptAmount; // 税抜小計
    const total = subtotal + totalTax; // 税込合計

    // 領収書番号を生成（YYYYMMDD-XXX形式）
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const invoiceNumber = `${dateStr}-${String(validEvents.length).padStart(3, "0")}`;

    // 発行元情報（設定から取得するか、デフォルト値を設定）
    // 画像から読み取った情報を基にデフォルト値を設定
    const issuerInfo = {
      companyName: "ハウスデバック",
      representative: "宮崎 剛士",
      address: "〒136-0071 東京都江東区亀戸 5-28-2",
      phone: "TEL: 090-4017-6397",
      email: "rostockcompany1230@gmail.com",
      registrationNumber: "登録番号: T3810420492797",
    };

    const invoiceData = {
      invoiceNumber,
      issueDate: today.toISOString().split("T")[0],
      clientName: clientName as string,
      issuer: issuerInfo,
      items,
      subtotal,
      tax: totalTax,
      total,
      taxBreakdown: {
        taxable10: {
          amount: taxableAmount,
          tax: totalTax,
        },
        exempt: {
          amount: taxExemptAmount,
          tax: 0,
        },
      },
      period: {
        startDate: startDate as string,
        endDate: endDate as string,
      },
    };

    return res.json({ ok: true, invoice: invoiceData });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return res.status(500).json({ error: "請求書の生成に失敗しました" });
  }
});

/**
 * 承認待ち経費一覧取得（レビュアー用）
 * GET /api/v1/accounting/pending-expenses
 * 自分がレビュアーに選ばれた審議中の経費を取得
 */
accountingRouter.get("/pending-expenses", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // 自分がレビュアーに選ばれた審議中の経費を取得
    const { data: events, error } = await r.supabase
      .from("events")
      .select("*")
      .eq("kind", ACCOUNTING_EVENTS.EXPENSE_REGISTERED)
      .eq("payload->>status", "pending_vote")
      .eq("payload->>reviewerId", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 履歴形式に整形
    const pendingExpenses: Array<HistoryItem & {
      eventId: string;
      applicantId: string;
      applicantName?: string;
      reviewerName?: string;
      createdAt: string;
    }> = (events || []).map((ev: any) => {
      const p = ev.payload as ExpensePayload;
      return {
        id: ev.id,
        eventId: ev.id,
        kind: "expense" as const,
        date: p.date || ev.created_at,
        title: p.merchant,
        amount: Number(p.amount) || 0,
        category: p.category,
        status: p.status,
        applicantId: ev.user_id,
        reviewerName: p.reviewerName,
        createdAt: ev.created_at,
      };
    });

    // 申請者名を取得
    const applicantIds = [...new Set(pendingExpenses.map((e) => e.applicantId))];
    if (applicantIds.length > 0) {
      const { data: profiles } = await r.supabase
        .from("profiles")
        .select("id, name")
        .in("id", applicantIds);

      const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
      pendingExpenses.forEach((expense) => {
        expense.applicantName = nameMap.get(expense.applicantId);
      });
    }

    return res.json({ ok: true, items: pendingExpenses });
  } catch (err: any) {
    console.error("[Pending Expenses] Error:", err);
    return res.status(500).json({ error: "承認待ち経費の取得に失敗しました" });
  }
});

/**
 * 経費の承認/否決
 * POST /api/v1/accounting/review-expense
 * Body: { eventId: string, action: "approve" | "reject", feedback?: string }
 */
accountingRouter.post("/review-expense", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { eventId, action, feedback } = req.body;

    if (!eventId || !action) {
      return res.status(400).json({ error: "eventId と action が必要です" });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action は 'approve' または 'reject' である必要があります" });
    }

    // 否決の場合はフィードバック必須
    if (action === "reject" && (!feedback || feedback.trim().length === 0)) {
      return res.status(400).json({ error: "否決の場合はフィードバックが必要です" });
    }

    // 対象の経費イベントを取得
    const { data: event, error: fetchError } = await r.supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("kind", ACCOUNTING_EVENTS.EXPENSE_REGISTERED)
      .single();

    if (fetchError || !event) {
      return res.status(404).json({ error: "対象の経費が見つかりません" });
    }

    const payload = event.payload as ExpensePayload;

    // レビュアー権限チェック
    if (payload.reviewerId !== userId) {
      return res.status(403).json({ error: "この経費のレビュアーではありません" });
    }

    // ステータスチェック
    if (payload.status !== "pending_vote") {
      return res.status(400).json({ error: "この経費は既に審議が完了しています" });
    }

    // ステータスを更新
    const newStatus = action === "approve" ? "approved" : "rejected";
    const updatedPayload: ExpensePayload = {
      ...payload,
      status: newStatus,
      reviewedAt: new Date().toISOString(),
      reviewFeedback: action === "reject" ? feedback?.trim() : undefined,
    };

    const { error: updateError } = await r.supabase
      .from("events")
      .update({
        payload: updatedPayload,
        text: `【経費】${payload.merchant} ¥${payload.amount.toLocaleString()} (${newStatus === "approved" ? "承認済み" : "否決"})`,
      })
      .eq("id", eventId);

    if (updateError) throw updateError;

    return res.json({
      ok: true,
      message: action === "approve" ? "経費を承認しました" : "経費を否決しました",
      status: newStatus,
    });
  } catch (err: any) {
    console.error("[Review Expense] Error:", err);
    return res.status(500).json({ error: "審議処理に失敗しました" });
  }
});

export default accountingRouter;
