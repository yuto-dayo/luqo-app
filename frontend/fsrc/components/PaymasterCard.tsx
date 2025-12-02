import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";
import { Icon } from "./ui/Icon";

type Props = {
  currentStars?: number;
};

const MAX_STARS = 170;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// 単一メンバーの努力値を計算
const calculateEffort = (score: number, days: number, p: number) => {
  const norm = clamp(score, 0, MAX_STARS) / MAX_STARS;
  const combo = Math.pow(norm, p) * 100;
  return days * combo;
};

type SimulationInput = {
  profit: number;
  mySimulatedScore: number;
  myRealScore: number;
  days: number;
  teamScores: number[];
  peerUnit?: number;
  p?: number;
};

const usePayrollSimulation = ({
  profit,
  mySimulatedScore,
  myRealScore,
  days,
  teamScores,
  peerUnit = 500,
  p = 2.0,
}: SimulationInput) =>
  useMemo(() => {
    const otherScores = [...teamScores];
    const myIndex = otherScores.indexOf(myRealScore);
    if (myIndex !== -1) {
      otherScores.splice(myIndex, 1);
    }

    const myEffort = calculateEffort(mySimulatedScore, days, p);
    const othersEffort = otherScores.reduce(
      (sum, score) => sum + calculateEffort(score, days, p),
      0,
    );
    const totalEffort = myEffort + othersEffort;

    const ratio = totalEffort > 0 ? myEffort / totalEffort : 0;
    const basePay = Math.round(profit * ratio);
    const peerPay = otherScores.length * peerUnit;
    const totalPay = basePay + peerPay;

    return { totalPay, basePay, peerPay, ratio, otherScores };
  }, [profit, mySimulatedScore, myRealScore, days, teamScores, peerUnit, p]);

const formatYen = (value: number) => `¥${Math.round(value).toLocaleString()}`;

export const PaymasterCard: React.FC<Props> = ({ currentStars = 0 }) => {
  const { showSnackbar } = useSnackbar();

  const [profit, setProfit] = useState(1_000_000);
  const [myTScore, setMyTScore] = useState(currentStars);
  const [days, setDays] = useState(20);

  const [teamScores, setTeamScores] = useState<number[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (currentStars > 0) setMyTScore(currentStars);
  }, [currentStars]);

  useEffect(() => {
    const loadTeamData = async () => {
      setLoadingStats(true);
      try {
        const res = await apiClient.get<any>("/api/v1/paymaster/team-stats");
        if (res.ok && res.stats && Array.isArray(res.stats.scores)) {
          const sorted = [...res.stats.scores].sort((a: number, b: number) => b - a);
          setTeamScores(sorted);
        }
      } catch (e) {
        console.error("Auto import failed", e);
      } finally {
        setLoadingStats(false);
      }
    };
    void loadTeamData();
  }, []);

  const prediction = usePayrollSimulation({
    profit,
    mySimulatedScore: myTScore,
    myRealScore: currentStars,
    days,
    teamScores,
  });

  const isSimulating = myTScore !== currentStars;
  const resetTScore = () => {
    setMyTScore(currentStars);
    showSnackbar("現在の実力値に戻しました", "info");
  };

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {/* 1. ヒーロー表示 */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "white",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: 0.8,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          <Icon name="payments" size={16} />
          ESTIMATED REWARD
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "12px 0",
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {formatYen(prediction.totalPay)}
        </div>

        <div
          style={{
            display: "inline-flex",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "8px 16px",
            fontSize: 13,
            gap: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <span style={{ display: "flex", gap: 4 }}>
            <span style={{ opacity: 0.7 }}>Base:</span>
            <strong>{formatYen(prediction.basePay)}</strong>
          </span>
          <span style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ display: "flex", gap: 4, color: "#fbbf24" }}>
            <span style={{ opacity: 0.9 }}>Peer:</span>
            <strong>{formatYen(prediction.peerPay)}</strong>
          </span>
        </div>
      </div>

      {/* 2. コントロールエリア */}
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        }}
      >
        {/* 原資スライダー */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
              alignItems: "flex-end",
            }}
          >
            <label
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-text-sub)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="money" size={18} />
              現場純利益 (The Pot)
            </label>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--color-text-main)",
              }}
            >
              {formatYen(profit)}
            </span>
          </div>
          <input
            type="range"
            min={500_000}
            max={5_000_000}
            step={10_000}
            value={profit}
            onChange={(e) => setProfit(Number(e.target.value))}
            style={{
              width: "100%",
              accentColor: "#0f172a",
              height: 6,
              cursor: "pointer",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            <span>¥50万</span>
            <span>¥500万</span>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--color-border)" }} />

        {/* 個人パラメータ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-text-sub)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon
                  name="star"
                  size={18}
                  color={isSimulating ? "#d97706" : "var(--color-text-sub)"}
                />
                My T-Score
                {isSimulating && (
                  <span
                    style={{
                      fontSize: 10,
                      background: "#fffbeb",
                      color: "#d97706",
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid #fcd34d",
                    }}
                  >
                    シミュレーション中
                  </span>
                )}
              </label>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: isSimulating
                      ? "#d97706"
                      : "var(--color-text-main)",
                  }}
                >
                  {myTScore}
                </span>
                <span style={{ fontSize: 12, marginLeft: 4, color: "#94a3b8" }}>
                  / 170
                </span>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={170}
              value={myTScore}
              onChange={(e) => setMyTScore(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: isSimulating
                  ? "#d97706"
                  : "var(--color-text-main)",
                cursor: "pointer",
              }}
            />

            {isSimulating && (
              <button
                onClick={resetTScore}
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#64748b",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                現在の実力 ({currentStars}pt) に戻す
              </button>
            )}
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-text-sub)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="timer" size={18} />
                稼働日数
              </label>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>{days}</span>
                <span style={{ fontSize: 12, marginLeft: 4, color: "#94a3b8" }}>
                  days
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={31}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "var(--color-text-main)",
                cursor: "pointer",
              }}
            />
          </div>
        </div>

        {/* チーム分布の可視化 */}
        <div
          style={{
            background: "var(--color-surface-container-low)",
            borderRadius: 16,
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="construction" size={18} color="#64748b" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                }}
              >
                Team Distribution
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {loadingStats
                ? "読み込み中..."
                : `${prediction.otherScores.length + 1}名が稼働中`}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: isSimulating ? "#fffbeb" : "#eff6ff",
                border: `1px solid ${isSimulating ? "#fcd34d" : "#bfdbfe"}`,
                color: isSimulating ? "#d97706" : "#1d4ed8",
                fontWeight: 700,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <Icon name="star" size={12} />
              {myTScore} <span style={{ fontSize: 10, opacity: 0.8 }}>(Me)</span>
            </div>

            {prediction.otherScores.map((score, idx) => (
              <div
                key={idx}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: "white",
                  border: "1px solid #e2e8f0",
                  color: "#64748b",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {score}
              </div>
            ))}

            {prediction.otherScores.length === 0 && !loadingStats && (
              <span
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  fontStyle: "italic",
                }}
              >
                No other members active
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: 11,
              color: "#94a3b8",
              marginTop: 12,
              lineHeight: 1.4,
            }}
          >
            ※ チーム全員のTスコア状況を反映しています。
            あなたが成長したとき、配分バランスがどう変化するかをシミュレートできます。
          </p>
        </div>
      </div>
    </div>
  );
};

// 既存の参照向けにエイリアスを残す
export const PaymasterPredictor = PaymasterCard;
