import React, { useEffect, useState, useCallback } from "react";
import { apiClient } from "../lib/apiClient";
import { Icon } from "./ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";
import { fetchUserProfiles, fetchOkrProposals, voteOkrProposal, type OkrProposal } from "../lib/api";
import { loadUserNamesCache, saveUserNamesCache } from "../lib/cacheUtils";
import { useUserId } from "../hooks/useLuqoStore";

const STAR_VOTE_THRESHOLD = 3; // 承認に必要な票数

export const OkrApprovalModal: React.FC = () => {
  const userId = useUserId();
  const [proposals, setProposals] = useState<OkrProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const { showSnackbar } = useSnackbar();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchOkrProposals();
      if (res.ok) {
        // 自分が申請者でない、かつpending状態の提案のみ表示
        const pendingProposals = res.proposals.filter(
          (p) => p.proposer_id !== userId && p.status === "pending"
        );
        setProposals(pendingProposals);

        // ユーザー名を取得
        const proposerIds = pendingProposals.map((p) => p.proposer_id);
        const profilesMap: Record<string, string> = {};

        const cachedNames = loadUserNamesCache();
        Object.assign(profilesMap, cachedNames);

        pendingProposals.forEach((p) => {
          // 提案者名は後で取得
        });

        const missingUserIds = proposerIds.filter((id) => !profilesMap[id]);
        if (missingUserIds.length > 0) {
          const additionalProfiles = await fetchUserProfiles(missingUserIds);
          Object.assign(profilesMap, additionalProfiles);
        }

        saveUserNamesCache(profilesMap);
        setUserNames(profilesMap);
      }
    } catch (e) {
      console.error("Failed to fetch OKR proposals", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchData();
    // 定期的に再取得（30秒ごと）- ただし、提案がある場合のみ
    const interval = setInterval(() => {
      // 提案がある場合のみ再取得（モーダルが表示されている時のみ）
      if (proposals.length > 0) {
        void fetchData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData, proposals.length]);

  const handleVote = async (proposalId: string, vote: "approve" | "reject") => {
    try {
      const res = await voteOkrProposal({ proposalId, vote });
      if (res.ok) {
        showSnackbar(vote === "approve" ? "承認しました" : "否決しました", "success");
        if (res.autoApplied) {
          showSnackbar("OKRが承認され、反映されました！", "success");
        }
        void fetchData();
      }
    } catch (e: any) {
      console.error("Failed to vote", e);
      showSnackbar(e?.message || "投票に失敗しました", "error");
    }
  };

  // 承認待ちの提案がない場合は表示しない
  if (loading || proposals.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={() => {
        // 背景クリックで閉じる（承認待ちがある場合は閉じない）
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-xl)",
          padding: "clamp(1.5rem, 4vw, 2rem)",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)" }}>
            OKR変更の承認待ち
          </h3>
          <button
            onClick={() => setProposals([])}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-sub)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {proposals.map((proposal) => {
            const okr = proposal.new_definition;
            const proposerName = userNames[proposal.proposer_id] || proposal.proposer_id;
            const hasVoted = proposal.votes_approvers.includes(userId || "") || proposal.votes_rejecters.includes(userId || "");
            const approvalCount = proposal.votes_approvers.length;
            const rejectionCount = proposal.votes_rejecters.length;

            return (
              <div
                key={proposal.id}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "12px",
                  padding: "1rem",
                  background: "var(--color-surface-container-low)",
                }}
              >
                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-sub)", marginBottom: "0.25rem" }}>
                    申請者: {proposerName}
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-main)" }}>
                    {okr.objective}
                  </div>
                </div>

                <div style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "var(--color-text-sub)" }}>
                  <div><strong>成果指標:</strong> {okr.keyResult}</div>
                  <div><strong>戦略:</strong> {okr.strategy}</div>
                </div>

                {proposal.ai_review_comment && (
                  <div
                    style={{
                      padding: "0.75rem",
                      background: proposal.ai_approval ? "#f0fdf4" : "#fef2f2",
                      borderRadius: "8px",
                      marginBottom: "0.75rem",
                      fontSize: "0.875rem",
                      color: "var(--color-text-sub)",
                    }}
                  >
                    <strong>AI審査:</strong> {proposal.ai_review_comment}
                  </div>
                )}

                <div style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "var(--color-text-sub)" }}>
                  <strong>変更理由:</strong> {proposal.reason}
                </div>

                <div style={{ marginBottom: "0.75rem", fontSize: "0.75rem", color: "var(--color-text-sub)" }}>
                  承認: {approvalCount}票 / 否決: {rejectionCount}票
                  {approvalCount >= STAR_VOTE_THRESHOLD && proposal.ai_approval && (
                    <span style={{ color: "#16a34a", marginLeft: "0.5rem" }}>✓ 承認条件達成</span>
                  )}
                </div>

                {!hasVoted && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleVote(proposal.id, "approve")}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "#16a34a",
                        color: "#ffffff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      承認
                    </button>
                    <button
                      onClick={() => handleVote(proposal.id, "reject")}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "#dc2626",
                        color: "#ffffff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      否決
                    </button>
                  </div>
                )}

                {hasVoted && (
                  <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "8px", fontSize: "0.875rem", color: "var(--color-text-sub)" }}>
                    あなたは既に投票済みです
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
