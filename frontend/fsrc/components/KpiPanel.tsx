import React, { useState } from "react";
import { Icon } from "./ui/Icon";
import { proposeOkrChange, type BanditSuggestResponse } from "../lib/api";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { useRetroGameMode } from "../hooks/useRetroGameMode";

type Props = {
  banditData?: BanditSuggestResponse | null;
  loading?: boolean;
  onOkrUpdated?: () => void; // OKR更新後のコールバック
};

export const KpiPanel: React.FC<Props> = ({ banditData, loading, onOkrUpdated }) => {
  const { showSnackbar } = useSnackbar();
  const { confirm } = useConfirm();
  const isRetroGameMode = useRetroGameMode();
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [editObjective, setEditObjective] = useState("");
  const [editKeyResult, setEditKeyResult] = useState("");
  const [editStrategy, setEditStrategy] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading || !banditData) {
    return (
      <div
        className="card"
        style={{
          padding: 24,
          textAlign: "center",
          color: "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span
          className="spinner"
          style={{
            width: 16,
            height: 16,
            border: "2px solid #cbd5e1",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span>CEO AIが経営分析中...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const okr = banditData.context?.okr || {
    objective: "Loading Strategy...",
    keyResult: "---",
    strategy: "---",
    iconChar: "⏳",
    themeColor: "#64748b",
    endAt: undefined,
  };

  const description = banditData.context?.reason || "";
  const getDaysLeft = (dateStr?: string) => {
    if (!dateStr) return null;
    const end = new Date(dateStr).getTime();
    const diff = end - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const seasonDays = getDaysLeft(okr.endAt);

  // 提案モーダルを開く
  const handleOpenProposalModal = () => {
    if (!banditData?.context?.okr) return;
    setEditObjective(banditData.context.okr.objective);
    setEditKeyResult(banditData.context.okr.keyResult);
    setEditStrategy(banditData.context.okr.strategy);
    setEditReason("");
    setIsProposalModalOpen(true);
  };

  // 提案モーダルを閉じる
  const handleCloseProposalModal = () => {
    setIsProposalModalOpen(false);
    setEditObjective("");
    setEditKeyResult("");
    setEditStrategy("");
    setEditReason("");
  };

  // OKR変更提案を送信
  const handleSubmitProposal = async () => {
    if (!editObjective.trim() || !editKeyResult.trim() || !editStrategy.trim() || !editReason.trim()) {
      showSnackbar("すべての項目を入力してください", "error");
      return;
    }

    if (await confirm("OKR変更を提案しますか？\n承認が必要です。")) {
      setIsSubmitting(true);
      try {
        await proposeOkrChange({
          okr: {
            objective: editObjective.trim(),
            keyResult: editKeyResult.trim(),
            strategy: editStrategy.trim(),
            iconChar: okr.iconChar,
            themeColor: okr.themeColor,
            targetDimension: banditData.focusDimension,
            aiMessage: banditData.context?.reason,
          },
          reason: editReason.trim(),
        });

        showSnackbar("OKR変更を提案しました！承認待ちです。", "success");
        handleCloseProposalModal();
        
        // 親コンポーネントに更新を通知
        if (onOkrUpdated) {
          onOkrUpdated();
        }
      } catch (error: any) {
        console.error("Failed to propose OKR change:", error);
        showSnackbar(error?.message || "OKR変更の提案に失敗しました", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // レトロゲームモード用の色設定
  const cardBg = isRetroGameMode ? "#1a1a2e" : "white";
  const sectionBg = isRetroGameMode ? "#0a0a0f" : "#f8fafc";
  const sectionBorder = isRetroGameMode ? "#00ffff" : "#e2e8f0";
  const badgeBg = isRetroGameMode ? "#0a0a0f" : "white";
  const badgeColor = isRetroGameMode ? "#00ff88" : "#64748b";
  const textColor = isRetroGameMode ? "#00ffff" : "#1e293b";
  const subTextColor = isRetroGameMode ? "#00ff88" : "#64748b";
  const labelColor = isRetroGameMode ? "#00ff00" : "#64748b";

  return (
    <section
      className="card"
      style={{
        background: cardBg,
        overflow: "hidden",
        position: "relative",
        borderLeft: `6px solid ${isRetroGameMode ? "#00ffff" : okr.themeColor}`,
        padding: 0,
        boxShadow: isRetroGameMode
          ? "0 0 10px rgba(0, 255, 255, 0.5), 4px 4px 0px #000000"
          : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -20,
          bottom: -20,
          fontSize: "120px",
          opacity: 0.1,
          pointerEvents: "none",
          filter: "grayscale(100%)",
          transform: "rotate(-15deg)",
        }}
      >
        {okr.iconChar}
      </div>

      <div style={{ padding: "clamp(1rem, 3vw, 1.5rem)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 800,
                color: okr.themeColor,
                background: `${okr.themeColor}15`,
                padding: "4px 10px",
                borderRadius: 99,
                marginBottom: 8,
                letterSpacing: "0.5px",
              }}
            >
              <span style={{ fontSize: 14 }}>{okr.iconChar}</span> CURRENT SEASON
              OKR
              {seasonDays !== null && (
                <span
                  style={{
                    marginLeft: 8,
                    background: badgeBg,
                    padding: "2px 8px",
                    borderRadius: isRetroGameMode ? "0" : "4px",
                    border: isRetroGameMode ? "1px solid #00ffff" : "none",
                    color: badgeColor,
                    fontSize: "10px",
                    fontWeight: 700,
                    boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
                  }}
                >
                  あと {seasonDays} 日
                </span>
              )}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(1.125rem, 4vw, 1.5rem)",
                fontWeight: 800,
                color: textColor,
                lineHeight: 1.3,
                textShadow: isRetroGameMode ? "0 0 10px rgba(0, 255, 255, 0.8)" : "none",
              }}
            >
              {okr.objective}
            </h2>
          </div>
          {/* 編集ボタン */}
          <button
            onClick={handleOpenProposalModal}
            style={{
              width: "clamp(36px, 6vw, 40px)",
              height: "clamp(36px, 6vw, 40px)",
              borderRadius: "8px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: okr.themeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = okr.themeColor;
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-surface)";
              e.currentTarget.style.color = okr.themeColor;
              e.currentTarget.style.transform = "scale(1)";
            }}
            title="OKRを変更申請"
          >
            <Icon name="edit" size={18} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              background: sectionBg,
              padding: "clamp(0.75rem, 2vw, 1rem)",
              borderRadius: isRetroGameMode ? "0" : "12px",
              border: `2px solid ${sectionBorder}`,
              boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
            }}
          >
            <div
              style={{
                fontSize: "clamp(0.625rem, 1.5vw, 0.6875rem)",
                color: labelColor,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 4,
                textShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 0, 0.6)" : "none",
              }}
            >
              Key Result (必達目標)
            </div>
            <div
              style={{
                fontSize: "clamp(1rem, 3vw, 1.125rem)",
                fontWeight: 700,
                color: isRetroGameMode ? "#00ffff" : okr.themeColor,
                textShadow: isRetroGameMode ? "0 0 8px rgba(0, 255, 255, 0.6)" : "none",
              }}
            >
              {okr.keyResult}
            </div>
          </div>

          <div
            style={{
              background: sectionBg,
              padding: "clamp(0.75rem, 2vw, 1rem)",
              borderRadius: isRetroGameMode ? "0" : "12px",
              border: `2px solid ${sectionBorder}`,
              boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
            }}
          >
            <div
              style={{
                fontSize: "clamp(0.625rem, 1.5vw, 0.6875rem)",
                color: labelColor,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 4,
                textShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 0, 0.6)" : "none",
              }}
            >
              Strategy (具体策)
            </div>
            <div
              style={{
                fontSize: "clamp(0.875rem, 2vw, 0.9375rem)",
                fontWeight: 500,
                color: isRetroGameMode ? "#00ffff" : "#334155",
                textShadow: isRetroGameMode ? "0 0 8px rgba(0, 255, 255, 0.6)" : "none",
              }}
            >
              {okr.strategy}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "12px",
            background: `${okr.themeColor}08`,
            borderRadius: "8px",
          }}
        >
          <div style={{ marginTop: 2, color: okr.themeColor }}>
            <Icon name="info" size={18} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.8125rem, 2vw, 0.875rem)",
              color: "#475569",
              lineHeight: 1.6,
              fontWeight: 500,
              fontStyle: "italic",
            }}
          >
            "{description}"
          </p>
        </div>
      </div>

      {/* OKR変更提案モーダル */}
      {isProposalModalOpen && (
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
          onClick={handleCloseProposalModal}
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
                OKR変更を提案
              </h3>
              <button
                onClick={handleCloseProposalModal}
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
              {/* 目標 (Objective) */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem"
                }}>
                  目標 (Objective)
                </label>
                <input
                  type="text"
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  placeholder="例: 地域No.1の施工品質を証明する"
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

              {/* 成果指標 (Key Result) */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem"
                }}>
                  成果指標 (Key Result)
                </label>
                <input
                  type="text"
                  value={editKeyResult}
                  onChange={(e) => setEditKeyResult(e.target.value)}
                  placeholder="例: クレーム0件 & 完了現場15件"
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

              {/* 戦略 (Strategy) */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem"
                }}>
                  戦略 (Strategy)
                </label>
                <textarea
                  value={editStrategy}
                  onChange={(e) => setEditStrategy(e.target.value)}
                  placeholder="例: ベテランと若手のペアリング強化"
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
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="なぜこのOKRを変更するのか、理由を記入してください"
                  rows={4}
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
                  onClick={handleCloseProposalModal}
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
                  onClick={handleSubmitProposal}
                  disabled={isSubmitting || !editObjective.trim() || !editKeyResult.trim() || !editStrategy.trim() || !editReason.trim()}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "8px",
                    border: "none",
                    background: okr.themeColor,
                    color: "#ffffff",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor: isSubmitting || !editObjective.trim() || !editKeyResult.trim() || !editStrategy.trim() || !editReason.trim() ? "not-allowed" : "pointer",
                    opacity: isSubmitting || !editObjective.trim() || !editKeyResult.trim() || !editStrategy.trim() || !editReason.trim() ? 0.5 : 1,
                    transition: "opacity 0.2s ease"
                  }}
                >
                  {isSubmitting ? "送信中..." : "提案する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
