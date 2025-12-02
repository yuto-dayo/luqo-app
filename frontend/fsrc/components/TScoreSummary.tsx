import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserId } from "../hooks/useLuqoStore";
import { apiClient } from "../lib/apiClient";
import { Icon } from "./ui/Icon";

type TScoreSummaryProps = {
  currentStars: number;
};

type TScoreState = {
  pending: string[];
};

export const TScoreSummary: React.FC<TScoreSummaryProps> = ({ currentStars }) => {
  const userId = useUserId();
  const [myState, setMyState] = useState<TScoreState | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      try {
        const res = await apiClient.get<{ ok: boolean; state: TScoreState }>(`/api/v1/tscore/state/${userId}`);
        if (res.ok) setMyState(res.state);
      } catch (e) {
        console.error(e);
      }
    };
    void fetchData();
  }, [userId]);

  return (
    <section className="card" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "white", padding: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 4 }}>Technical Score</p>
          <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>技術スター数</h2>
        </div>
        <div style={{ background: "#e0f2fe", color: "#0284c7", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
          Lv. {Math.floor(currentStars / 10)}
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "16px" }}>
        <span style={{ fontSize: 48, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{currentStars}</span>
        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>/ 170 pt</span>
      </div>

      <div style={{ flex: 1 }}>
        {myState?.pending && myState.pending.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myState.pending.map((starId: string) => (
              <div key={starId} style={{ background: "#fff7ed", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="star" size={14} color="#f59e0b" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#9a3412" }}>{starId.replace("star-", "").toUpperCase()} 審査中</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 12 }}>
            <Icon name="check" size={14} />
            <span>現在申請中のスキルはありません</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: "auto", textAlign: "right" }}>
        <Link to="/t-score" style={{ display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none", color: "#2563eb", fontSize: "13px", fontWeight: "600", padding: "8px 0" }}>
          詳細・スター申請 <Icon name="pen" size={12} />
        </Link>
      </div>
    </section>
  );
};
