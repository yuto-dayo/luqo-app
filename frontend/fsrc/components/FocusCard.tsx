import React, { useState } from "react";
import { useTheme } from "../hooks/useLuqoStore";
import { Icon } from "./ui/Icon";
import { updateMission, type BanditSuggestResponse } from "../lib/api";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useConfirm } from "../contexts/ConfirmDialogContext";
// CSS Modules を使う場合は import styles from './FocusCard.module.css'; ですが、
// ここでは既存の global.css 変数を style 属性で直接活用する形（移行期の実装）で提示します。

type Props = {
  banditData: BanditSuggestResponse | null;
  loading: boolean;
  scoreReady: boolean;
  onMissionUpdated?: () => void; // ミッション更新後のコールバック
};

// CSS変数に対応したテーママッピング
const KPI_THEME_VARS: Record<string, { color: string; bg: string; surface: string; icon: string }> = {
  LU: {
    color: "var(--color-lu-base)",
    bg: "var(--color-lu-bg)",
    surface: "var(--color-lu-surface)",
    icon: "sprout"
  },
  Q: {
    color: "var(--color-q-base)",
    bg: "var(--color-q-bg)",
    surface: "var(--color-q-surface)",
    icon: "guardian"
  },
  O: {
    color: "var(--color-o-base)",
    bg: "var(--color-o-bg)",
    surface: "var(--color-o-surface)",
    icon: "innovation"
  },
};

export const FocusCard: React.FC<Props> = ({ banditData, loading, scoreReady, onMissionUpdated }) => {
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { confirm } = useConfirm();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAction, setEditAction] = useState("");
  const [editHint, setEditHint] = useState("");
  const [editChangeReason, setEditChangeReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 編集モーダルを開く
  const handleOpenEditModal = () => {
    if (!banditData) return;
    setEditAction(banditData.suggestion.action);
    setEditHint(banditData.suggestion.luqoHint);
    setEditChangeReason("");
    setIsEditModalOpen(true);
  };

  // 編集モーダルを閉じる
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditAction("");
    setEditHint("");
    setEditChangeReason("");
  };

  // ミッション更新を送信
  const handleSubmitEdit = async () => {
    if (!editAction.trim() || !editHint.trim() || !editChangeReason.trim()) {
      showSnackbar("すべての項目を入力してください", "error");
      return;
    }

    if (await confirm("ミッションを更新しますか？\nこの操作は取り消せません。")) {
      setIsSubmitting(true);
      try {
        await updateMission({
          action: editAction.trim(),
          hint: editHint.trim(),
          changeReason: editChangeReason.trim(),
        });

        // キャッシュをクリア
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("luqo.banditMission.v1");
        }

        showSnackbar("ミッションを更新しました", "success");
        handleCloseEditModal();
        
        // 親コンポーネントに更新を通知
        if (onMissionUpdated) {
          onMissionUpdated();
        }
      } catch (error: any) {
        console.error("Failed to update mission:", error);
        showSnackbar(error?.message || "ミッションの更新に失敗しました", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // 1. データ待機状態 (Visual Only)
  if (!scoreReady) {
    return (
      <div className="card" style={{
        padding: "clamp(1rem, 4vw, 2rem)",
        background: "var(--color-surface-container-low)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--spacing-md)",
        border: "2px dashed var(--color-border)",
        color: "var(--color-text-muted)"
      }}>
        <Icon name="thinking" size={48} />
      </div>
    );
  }

  // 2. ローディング状態
  if (loading || !banditData) {
    return (
      <div className="card" style={{
        padding: "clamp(1rem, 4vw, 2rem)",
        background: "var(--color-surface-container-low)",
        minHeight: "clamp(200px, 30vh, 240px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)"
      }}>
        <div className="spinner">
          <Icon name="ai" size={32} />
        </div>
        <style>{`
          .spinner { animation: pulse 1.5s infinite ease-in-out; }
          @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.4; transform: scale(0.95); } }
        `}</style>
      </div>
    );
  }

  const focusDimension = banditData.focusDimension || "Q";
  const kpi = KPI_THEME_VARS[focusDimension];
  const action = banditData.suggestion.action;

  // テーマに応じた動的な角丸 (Shape System)
  // 'cut' は鋭角的で技術的な印象、それ以外は親しみやすい丸み
  const borderRadius = theme?.shape === "cut"
    ? "4px var(--radius-xl) 4px var(--radius-xl)"
    : "var(--radius-xl)";

  return (
    <div
      style={{
        position: "relative",
        padding: "clamp(1rem, 4vw, 2rem)",
        borderRadius: borderRadius,
        // グラデーション背景: KPIカラーから白へ
        background: `linear-gradient(135deg, ${kpi.bg} 0%, var(--color-surface) 100%)`,
        // Expressive Elevation: 色付きの拡散する影を使用
        boxShadow: "var(--shadow-xl)",
        // 境界線は色付きで薄く
        border: `1px solid color-mix(in srgb, ${kpi.color}, transparent 80%)`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "clamp(1rem, 3vw, 1.5rem)",
        transition: "all 0.4s cubic-bezier(0.2, 0, 0, 1)",
      }}
    >
      {/* Visual Texture: 背景の巨大アイコン (Abstract) */}
      <div 
        className="focus-card__bg-icon"
        style={{
          position: "absolute",
          right: "-10%",
          top: "-20%",
          opacity: 0.08,
          transform: "rotate(-10deg) scale(1.5)",
          pointerEvents: "none",
          color: kpi.color
        }}
      >
        <Icon name={kpi.icon} size={240} strokeWidth={1.5} />
        <style>{`
          @media (max-width: 600px) {
            .focus-card__bg-icon {
              display: none;
            }
          }
        `}</style>
      </div>

      {/* ヘッダーの識別バッジ（左上の色付きアイコン枠）は削除
          - カード全体の色味で十分に文脈が伝わる
          - 追加の視覚ノイズを減らす */}

      {/* Main Content: Hero Typography */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <h2 style={{
          fontSize: "clamp(1.25rem, 5vw, 2rem)", // Display Small - レスポンシブ
          fontWeight: 800,
          color: "var(--color-text-main)",
          margin: 0,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          // M3的な強調表現: テキストにわずかな影
          textShadow: "0 1px 2px rgba(255,255,255,0.5)"
        }}>
          {action}
        </h2>
      </div>

      {/* Footer: Action/Hint Area */}
      <div style={{
        marginTop: "auto",
        padding: "clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.25rem)",
        background: kpi.surface, // Tonal Surface (e.g. Pale Blue)
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-md)",
        borderLeft: `4px solid ${kpi.color}`, // アクセントライン
        color: "var(--color-text-main)",
        position: "relative"
      }}>
        <div style={{ color: kpi.color, flexShrink: 0 }}>
          <Icon name="info" size={24} />
        </div>
        <p style={{
          margin: 0,
          fontSize: "clamp(0.8125rem, 2vw, 0.9375rem)",
          fontWeight: 500,
          lineHeight: 1.5,
          color: "var(--color-text-sub)",
          flex: 1
        }}>
          {banditData.suggestion.luqoHint}
        </p>
        {/* 編集ボタン */}
        <button
          onClick={handleOpenEditModal}
          style={{
            position: "absolute",
            bottom: "clamp(0.75rem, 2vw, 1rem)",
            right: "clamp(1rem, 3vw, 1.25rem)",
            width: "clamp(36px, 6vw, 40px)",
            height: "clamp(36px, 6vw, 40px)",
            borderRadius: "8px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: kpi.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = kpi.color;
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--color-surface)";
            e.currentTarget.style.color = kpi.color;
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="ミッションを編集"
        >
          <Icon name="edit" size={18} />
        </button>
      </div>

      {/* 編集モーダル */}
      {isEditModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={handleCloseEditModal}
        >
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-xl)",
              padding: "clamp(1.5rem, 4vw, 2rem)",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "var(--shadow-xl)",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem"
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--color-text-main)"
              }}>
                ミッションを編集
              </h3>
              <button
                onClick={handleCloseEditModal}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-sub)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* フォーム */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* ミッション */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem"
                }}>
                  ミッション
                </label>
                <input
                  type="text"
                  value={editAction}
                  onChange={(e) => setEditAction(e.target.value)}
                  placeholder="例: 知人リスト10件作成"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-container-low)",
                    color: "var(--color-text-main)",
                    fontSize: "0.9375rem"
                  }}
                />
              </div>

              {/* ミッションの理由 */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem"
                }}>
                  ミッションの理由
                </label>
                <textarea
                  value={editHint}
                  onChange={(e) => setEditHint(e.target.value)}
                  placeholder="例: 即架電できる母集団をつくるため"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-container-low)",
                    color: "var(--color-text-main)",
                    fontSize: "0.9375rem",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
              </div>

              {/* 変更理由 */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem"
                }}>
                  変更理由 <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  value={editChangeReason}
                  onChange={(e) => setEditChangeReason(e.target.value)}
                  placeholder="なぜこのミッションを変更するのか、理由を記入してください"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-container-low)",
                    color: "var(--color-text-main)",
                    fontSize: "0.9375rem",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
              </div>

              {/* ボタン */}
              <div style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                marginTop: "0.5rem"
              }}>
                <button
                  onClick={handleCloseEditModal}
                  disabled={isSubmitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-container-low)",
                    color: "var(--color-text-main)",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.5 : 1
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmitEdit}
                  disabled={isSubmitting || !editAction.trim() || !editHint.trim() || !editChangeReason.trim()}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "8px",
                    border: "none",
                    background: kpi.color,
                    color: "#ffffff",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor: isSubmitting || !editAction.trim() || !editHint.trim() || !editChangeReason.trim() ? "not-allowed" : "pointer",
                    opacity: isSubmitting || !editAction.trim() || !editHint.trim() || !editChangeReason.trim() ? 0.5 : 1,
                    transition: "opacity 0.2s ease"
                  }}
                >
                  {isSubmitting ? "更新中..." : "更新する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
