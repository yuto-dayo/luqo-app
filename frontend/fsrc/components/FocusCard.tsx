import React from "react";
import { useTheme } from "../hooks/useLuqoStore";
import { Icon } from "./ui/Icon";
import type { BanditSuggestResponse } from "../lib/api";
// CSS Modules を使う場合は import styles from './FocusCard.module.css'; ですが、
// ここでは既存の global.css 変数を style 属性で直接活用する形（移行期の実装）で提示します。

type Props = {
  banditData: BanditSuggestResponse | null;
  loading: boolean;
  scoreReady: boolean;
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

export const FocusCard: React.FC<Props> = ({ banditData, loading, scoreReady }) => {
  const theme = useTheme();

  const getDaysLeft = (dateStr?: string) => {
    if (!dateStr) return null;
    const end = new Date(dateStr).getTime();
    const diff = end - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
  const missionDays = getDaysLeft(banditData?.suggestion?.missionEndAt);

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

      {/* Header Area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>

        {/* Dimension Indicator */}
        <div style={{
          width: "clamp(40px, 8vw, 48px)",
          height: "clamp(40px, 8vw, 48px)",
          borderRadius: "12px", // Medium Shape
          background: kpi.color,
          color: "#ffffff", // アイコンは白抜き
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)" // 浮遊感
        }}>
          <Icon name={kpi.icon} size={28} />
        </div>

        {/* AI Status Badge */}
        <div style={{ display: "flex", gap: "8px" }}>
          {missionDays !== null && (
            <div style={{
              padding: "6px 12px",
              borderRadius: "99px",
              background: "rgba(255,255,255,0.9)",
              color: missionDays <= 3 ? "#ef4444" : "#64748b",
              fontSize: "12px",
              fontWeight: 700,
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
            }}>
              残り {missionDays} 日
            </div>
          )}
          <div style={{
            padding: "6px 12px",
            borderRadius: "99px",
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <Icon name="ai" size={16} color={kpi.color} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: kpi.color }} />
          </div>
        </div>
      </div>

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
        color: "var(--color-text-main)"
      }}>
        <div style={{ color: kpi.color, flexShrink: 0 }}>
          <Icon name="info" size={24} />
        </div>
        <p style={{
          margin: 0,
          fontSize: "clamp(0.8125rem, 2vw, 0.9375rem)",
          fontWeight: 500,
          lineHeight: 1.5,
          color: "var(--color-text-sub)"
        }}>
          {banditData.suggestion.luqoHint}
        </p>
      </div>
    </div>
  );
};
