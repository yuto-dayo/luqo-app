import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { StarProposalModal } from "../components/StarProposalModal";
import { useSnackbar } from "../contexts/SnackbarContext";
import { apiClient } from "../lib/apiClient";
import styles from "./StarSettingsPage.module.css";

// 型定義
type StarDefinition = {
  id: string;
  category: string;
  label: string;
  points: number;
};

type Proposal = {
  id: string;
  proposer_id: string;
  change_type: "ADD" | "UPDATE" | "DELETE" | "ADD_CATEGORY";
  new_definition: StarDefinition;
  reason: string;
  ai_review_comment: string;
  ai_approval: boolean | null;
  status: string;
  created_at: string;
  votes_approvers?: string[];
  votes_rejecters?: string[];
  votes_total?: number;
};

export default function StarSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"catalog" | "voting">("catalog");
  const [definitions, setDefinitions] = useState<StarDefinition[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<StarDefinition | null>(null);
  const { showSnackbar } = useSnackbar();

  // データ取得
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // スター定義一覧を取得
      const definitionsRes = await apiClient.get<{ ok: boolean; definitions: StarDefinition[] }>(
        "/api/v1/master/stars/definitions"
      );
      if (definitionsRes.ok && definitionsRes.definitions) {
        setDefinitions(definitionsRes.definitions);
      } else {
        // フォールバック: 仮データを表示
        const { STAR_CATALOG } = await import("../data/starCatalog");
        setDefinitions(STAR_CATALOG);
      }

      // 提案一覧を取得
      const proposalsRes = await apiClient.get<{ ok: boolean; proposals: Proposal[] }>(
        "/api/v1/master/stars/proposals"
      );
      if (proposalsRes.ok && proposalsRes.proposals) {
        // pending状態の提案のみ表示（または全て表示）
        const pendingProposals = proposalsRes.proposals.filter(
          (p) => p.status === "pending" || p.status === "approved" || p.status === "rejected"
        );
        setProposals(pendingProposals);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      // エラー時もフォールバックデータを表示
      try {
        const { STAR_CATALOG } = await import("../data/starCatalog");
        setDefinitions(STAR_CATALOG);
      } catch (fallbackError) {
        console.error("Failed to load fallback data:", fallbackError);
      }
    }
  };

  const categories = useMemo(() => {
    const set = new Set(definitions.map((d) => d.category));
    return Array.from(set);
  }, [definitions]);

  const openCreateModal = () => {
    setTargetItem(null);
    setIsModalOpen(true);
  };

  const openDeleteModal = (item: StarDefinition) => {
    setTargetItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* ヘッダー */}
      <header className={styles.pageHeader}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          <Icon name="arrowLeft" />
        </button>
        <h2 className={styles.pageTitle}>T-Score 基準管理 (DAO)</h2>
      </header>

      {/* タブ切り替え */}
      <div className={styles.tabContainer}>
        <TabButton label="カタログ一覧" isActive={activeTab === "catalog"} onClick={() => setActiveTab("catalog")} />
        <TabButton label={`提案・投票 (${proposals.length})`} isActive={activeTab === "voting"} onClick={() => setActiveTab("voting")} />
      </div>

      <div className={styles.content}>
        {activeTab === "catalog" ? (
          <CatalogView definitions={definitions} onDeletePropose={openDeleteModal} />
        ) : (
          <VotingView proposals={proposals} />
        )}
      </div>

      {/* 新規提案 FAB - Portalでbody直下に配置 */}
      {typeof document !== "undefined" &&
        createPortal(
          <button onClick={openCreateModal} className={styles.fab} aria-label="新規提案">
            <Icon name="pen" size={24} color="var(--color-on-seed)" />
          </button>,
          document.body
        )}

      <StarProposalModal
        isOpen={isModalOpen}
        onClose={closeModal}
        categories={categories}
        targetItem={targetItem}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}

// --- サブコンポーネント ---

const TabButton = ({ label, isActive, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ""}`}
  >
    {label}
  </button>
);

const CatalogView = ({ definitions, onDeletePropose }: { definitions: StarDefinition[]; onDeletePropose: (item: StarDefinition) => void }) => {
  // カテゴリごとにグループ化
  const grouped = definitions.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {} as Record<string, StarDefinition[]>);

  return (
    <div className={styles.catalogContainer}>
      {Object.entries(grouped).map(([cat, items]) => (
        <CategoryAccordion 
          key={cat} 
          title={cat === "putty" ? "パテ処理 (Putty)" : cat === "cloth" ? "クロス施工 (Cloth)" : cat} 
          items={items}
          onDeletePropose={onDeletePropose}
        />
      ))}
    </div>
  );
};

const CategoryAccordion = ({ title, items, onDeletePropose }: { title: string; items: StarDefinition[]; onDeletePropose: (item: StarDefinition) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={styles.categoryAccordion}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.categoryHeader}
      >
        <span className={styles.categoryTitle}>{title} ({items.length})</span>
        <span className={`${styles.categoryIcon} ${isOpen ? styles.categoryIconOpen : ""}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className={styles.categoryContent}>
          {items.map(item => (
            <div key={item.id} className={styles.itemCard}>
              <div className={styles.itemInfo}>
                <div className={styles.itemLabel}>{item.label}</div>
                <div className={styles.itemId}>ID: {item.id}</div>
              </div>
              <div className={styles.itemActions}>
                <span className={styles.itemPoints}>{item.points} pt</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePropose(item);
                  }}
                  title="削除を提案"
                  className={styles.deleteButton}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VotingView = ({ proposals }: { proposals: Proposal[] }) => {
  const { showSnackbar } = useSnackbar();
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);

  // 投票処理
  const handleVote = async (proposalId: string, vote: "approve" | "reject") => {
    if (votingProposalId) return; // 投票中は無視

    setVotingProposalId(proposalId);
    try {
      const res = await apiClient.post<{ ok: boolean; autoApplied?: boolean }>(
        "/api/v1/master/stars/vote",
        { proposalId, vote }
      );

      if (res.ok) {
        showSnackbar(
          res.autoApplied
            ? "投票が完了し、提案が自動的に承認されました！"
            : "投票が完了しました",
          "success"
        );
        // データを再取得
        window.location.reload(); // 簡易実装: ページをリロード
      }
    } catch (e: any) {
      console.error("Vote error:", e);
      showSnackbar(e?.data?.error || "投票に失敗しました", "error");
    } finally {
      setVotingProposalId(null);
    }
  };

  // ステータスに応じた色を返す
  const getStatusColor = (status: string) => {
    if (status === "approved") return "#10b981";
    if (status === "rejected") return "#ef4444";
    return "#f59e0b";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "承認済み";
    if (status === "rejected") return "却下";
    return "審議中";
  };

  if (proposals.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Icon name="check" size={48} />
        <p>現在、審議中の提案はありません。<br/>新しいアイデアを提案してみましょう！</p>
      </div>
    );
  }

  return (
    <div className={styles.votingContainer}>
      {proposals.map((proposal) => {
        const isVoting = votingProposalId === proposal.id;
        const changeTypeLabel =
          proposal.change_type === "ADD"
            ? "追加"
            : proposal.change_type === "DELETE"
              ? "削除"
              : proposal.change_type === "ADD_CATEGORY"
                ? "カテゴリ追加"
                : "更新";

        return (
          <div key={proposal.id} className={styles.proposalCard}>
            {/* ヘッダー */}
            <div className={styles.proposalHeader}>
              <div className={styles.proposalHeaderLeft}>
                <div className={styles.badgeGroup}>
                  <span className={styles.badge}>
                    {changeTypeLabel}
                  </span>
                  <span
                    className={styles.badgeStatus}
                    style={{
                      color: getStatusColor(proposal.status),
                      background: `${getStatusColor(proposal.status)}15`,
                    }}
                  >
                    {getStatusLabel(proposal.status)}
                  </span>
                </div>
                {proposal.change_type !== "DELETE" && proposal.new_definition && (
                  <div style={{ marginTop: 8 }}>
                    <div className={styles.proposalTitle}>
                      {proposal.new_definition.label}
                    </div>
                    <div className={styles.proposalSubtitle}>
                      {proposal.new_definition.category} / {proposal.new_definition.points}pt
                    </div>
                  </div>
                )}
                {proposal.change_type === "DELETE" && proposal.new_definition && (
                  <div style={{ marginTop: 8 }}>
                    <div className={styles.proposalTitle} style={{ color: "#ef4444" }}>
                      削除対象: {proposal.new_definition.label}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 提案理由 */}
            <div className={styles.proposalReasonBox}>
              <div className={styles.proposalReasonLabel}>
                提案理由
              </div>
              <div className={styles.proposalReasonText}>
                {proposal.reason}
              </div>
            </div>

            {/* AI審査コメント */}
            {proposal.ai_review_comment && (
              <div className={styles.aiCommentBox}>
                <div className={styles.aiCommentLabel}>
                  AI審査コメント
                </div>
                <div className={styles.aiCommentText}>
                  {proposal.ai_review_comment}
                </div>
                <div className={styles.aiCommentStatus}>
                  AI判定: {proposal.ai_approval === true ? "✅ 承認" : proposal.ai_approval === false ? "❌ 却下" : "⏳ 保留"}
                </div>
              </div>
            )}

            {/* 投票状況 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className={styles.voteInfo}>
                賛成: {proposal.votes_approvers?.length || 0}票 / 反対: {proposal.votes_rejecters?.length || 0}票
                {proposal.votes_total !== undefined && ` (合計: ${proposal.votes_total}票)`}
              </div>
            </div>

            {/* 投票ボタン（審議中のみ表示） */}
            {proposal.status === "pending" && (
              <div className={styles.voteButtons}>
                <button
                  onClick={() => handleVote(proposal.id, "approve")}
                  disabled={isVoting}
                  className={`${styles.voteButton} ${styles.voteButtonApprove}`}
                >
                  {isVoting ? "投票中..." : "✅ 賛成"}
                </button>
                <button
                  onClick={() => handleVote(proposal.id, "reject")}
                  disabled={isVoting}
                  className={`${styles.voteButton} ${styles.voteButtonReject}`}
                >
                  {isVoting ? "投票中..." : "❌ 反対"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
