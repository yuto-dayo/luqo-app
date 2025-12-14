import { Router } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { supabaseAdmin } from "../services/supabaseClient";
import { runPrompt } from "../services/aiPromptService";
import type { WorkCategory, SalePayload } from "../types/accounting";
import { ACCOUNTING_EVENTS } from "../types/accounting";

const masterRouter = Router();
const STAR_VOTE_THRESHOLD = Number(process.env.STAR_VOTE_THRESHOLD ?? "3");

// 取引先一覧取得
masterRouter.get("/clients", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { data, error } = await r.supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, clients: data });
});

// 取引先追加
masterRouter.post("/clients", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const { data, error } = await r.supabase
    .from("clients")
    .insert({ name })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, client: data });
});

// 取引先更新
masterRouter.put("/clients/:id", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const { data, error } = await r.supabase
    .from("clients")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, client: data });
});

// 取引先削除
masterRouter.delete("/clients/:id", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { id } = req.params;
  const { error } = await r.supabase.from("clients").delete().eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ====================================================
// 工事カテゴリ管理 API
// ====================================================

/**
 * 工事カテゴリ一覧取得
 * GET /api/v1/master/categories
 */
masterRouter.get("/categories", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  try {
    const { data, error } = await r.supabase
      .from("work_categories")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Categories] Failed to fetch", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // snake_case を camelCase に変換
    const categories: WorkCategory[] = (data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      defaultWeight: Number(row.default_weight),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({ ok: true, categories });
  } catch (err: any) {
    console.error("[Categories] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

/**
 * 工事カテゴリ新規追加（申請システム経由）
 * POST /api/v1/master/categories/propose-add
 * Body: { label: string, reason: string }
 * 
 * 注意: 直接追加はできません。申請システム経由で追加してください。
 */
masterRouter.post("/categories/propose-add", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { label, reason } = req.body || {};

  if (!label || typeof label !== "string" || label.trim().length === 0) {
    return res.status(400).json({ ok: false, error: "ラベル（label）は必須です" });
  }

  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return res.status(400).json({ ok: false, error: "追加理由（reason）は必須です" });
  }

  try {
    // AI審査
    const aiResultText = await runPrompt(
      "category_audit.prompt",
      JSON.stringify({
        action: "ADD",
        label: label.trim(),
        reason: reason.trim(),
      })
    );

    let aiData: any;
    try {
      const normalized = aiResultText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "");
      aiData = JSON.parse(normalized);
    } catch (parseErr) {
      console.error("[Category Add Propose] Failed to parse AI response", parseErr, aiResultText);
      return res.status(502).json({ ok: false, error: "Invalid AI response" });
    }

    // 提案を保存
    const { data, error } = await supabaseAdmin.from("star_proposals").insert({
      proposer_id: r.userId,
      change_type: "CATEGORY_ADD",
      new_definition: {
        label: label.trim(),
        defaultWeight: 1.0, // デフォルトは1.0
      },
      reason: reason.trim(),
      ai_review_comment: aiData.review_comment,
      ai_approval: aiData.is_valid ?? null,
    }).select().single();

    if (error) {
      console.error("[Category Add Propose] DB insert error", error);
      return res.status(500).json({ ok: false, error: "Failed to save proposal" });
    }

    return res.json({ ok: true, proposal: data, aiReview: aiData });
  } catch (err: any) {
    console.error("[Category Add Propose] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

/**
 * 工事カテゴリ更新
 * PUT /api/v1/master/categories/:id
 * Body: { label?: string, isActive?: boolean }
 * 
 * 注意: 重み係数（defaultWeight）の変更は申請システム経由で行ってください。
 * このAPIでは重み係数の直接変更はできません。
 */
masterRouter.put("/categories/:id", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { id } = req.params;
  const { label, isActive } = req.body || {};

  if (!id) {
    return res.status(400).json({ ok: false, error: "IDは必須です" });
  }

  // 重み係数の直接変更は禁止
  if (req.body?.defaultWeight !== undefined) {
    return res.status(400).json({
      ok: false,
      error: "重み係数の変更は申請システム経由で行ってください。POST /api/v1/master/categories/propose-weight-change を使用してください。",
    });
  }

  try {
    // 現在の値を取得
    const { data: currentData, error: fetchError } = await r.supabase
      .from("work_categories")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !currentData) {
      return res.status(404).json({ ok: false, error: "カテゴリが見つかりません" });
    }

    // 更新データの構築
    const updateData: Record<string, any> = {};

    if (label !== undefined && typeof label === "string" && label.trim().length > 0) {
      updateData.label = label.trim();
    }

    if (isActive !== undefined && typeof isActive === "boolean") {
      updateData.is_active = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ ok: false, error: "更新するデータがありません" });
    }

    const { data, error } = await r.supabase
      .from("work_categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Categories] Failed to update", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // snake_case を camelCase に変換
    const category: WorkCategory = {
      id: data.id,
      code: data.code,
      label: data.label,
      defaultWeight: Number(data.default_weight),
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.json({
      ok: true,
      category,
      message: "カテゴリを更新しました",
    });
  } catch (err: any) {
    console.error("[Categories] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

/**
 * 工事カテゴリ削除（申請システム経由）
 * POST /api/v1/master/categories/propose-delete
 * Body: { categoryId: string, reason: string }
 * 
 * 注意: 直接削除はできません。申請システム経由で削除してください。
 */
masterRouter.post("/categories/propose-delete", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { categoryId, reason } = req.body || {};

  if (!categoryId || typeof categoryId !== "string") {
    return res.status(400).json({ ok: false, error: "カテゴリID（categoryId）は必須です" });
  }

  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return res.status(400).json({ ok: false, error: "削除理由（reason）は必須です" });
  }

  try {
    // カテゴリ情報を取得
    const { data: category, error: categoryError } = await supabaseAdmin
      .from("work_categories")
      .select("*")
      .eq("id", categoryId)
      .single();

    if (categoryError || !category) {
      return res.status(404).json({ ok: false, error: "カテゴリが見つかりません" });
    }

    // 過去の売上データで使用されているかチェック
    const { data: salesData, error: salesError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
      .contains("payload", { workCategoryId: categoryId })
      .limit(1);

    if (salesError) {
      console.error("[Category Delete Propose] Failed to check sales data:", salesError);
    }

    const hasSalesData = salesData && salesData.length > 0;

    // AI審査
    const aiResultText = await runPrompt(
      "category_audit.prompt",
      JSON.stringify({
        action: "DELETE",
        categoryId,
        categoryLabel: category.label,
        reason: reason.trim(),
        hasSalesData,
      })
    );

    let aiData: any;
    try {
      const normalized = aiResultText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "");
      aiData = JSON.parse(normalized);
    } catch (parseErr) {
      console.error("[Category Delete Propose] Failed to parse AI response", parseErr, aiResultText);
      return res.status(502).json({ ok: false, error: "Invalid AI response" });
    }

    // 売上データが使用されている場合は、AIが承認しても却下
    if (hasSalesData && aiData.is_valid) {
      aiData.is_valid = false;
      aiData.review_comment = `過去の売上データで使用されているため削除できません。${aiData.review_comment || ""}`;
    }

    // 提案を保存
    const { data, error } = await supabaseAdmin.from("star_proposals").insert({
      proposer_id: r.userId,
      change_type: "CATEGORY_DELETE",
      target_id: categoryId,
      new_definition: {
        categoryId,
        categoryLabel: category.label,
      },
      reason: reason.trim(),
      ai_review_comment: aiData.review_comment,
      ai_approval: aiData.is_valid ?? null,
    }).select().single();

    if (error) {
      console.error("[Category Delete Propose] DB insert error", error);
      return res.status(500).json({ ok: false, error: "Failed to save proposal" });
    }

    return res.json({ ok: true, proposal: data, aiReview: aiData });
  } catch (err: any) {
    console.error("[Category Delete Propose] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

/**
 * 総売上からカテゴリ毎の売上割合を計算し、重み係数を自動調整
 * POST /api/v1/master/categories/auto-adjust-weights
 * 
 * 全期間の総売上から各カテゴリの割合を計算し、その割合に基づいて重み係数を自動調整します。
 * 割合が高いカテゴリほど重み係数が高くなります（最大3.0、最小0.1）。
 */
masterRouter.post("/categories/auto-adjust-weights", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  try {
    // 1. 全期間の売上データを取得
    const { data: salesEvents, error: salesError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED);

    if (salesError) {
      console.error("[Auto Adjust Weights] Failed to fetch sales:", salesError);
      return res.status(500).json({ ok: false, error: "売上データの取得に失敗しました" });
    }

    // 2. カテゴリ別の売上金額を集計
    const categorySales = new Map<string, number>();
    let totalSales = 0;

    (salesEvents || []).forEach((event: any) => {
      const payload = event.payload as SalePayload;
      
      // 逆仕訳（取り消し）データは除外
      if ((payload as any).isReversal) return;

      const amount = Number(payload.amount) || 0;
      const categoryId = payload.workCategoryId || "uncategorized";
      
      const current = categorySales.get(categoryId) || 0;
      categorySales.set(categoryId, current + amount);
      totalSales += amount;
    });

    if (totalSales === 0) {
      return res.status(400).json({ ok: false, error: "売上データが存在しません" });
    }

    // 3. カテゴリマスタを取得
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from("work_categories")
      .select("*")
      .eq("is_active", true);

    if (categoriesError) {
      console.error("[Auto Adjust Weights] Failed to fetch categories:", categoriesError);
      return res.status(500).json({ ok: false, error: "カテゴリの取得に失敗しました" });
    }

    // 4. 各カテゴリの売上割合を計算し、重み係数を決定
    // 割合が高いほど重み係数が高くなる（線形変換: 0% → 0.1, 100% → 3.0）
    const updates: Array<{ id: string; oldWeight: number; newWeight: number; ratio: number }> = [];

    for (const category of categories || []) {
      const sales = categorySales.get(category.id) || 0;
      const ratio = totalSales > 0 ? sales / totalSales : 0;
      
      // 割合から重み係数を計算（0% → 0.1, 100% → 3.0）
      // ただし、データがないカテゴリは1.0のまま
      let newWeight = 1.0;
      if (sales > 0) {
        // 線形変換: ratio (0-1) → weight (0.1-3.0)
        newWeight = 0.1 + (ratio * 2.9);
        newWeight = Math.max(0.1, Math.min(3.0, newWeight)); // 範囲制限
      }

      const oldWeight = Number(category.default_weight) || 1.0;
      
      // 変更がある場合のみ更新
      if (Math.abs(oldWeight - newWeight) > 0.01) {
        updates.push({
          id: category.id,
          oldWeight,
          newWeight: Math.round(newWeight * 10) / 10, // 小数点第1位まで
          ratio: Math.round(ratio * 1000) / 10, // パーセンテージ（小数点第1位まで）
        });
      }
    }

    // 5. 重み係数を一括更新
    const updatePromises = updates.map((update) =>
      supabaseAdmin
        .from("work_categories")
        .update({ default_weight: update.newWeight })
        .eq("id", update.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter((r) => r.error);
    
    if (errors.length > 0) {
      console.error("[Auto Adjust Weights] Failed to update some categories:", errors);
      return res.status(500).json({ ok: false, error: "一部のカテゴリの更新に失敗しました" });
    }

    return res.json({
      ok: true,
      message: `${updates.length}件のカテゴリの重み係数を自動調整しました`,
      updates: updates.map((u) => ({
        categoryId: u.id,
        oldWeight: u.oldWeight,
        newWeight: u.newWeight,
        salesRatio: u.ratio,
      })),
      totalSales,
    });
  } catch (err: any) {
    console.error("[Auto Adjust Weights] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

/**
 * カテゴリ重み係数変更の申請
 * POST /api/v1/master/categories/propose-weight-change
 * Body: { categoryId: string, newWeight: number, reason: string }
 */
masterRouter.post("/categories/propose-weight-change", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { categoryId, newWeight, reason } = req.body || {};

  if (!categoryId || typeof newWeight !== "number" || !reason || reason.trim().length === 0) {
    return res.status(400).json({ ok: false, error: "categoryId, newWeight, reason は必須です" });
  }

  // 重み係数の範囲チェック
  const validatedWeight = Math.max(0.1, Math.min(10.0, newWeight));

  try {
    // カテゴリ情報を取得
    const { data: category, error: categoryError } = await supabaseAdmin
      .from("work_categories")
      .select("*")
      .eq("id", categoryId)
      .single();

    if (categoryError || !category) {
      return res.status(404).json({ ok: false, error: "カテゴリが見つかりません" });
    }

    const currentWeight = Number(category.default_weight) || 1.0;

    // AI審査
    const aiResultText = await runPrompt(
      "category_audit.prompt",
      JSON.stringify({
        action: "WEIGHT_CHANGE",
        categoryLabel: category.label,
        currentWeight,
        newWeight: validatedWeight,
        reason,
      })
    );

    let aiData: any;
    try {
      const normalized = aiResultText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "");
      aiData = JSON.parse(normalized);
    } catch (parseErr) {
      console.error("[Category Weight Propose] Failed to parse AI response", parseErr, aiResultText);
      return res.status(502).json({ ok: false, error: "Invalid AI response" });
    }

    // 提案を保存
    const { data, error } = await supabaseAdmin.from("star_proposals").insert({
      proposer_id: r.userId,
      change_type: "CATEGORY_WEIGHT",
      target_id: categoryId,
      new_definition: {
        categoryId,
        categoryLabel: category.label,
        currentWeight,
        newWeight: validatedWeight,
      },
      reason,
      ai_review_comment: aiData.review_comment,
      ai_approval: aiData.is_valid ?? null,
    }).select().single();

    if (error) {
      console.error("[Category Weight Propose] DB insert error", error);
      return res.status(500).json({ ok: false, error: "Failed to save proposal" });
    }

    return res.json({ ok: true, proposal: data, aiReview: aiData });
  } catch (err: any) {
    console.error("[Category Weight Propose] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

// スター定義一覧取得
masterRouter.get("/stars/definitions", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  try {
    const { data, error } = await r.supabase
      .from("star_definitions")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("[Star Definitions] Failed to fetch", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // テーブル構造に応じて整形
    const definitions = (data || []).map((row: any) => ({
      id: row.id,
      category: row.category,
      label: row.label,
      points: row.points,
    }));

    return res.json({ ok: true, definitions });
  } catch (err: any) {
    console.error("[Star Definitions] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

// 提案一覧取得（投票状況を含む）
masterRouter.get("/stars/proposals", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  try {
    // 提案一覧を取得（pending状態のみ、または全て）
    const { data: proposals, error: proposalsError } = await supabaseAdmin
      .from("star_proposals")
      .select("*")
      .order("created_at", { ascending: false });

    if (proposalsError) {
      console.error("[Star Proposals] Failed to fetch proposals", proposalsError);
      return res.status(500).json({ ok: false, error: proposalsError.message });
    }

    // 各提案の投票状況を取得
    const proposalsWithVotes = await Promise.all(
      (proposals || []).map(async (proposal: any) => {
        const { data: votes } = await supabaseAdmin
          .from("star_proposal_votes")
          .select("voter_id, vote")
          .eq("proposal_id", proposal.id);

        const approvals = (votes || []).filter((v: any) => v.vote === "approve").map((v: any) => v.voter_id);
        const rejections = (votes || []).filter((v: any) => v.vote === "reject").map((v: any) => v.voter_id);

        return {
          id: proposal.id,
          proposer_id: proposal.proposer_id,
          change_type: proposal.change_type,
          new_definition: proposal.new_definition,
          reason: proposal.reason,
          ai_review_comment: proposal.ai_review_comment,
          ai_approval: proposal.ai_approval,
          status: proposal.status,
          created_at: proposal.created_at,
          votes_approvers: approvals,
          votes_rejecters: rejections,
          votes_total: votes?.length || 0,
        };
      })
    );

    return res.json({ ok: true, proposals: proposalsWithVotes });
  } catch (err: any) {
    console.error("[Star Proposals] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

// 提案API: 新しいスター定義（または削除）をAI審査のうえ保存
masterRouter.post("/stars/propose", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  // definitionには { id, label, points, category } 等が含まれる想定
  const { type, definition, reason } = req.body || {};

  if (!type || !definition || !reason) {
    return res.status(400).json({ ok: false, error: "type, definition, reason are required" });
  }

  try {
    // 削除提案の場合もAIに評価させる
    const aiResultText = await runPrompt("star_audit.prompt", JSON.stringify({ type, definition, reason }));
    let aiData: any;
    try {
      const normalized = aiResultText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "");
      aiData = JSON.parse(normalized);
    } catch (parseErr) {
      console.error("[Star Propose] Failed to parse AI response", parseErr, aiResultText);
      return res.status(502).json({ ok: false, error: "Invalid AI response" });
    }

    const { data, error } = await supabaseAdmin.from("star_proposals").insert({
      proposer_id: r.userId,
      change_type: type, // 'ADD', 'ADD_CATEGORY', 'DELETE'
      new_definition: definition, // JSONB
      reason,
      ai_review_comment: aiData.review_comment,
      ai_approval: aiData.is_valid ?? null,
    }).select().single();

    if (error) {
      console.error("[Star Propose] DB insert error", error);
      return res.status(500).json({ ok: false, error: "Failed to save proposal" });
    }

    return res.json({ ok: true, proposal: data, aiReview: aiData });
  } catch (err: any) {
    console.error("[Star Propose] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

// OKR変更提案API: OKRの変更をAI審査のうえ保存
masterRouter.post("/okr/propose", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { okr, reason } = req.body || {};

  if (!okr || !reason) {
    return res.status(400).json({ ok: false, error: "okr and reason are required" });
  }

  // OKRデータの検証
  if (!okr.objective || !okr.keyResult || !okr.strategy) {
    return res.status(400).json({ ok: false, error: "okr must contain objective, keyResult, and strategy" });
  }

  try {
    // AI審査
    const aiResultText = await runPrompt("okr_audit.prompt", JSON.stringify({ okr, reason }));
    let aiData: any;
    try {
      const normalized = aiResultText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "");
      aiData = JSON.parse(normalized);
    } catch (parseErr) {
      console.error("[OKR Propose] Failed to parse AI response", parseErr, aiResultText);
      return res.status(502).json({ ok: false, error: "Invalid AI response" });
    }

    // 提案を保存（change_type: 'OKR'）
    const { data, error } = await supabaseAdmin.from("star_proposals").insert({
      proposer_id: r.userId,
      change_type: "OKR",
      new_definition: okr, // JSONB: { objective, keyResult, strategy, iconChar, themeColor, targetDimension, ... }
      reason,
      ai_review_comment: aiData.review_comment,
      ai_approval: aiData.is_valid ?? null,
    }).select().single();

    if (error) {
      console.error("[OKR Propose] DB insert error", error);
      return res.status(500).json({ ok: false, error: "Failed to save proposal" });
    }

    return res.json({ ok: true, proposal: data, aiReview: aiData });
  } catch (err: any) {
    console.error("[OKR Propose] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

// 投票API: 票を集計し閾値を超えたら自動反映 (削除対応版)
masterRouter.post("/stars/vote", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { proposalId, vote } = req.body || {};

  if (!proposalId || !["approve", "reject"].includes(vote)) {
    return res.status(400).json({ ok: false, error: "proposalId and vote (approve|reject) are required" });
  }

  try {
    // 1. 提案情報の取得
    const { data: proposal, error: fetchProposalError } = await supabaseAdmin
      .from("star_proposals")
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();

    if (fetchProposalError) {
      console.error("[Star Vote] Failed to fetch proposal", fetchProposalError);
      return res.status(500).json({ ok: false, error: "Failed to fetch proposal" });
    }
    if (!proposal) {
      return res.status(404).json({ ok: false, error: "Proposal not found" });
    }

    if (proposal.status === "approved" || proposal.status === "rejected") {
      return res.status(400).json({ ok: false, error: "Proposal already finalized" });
    }

    // 2. 票を記録（同一ユーザーは上書き）
    const { error: voteError } = await supabaseAdmin
      .from("star_proposal_votes")
      .upsert(
        {
          proposal_id: proposalId,
          voter_id: r.userId,
          vote,
        },
        { onConflict: "proposal_id,voter_id" },
      );

    if (voteError) {
      console.error("[Star Vote] Failed to upsert vote", voteError);
      return res.status(500).json({ ok: false, error: "Failed to record vote" });
    }

    // 3. 集計
    const { data: votes, error: fetchVotesError } = await supabaseAdmin
      .from("star_proposal_votes")
      .select("vote")
      .eq("proposal_id", proposalId);

    if (fetchVotesError) {
      console.error("[Star Vote] Failed to fetch votes", fetchVotesError);
      return res.status(500).json({ ok: false, error: "Failed to aggregate votes" });
    }

    const approvals = (votes || []).filter((v: any) => v.vote === "approve").length;
    const rejections = (votes || []).filter((v: any) => v.vote === "reject").length;
    
    // 自動反映判定: AI承認済み かつ 賛成票が閾値以上
    const shouldAutoApply = proposal.ai_approval === true && approvals >= STAR_VOTE_THRESHOLD;
    let autoApplied = false;

    if (shouldAutoApply) {
      // change_type に応じて処理を分岐
      if (proposal.change_type === "DELETE") {
        const targetId = proposal.new_definition?.id;

        if (targetId) {
          // star_definitionsテーブルにはidカラムが直接存在するため、eq("id", targetId)を使用
          const { error: delError } = await supabaseAdmin
            .from("star_definitions")
            .delete()
            .eq("id", targetId);

          if (delError) {
            console.error("[Star Vote] Failed to delete definition", delError);
          } else {
            autoApplied = true;
          }
        } else {
          console.warn("[Star Vote] Delete requested but no target ID found in definition");
        }
      } else if (proposal.change_type === "ADD" || proposal.change_type === "ADD_CATEGORY") {
        // 追加処理: new_definitionから必要な情報を取得して挿入
        const def = proposal.new_definition as any;
        if (!def || !def.id || !def.category || !def.label || typeof def.points !== "number") {
          console.error("[Star Vote] Invalid definition structure", def);
          return res.status(400).json({ ok: false, error: "Invalid definition structure" });
        }

        const { error: insertError } = await supabaseAdmin
          .from("star_definitions")
          .insert({
            id: def.id,
            category: def.category,
            label: def.label,
            points: def.points,
            is_active: true,
            created_by: proposal.proposer_id,
          });

        if (insertError) {
          console.error("[Star Vote] Failed to insert star_definitions", insertError);
          // 重複エラーの場合は既に存在するので成功として扱う
          if (insertError.code === "23505") { // unique_violation
            console.warn("[Star Vote] Definition already exists, treating as success");
            autoApplied = true;
          }
        } else {
          autoApplied = true;
        }
      } else if (proposal.change_type === "OKR") {
        // OKR変更処理: 新しいシーズンを反映
        const okr = proposal.new_definition as any;
        if (!okr || !okr.objective || !okr.keyResult || !okr.strategy) {
          console.error("[OKR Vote] Invalid OKR structure", okr);
          return res.status(400).json({ ok: false, error: "Invalid OKR structure" });
        }

        const now = new Date();
        const startAt = now.toISOString();
        // 6週間（42日）のシーズン期間を設定
        const endAt = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000).toISOString();

        const newSeasonData = {
          targetDimension: okr.targetDimension || "Q",
          focusKpi: "custom_okr",
          objective: okr.objective,
          keyResult: okr.keyResult,
          strategyName: okr.strategy,
          aiMessage: okr.aiMessage || okr.message || "",
          iconChar: okr.iconChar || okr.icon || "🎯",
          themeColor: okr.themeColor || okr.color || "#00639b",
          startAt,
          endAt,
        };

        // 1. 古いシーズンを無効化
        const { error: deactivateError } = await supabaseAdmin
          .from("active_seasons")
          .update({ is_active: false })
          .eq("is_active", true);

        if (deactivateError) {
          console.error("[OKR Vote] Failed to deactivate old season", deactivateError);
          return res.status(500).json({ ok: false, error: "Failed to deactivate old season" });
        }

        // 2. 新しいteam_season_definitionイベントを作成
        const { data: savedEvent, error: eventError } = await supabaseAdmin
          .from("events")
          .insert({
            user_id: proposal.proposer_id,
            kind: "team_season_definition",
            text: `【OKR変更承認】${okr.objective} / ${okr.keyResult}`,
            created_at: startAt,
            payload: newSeasonData,
          })
          .select()
          .single();

        if (eventError || !savedEvent) {
          console.error("[OKR Vote] Failed to create season event", eventError);
          return res.status(500).json({ ok: false, error: "Failed to create season event" });
        }

        // 3. active_seasonsに新しいシーズンを登録
        const { error: seasonError } = await supabaseAdmin
          .from("active_seasons")
          .insert({
            season_event_id: savedEvent.id,
            expires_at: endAt,
            is_active: true,
          });

        if (seasonError) {
          console.error("[OKR Vote] Failed to create active season", seasonError);
          return res.status(500).json({ ok: false, error: "Failed to create active season" });
        }

        autoApplied = true;
        console.log(`[OKR Vote] OKR updated: ${okr.objective}`);
      } else if (proposal.change_type === "CATEGORY_WEIGHT") {
        // カテゴリ重み係数変更処理
        const weightChange = proposal.new_definition as any;
        if (!weightChange || !weightChange.categoryId || typeof weightChange.newWeight !== "number") {
          console.error("[Category Weight Vote] Invalid weight change structure", weightChange);
          return res.status(400).json({ ok: false, error: "Invalid weight change structure" });
        }

        const { error: updateError } = await supabaseAdmin
          .from("work_categories")
          .update({ default_weight: weightChange.newWeight })
          .eq("id", weightChange.categoryId);

        if (updateError) {
          console.error("[Category Weight Vote] Failed to update category weight", updateError);
          return res.status(500).json({ ok: false, error: "Failed to update category weight" });
        }

        autoApplied = true;
        console.log(`[Category Weight Vote] Weight updated: ${weightChange.categoryLabel} ${weightChange.currentWeight} → ${weightChange.newWeight}`);
      } else if (proposal.change_type === "CATEGORY_ADD") {
        // カテゴリ追加処理
        const categoryData = proposal.new_definition as any;
        if (!categoryData || !categoryData.label) {
          console.error("[Category Add Vote] Invalid category data", categoryData);
          return res.status(400).json({ ok: false, error: "Invalid category data" });
        }

        // codeの自動生成
        const timestamp = Date.now();
        const sanitizedLabel = categoryData.label
          .trim()
          .toLowerCase()
          .replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        const code = `custom_${sanitizedLabel.slice(0, 20)}_${timestamp}`;

        const { error: insertError } = await supabaseAdmin
          .from("work_categories")
          .insert({
            code,
            label: categoryData.label.trim(),
            default_weight: categoryData.defaultWeight || 1.0,
            is_active: true,
          });

        if (insertError) {
          console.error("[Category Add Vote] Failed to insert category", insertError);
          // 重複エラーの場合は既に存在するので成功として扱う
          if (insertError.code === "23505") {
            console.warn("[Category Add Vote] Category already exists, treating as success");
            autoApplied = true;
          } else {
            return res.status(500).json({ ok: false, error: "Failed to add category" });
          }
        } else {
          autoApplied = true;
          console.log(`[Category Add Vote] Category added: ${categoryData.label}`);
        }
      } else if (proposal.change_type === "CATEGORY_DELETE") {
        // カテゴリ削除処理（論理削除）
        const categoryData = proposal.new_definition as any;
        if (!categoryData || !categoryData.categoryId) {
          console.error("[Category Delete Vote] Invalid category data", categoryData);
          return res.status(400).json({ ok: false, error: "Invalid category data" });
        }

        // 過去の売上データで使用されているか再チェック
        const { data: salesData } = await supabaseAdmin
          .from("events")
          .select("id")
          .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
          .contains("payload", { workCategoryId: categoryData.categoryId })
          .limit(1);

        if (salesData && salesData.length > 0) {
          console.warn("[Category Delete Vote] Category has sales data, cannot delete");
          return res.status(400).json({
            ok: false,
            error: "過去の売上データで使用されているため削除できません",
          });
        }

        const { error: deleteError } = await supabaseAdmin
          .from("work_categories")
          .update({ is_active: false })
          .eq("id", categoryData.categoryId);

        if (deleteError) {
          console.error("[Category Delete Vote] Failed to delete category", deleteError);
          return res.status(500).json({ ok: false, error: "Failed to delete category" });
        }

        autoApplied = true;
        console.log(`[Category Delete Vote] Category deleted: ${categoryData.categoryLabel}`);
      } else {
        console.warn("[Star Vote] Unsupported change_type:", proposal.change_type);
      }

      if (autoApplied) {
        const { error: proposalUpdateError } = await supabaseAdmin
          .from("star_proposals")
          .update({ status: "approved" })
          .eq("id", proposalId);

        if (proposalUpdateError) {
          console.error("[Star Vote] Failed to update proposal status", proposalUpdateError);
        }
      }
    }

    return res.json({
      ok: true,
      votes: {
        approvals,
        rejections,
        total: votes?.length ?? 0,
      },
      autoApplied,
    });
  } catch (err: any) {
    console.error("[Star Vote] Unexpected error", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

export default masterRouter;
