import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./ui/Icon";
import { useRetroGameMode } from "../hooks/useRetroGameMode";

type TScoreSummaryProps = {
  currentStars: number;
  pendingStars?: string[]; // useDashboardDataから取得したpending情報を受け取る
};

export const TScoreSummary: React.FC<TScoreSummaryProps> = ({ currentStars, pendingStars = [] }) => {
  const isRetroGameMode = useRetroGameMode();
  const navigate = useNavigate();

  return (
    <section className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: isRetroGameMode ? "#1a1a2e" : "white", padding: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <p style={{ 
            fontSize: "11px", 
            fontWeight: "700", 
            color: isRetroGameMode ? "#00ff88" : "#64748b", 
            letterSpacing: "0.4px", 
            textTransform: "uppercase", 
            marginBottom: 4 
          }}>Technical Score</p>
          <h2 style={{ 
            fontSize: "18px", 
            fontWeight: "700", 
            margin: 0,
            color: isRetroGameMode ? "#00ffff" : undefined,
            textShadow: isRetroGameMode ? "0 0 10px rgba(0, 255, 255, 0.8)" : "none"
          }}>技術スター数</h2>
        </div>
        <div style={{ 
          background: isRetroGameMode ? "#0a0a0f" : "#e0f2fe", 
          color: isRetroGameMode ? "#00ffff" : "#0284c7", 
          padding: "4px 8px", 
          borderRadius: isRetroGameMode ? "0" : "6px",
          border: isRetroGameMode ? "1px solid #00ffff" : "none",
          boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
          fontSize: "12px", 
          fontWeight: "600" 
        }}>
          Lv. {Math.floor(currentStars / 10)}
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "16px" }}>
        <span style={{ 
          fontSize: 48, 
          fontWeight: 800, 
          color: isRetroGameMode ? "#00ffff" : "#0f172a", 
          lineHeight: 1,
          textShadow: isRetroGameMode ? "0 0 15px rgba(0, 255, 255, 0.8), 0 0 30px rgba(0, 255, 255, 0.5)" : "none"
        }}>{currentStars}</span>
        <span style={{ 
          fontSize: 14, 
          color: isRetroGameMode ? "#00ff88" : "#64748b", 
          fontWeight: 600 
        }}>/ 170 pt</span>
      </div>

      <div style={{ flex: 1 }}>
        {pendingStars && pendingStars.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingStars.map((starId: string) => (
              <div key={starId} style={{ background: isRetroGameMode ? "#0a0a0f" : "#fff7ed", padding: "8px 12px", borderRadius: isRetroGameMode ? "0" : "8px", border: isRetroGameMode ? "2px solid #00ffff" : "1px solid #fed7aa", boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="star" size={14} color={isRetroGameMode ? "#ff00ff" : "#f59e0b"} />
                <span style={{ fontSize: 12, fontWeight: 700, color: isRetroGameMode ? "#00ffff" : "#9a3412" }}>{starId.replace("star-", "").toUpperCase()} 審査中</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: isRetroGameMode ? "#00ff88" : "#94a3b8", fontSize: 12 }}>
            <Icon name="check" size={14} color={isRetroGameMode ? "#00ff88" : undefined} />
            <span>現在申請中のスキルはありません</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: "auto", textAlign: "right" }}>
        <button
          onClick={() => navigate("/tscore")}
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "4px", 
            textDecoration: "none", 
            background: "transparent",
            border: "none",
            color: isRetroGameMode ? "#00ffff" : "#2563eb", 
            fontSize: "13px", 
            fontWeight: "600", 
            padding: "8px 0",
            cursor: "pointer",
            textShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.6)" : "none",
            fontFamily: "inherit"
          }}
        >
          詳細・スター申請 <Icon name="pen" size={12} color={isRetroGameMode ? "#00ffff" : undefined} />
        </button>
      </div>
    </section>
  );
};
