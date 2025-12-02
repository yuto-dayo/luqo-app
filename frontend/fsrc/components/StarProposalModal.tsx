import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";
import { Icon } from "./ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";

type StarDefinition = {
  id: string;
  category: string;
  label: string;
  points: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  targetItem?: StarDefinition | null;
  onSuccess: () => void;
};

type Mode = "item" | "category";

export const StarProposalModal: React.FC<Props> = ({ isOpen, onClose, categories, targetItem, onSuccess }) => {
  const [mode, setMode] = useState<Mode>("item");
  const [loading, setLoading] = useState(false);
  const { showSnackbar } = useSnackbar();

  const isDeleteMode = !!targetItem;

  const [label, setLabel] = useState("");
  const [points, setPoints] = useState(1);
  const [parentCategory, setParentCategory] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (targetItem) {
      setLabel(targetItem.label);
      setPoints(targetItem.points);
      setParentCategory(targetItem.category);
      setReason("");
    } else {
      setLabel("");
      setPoints(1);
      setReason("");
      if (categories.length > 0) setParentCategory(categories[0]);
    }
  }, [isOpen, targetItem, categories]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showSnackbar("提案理由を入力してください", "error");
      return;
    }
    if (!isDeleteMode && !label.trim()) {
      showSnackbar("名称を入力してください", "error");
      return;
    }

    setLoading(true);
    try {
      const definition = isDeleteMode
        ? targetItem
        : mode === "item"
          ? { label, points, category: parentCategory, id: `new-${Date.now()}` }
          : { label, category: "root", id: `cat-${Date.now()}` };

      const type = isDeleteMode ? "DELETE" : mode === "item" ? "ADD" : "ADD_CATEGORY";

      const res = await apiClient.post<{ ok: boolean }>("/api/v1/master/stars/propose", {
        type,
        definition,
        reason
      });

      if (res.ok) {
        const actionLabel = isDeleteMode ? "削除提案" : "提案";
        showSnackbar(`${actionLabel}を送信しました！AI審査に入ります。`, "success");
        onSuccess();
        handleClose();
      }
    } catch (e) {
      console.error(e);
      showSnackbar("送信に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  const themeColor = isDeleteMode ? "#b91c1c" : "#00639b";
  const themeBg = isDeleteMode ? "#fef2f2" : "#f8fafc";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "480px",
          padding: "24px",
          borderRadius: "28px",
          background: "#ffffff",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          animation: "scaleIn 0.3s cubic-bezier(0.2, 0, 0, 1)",
          borderTop: `8px solid ${themeColor}`
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: isDeleteMode ? themeColor : "#1e293b" }}>
            {isDeleteMode ? "削除の提案" : "新規提案"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
            {isDeleteMode ? "この項目を廃止・削除する理由を説明してください" : "新しい評価基準をDAOに提案します"}
          </p>
        </div>

        {!isDeleteMode && (
          <div
            style={{
              background: "#f1f5f9",
              borderRadius: "99px",
              padding: "4px",
              display: "flex",
              position: "relative",
              isolate: "isolate"
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "4px",
                top: "4px",
                bottom: "4px",
                width: "calc(50% - 4px)",
                background: "white",
                borderRadius: "99px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                transform: mode === "item" ? "translateX(0%)" : "translateX(100%)",
                transition: "transform 0.3s cubic-bezier(0.2, 0, 0, 1)",
                zIndex: -1
              }}
            />
            <button onClick={() => setMode("item")} style={{ ...toggleBtnStyle, color: mode === "item" ? "#0f172a" : "#64748b" }}>
              ⭐️ 小分類
            </button>
            <button onClick={() => setMode("category")} style={{ ...toggleBtnStyle, color: mode === "category" ? "#0f172a" : "#64748b" }}>
              📂 大分類
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isDeleteMode && (
            <div
              style={{
                background: themeBg,
                padding: "12px",
                borderRadius: "12px",
                border: `1px solid ${themeColor}30`,
                display: "flex",
                gap: "12px",
                alignItems: "center"
              }}
            >
              <div style={{ color: themeColor }}>
                <Icon name="trash" size={24} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: themeColor, textTransform: "uppercase" }}>TARGET TO DELETE</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{label}</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Category: {parentCategory} / {points}pt
                </div>
              </div>
            </div>
          )}

          {!isDeleteMode && (
            <>
              {mode === "item" && (
                <div className="fadeIn">
                  <label style={labelStyle}>親カテゴリ</label>
                  <select value={parentCategory} onChange={(e) => setParentCategory(e.target.value)} style={inputStyle}>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>{mode === "item" ? "スキル名" : "カテゴリ名"}</label>
                <input type="text" placeholder="名称を入力" value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
              </div>
              {mode === "item" && (
                <div className="fadeIn">
                  <label style={labelStyle}>
                    設定ポイント: <span style={{ fontSize: 16, color: themeColor }}>{points}pt</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    style={{ width: "100%", accentColor: themeColor, cursor: "pointer" }}
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label style={labelStyle}>{isDeleteMode ? "削除・廃止の理由 (必須)" : "提案理由 (必須)"}</label>
            <textarea
              placeholder={isDeleteMode ? "例: 現在の工法では使われていないため / ○○と重複しているため" : "提案の背景を入力..."}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical", borderColor: isDeleteMode ? "#fecaca" : "#e2e8f0" }}
              autoFocus={isDeleteMode}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "99px",
              border: "none",
              background: "#f1f5f9",
              color: "#64748b",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "99px",
              border: "none",
              background: themeColor,
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 4px 12px ${themeColor}50`,
              opacity: loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            {loading ? "送信中..." : isDeleteMode ? "削除を提案" : "提案する"}
            {!loading && <Icon name={isDeleteMode ? "trash" : "sendPlane"} size={18} />}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .fadeIn { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "6px",
  display: "block",
  letterSpacing: "0.02em"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  fontSize: "14px",
  outline: "none",
  color: "#1e293b",
  fontWeight: 500,
  transition: "all 0.2s"
};

const toggleBtnStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  background: "transparent",
  padding: "10px",
  borderRadius: "99px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  transition: "color 0.2s"
};
