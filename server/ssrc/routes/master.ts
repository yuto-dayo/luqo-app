import { Router } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { supabaseAdmin } from "../services/supabaseClient";
import { runPrompt } from "../services/aiPromptService";

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
