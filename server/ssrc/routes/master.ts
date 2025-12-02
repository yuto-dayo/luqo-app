import { Router } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { supabaseAdmin } from "../services/supabaseClient";
import { runPrompt } from "../services/aiPromptService";

const masterRouter = Router();
const STAR_VOTE_THRESHOLD = Number(process.env.STAR_VOTE_THRESHOLD ?? "3");

// 取引先一覧取得
masterRouter.get("/clients", async (req, res) => {
  const r = req as AuthedRequest;
  const { data, error } = await r.supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, clients: data });
});

// 取引先追加
masterRouter.post("/clients", async (req, res) => {
  const r = req as AuthedRequest;
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

// 取引先削除
masterRouter.delete("/clients/:id", async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { id } = req.params;
  const { error } = await r.supabase.from("clients").delete().eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// 提案API: 新しいスター定義（または削除）をAI審査のうえ保存
masterRouter.post("/stars/propose", async (req, res) => {
  const r = req as AuthedRequest;
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

// 投票API: 票を集計し閾値を超えたら自動反映 (削除対応版)
masterRouter.post("/stars/vote", async (req, res) => {
  const r = req as AuthedRequest;
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
          const { error: delError } = await supabaseAdmin
            .from("star_definitions")
            .delete()
            .eq("definition->>id", targetId);

          if (delError) {
            console.error("[Star Vote] Failed to delete definition", delError);
          } else {
            autoApplied = true;
          }
        } else {
          console.warn("[Star Vote] Delete requested but no target ID found in definition");
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("star_definitions")
          .insert({
            proposal_id: proposal.id,
            change_type: proposal.change_type,
            definition: proposal.new_definition,
            created_by: proposal.proposer_id,
          });

        if (insertError) {
          console.error("[Star Vote] Failed to insert star_definitions", insertError);
        } else {
          autoApplied = true;
        }
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
