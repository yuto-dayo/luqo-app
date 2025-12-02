import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { StarProposalModal } from "../components/StarProposalModal";
import { useSnackbar } from "../contexts/SnackbarContext";

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
  change_type: "ADD" | "UPDATE" | "DELETE";
  new_definition: StarDefinition;
  reason: string;
  ai_review_comment: string;
  votes_approvers?: string[]; // 簡易表示用
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
      // 本来はAPIを分けるべきですが、実装簡略化のためmaster系APIを一括取得する想定
      // 今回は仮の実装として、既存のmaster.tsにGETエンドポイントを追加したと仮定してfetchします
      // ※ 後ほど backend 側に GET /stars/definitions を追加する必要があります
      // ここではモックや直接クエリの代わりに、一旦空配列で枠を作ります
      
      // ★TODO: Backendに `router.get("/stars/definitions")` を実装してください
      // const res = await apiClient.get("/api/v1/master/stars/definitions");
      // setDefinitions(res.data);
      
      // 仮データ表示 (確認用)
      const { STAR_CATALOG } = await import("../data/starCatalog");
      setDefinitions(STAR_CATALOG); 

    } catch (e) {
      console.error(e);
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
      <header style={{ 
        padding: "16px", display: "flex", alignItems: "center", gap: 12, 
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #e2e8f0" 
      }}>
        <button onClick={() => navigate(-1)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
          <Icon name="arrowLeft" /> {/* Iconコンポーネントに arrowLeft がなければ chevronLeft で */}
        </button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>T-Score 基準管理 (DAO)</h2>
      </header>

      {/* タブ切り替え */}
      <div style={{ display: "flex", padding: "0 16px", borderBottom: "1px solid #e2e8f0", background: "white" }}>
        <TabButton label="カタログ一覧" isActive={activeTab === "catalog"} onClick={() => setActiveTab("catalog")} />
        <TabButton label={`提案・投票 (${proposals.length})`} isActive={activeTab === "voting"} onClick={() => setActiveTab("voting")} />
      </div>

      <div style={{ padding: "16px" }}>
        {activeTab === "catalog" ? (
          <CatalogView definitions={definitions} onDeletePropose={openDeleteModal} />
        ) : (
          <VotingView proposals={proposals} />
        )}
      </div>

      {/* 新規提案 FAB (Floating Action Button) */}
      <button style={{
        position: "fixed", bottom: 24, right: 24,
        width: 56, height: 56, borderRadius: 28,
        background: "#0f172a", color: "white", border: "none",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", zIndex: 20
      }} onClick={openCreateModal}>
        <Icon name="pen" size={24} color="white" />
      </button>

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
  <button onClick={onClick} style={{
    padding: "12px 0", flex: 1, border: "none", background: "transparent",
    borderBottom: isActive ? "2px solid #00639b" : "2px solid transparent",
    color: isActive ? "#00639b" : "#64748b", fontWeight: 700, cursor: "pointer",
    transition: "all 0.2s"
  }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
    <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "transparent", border: "none", cursor: "pointer"
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title} ({items.length})</span>
        <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }}>▼</span>
      </button>
      
      {isOpen && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                padding: "12px",
                background: "#f8fafc",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                border: "1px solid transparent",
                transition: "all 0.2s"
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{item.label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>ID: {item.id}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 700, color: "#00639b", fontSize: 13 }}>{item.points} pt</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePropose(item);
                  }}
                  title="削除を提案"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#cbd5e1",
                    padding: "4px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ef4444";
                    e.currentTarget.style.background = "#fee2e2";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#cbd5e1";
                    e.currentTarget.style.background = "transparent";
                  }}
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
  if (proposals.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
        <Icon name="check" size={48} />
        <p>現在、審議中の提案はありません。<br/>新しいアイデアを提案してみましょう！</p>
      </div>
    );
  }
  return <div>提案リスト実装予定...</div>;
};
