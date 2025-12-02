import React from "react";
import { Icon } from "./ui/Icon";
import type { BanditSuggestResponse } from "../lib/api";

type Props = {
  banditData?: BanditSuggestResponse | null;
  loading?: boolean;
};

export const KpiPanel: React.FC<Props> = ({ banditData, loading }) => {
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

  return (
    <section
      className="card"
      style={{
        background: "white",
        overflow: "hidden",
        position: "relative",
        borderLeft: `6px solid ${okr.themeColor}`,
        padding: 0,
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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
                    background: "white",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    color: "#64748b",
                    fontSize: "10px",
                    fontWeight: 700,
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
                color: "#1e293b",
                lineHeight: 1.3,
              }}
            >
              {okr.objective}
            </h2>
          </div>
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
              background: "#f8fafc",
              padding: "clamp(0.75rem, 2vw, 1rem)",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "clamp(0.625rem, 1.5vw, 0.6875rem)",
                color: "#64748b",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Key Result (必達目標)
            </div>
            <div
              style={{
                fontSize: "clamp(1rem, 3vw, 1.125rem)",
                fontWeight: 700,
                color: okr.themeColor,
              }}
            >
              {okr.keyResult}
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              padding: "clamp(0.75rem, 2vw, 1rem)",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "clamp(0.625rem, 1.5vw, 0.6875rem)",
                color: "#64748b",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Strategy (具体策)
            </div>
            <div
              style={{
                fontSize: "clamp(0.875rem, 2vw, 0.9375rem)",
                fontWeight: 500,
                color: "#334155",
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
    </section>
  );
};
