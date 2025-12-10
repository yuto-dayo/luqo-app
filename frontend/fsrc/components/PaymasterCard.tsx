import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";
import { Icon } from "./ui/Icon";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import { useUserId } from "../hooks/useLuqoStore";

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
  const isRetroGameMode = useRetroGameMode();

  const [profit, setProfit] = useState(1_000_000);
  const [myTScore, setMyTScore] = useState(currentStars);
  const [days, setDays] = useState(20);
  const [profitSource, setProfitSource] = useState<"manual" | "actual" | "predicted">("manual");
  const [actualProfit, setActualProfit] = useState<number | null>(null);
  const [predictedProfit, setPredictedProfit] = useState<number | null>(null);
  const [loadingProfit, setLoadingProfit] = useState(false);

  const [teamScores, setTeamScores] = useState<number[]>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ userId: string; name: string; score: number }>>([]);
  const myUserId = useUserId();
  const [loadingStats, setLoadingStats] = useState(false);
  
  // 工事カテゴリ別の内訳データ
  const [categoryBreakdown, setCategoryBreakdown] = useState<{
    summary: { totalAmount: number; weightedScore: number; multiplier: number; salesCount: number };
    breakdown: Array<{ categoryLabel: string; totalAmount: number; weightedScore: number; weight: number; count: number }>;
  } | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isTeamRankingExpanded, setIsTeamRankingExpanded] = useState(false);

  useEffect(() => {
    if (currentStars > 0) setMyTScore(currentStars);
  }, [currentStars]);


  // 会計データを取得（実績値と予測値）
  useEffect(() => {
    const loadProfitData = async () => {
      setLoadingProfit(true);
      try {
        // 現在月の実績値を取得
        const dashboardRes = await apiClient.get<any>("/api/v1/accounting/dashboard");
        if (dashboardRes?.pl?.profit !== undefined) {
          setActualProfit(dashboardRes.pl.profit);
          // 初回のみ実績値をデフォルトに設定
          setProfit((prev) => {
            if (prev === 1_000_000) {
              return dashboardRes.pl.profit;
            }
            return prev;
          });
          setProfitSource("actual");
        }

        // 月別データと予測値を取得
        const monthlyRes = await apiClient.get<any>("/api/v1/accounting/monthly-profit");
        if (monthlyRes?.ok && monthlyRes?.predicted?.profit !== undefined) {
          setPredictedProfit(monthlyRes.predicted.profit);
        }
      } catch (e) {
        console.error("Failed to load profit data", e);
        // エラー時は手動入力にフォールバック
      } finally {
        setLoadingProfit(false);
      }
    };
    void loadProfitData();
  }, []); // 初回のみ実行

  useEffect(() => {
    const loadTeamData = async () => {
      setLoadingStats(true);
      try {
        const res = await apiClient.get<any>("/api/v1/paymaster/team-stats");
        if (res.ok && res.stats) {
          // 後方互換性: membersが存在する場合はそれを使用、なければscoresから構築
          if (Array.isArray(res.stats.members) && res.stats.members.length > 0) {
            setTeamMembers(res.stats.members);
            const scores = res.stats.members.map((m: any) => m.score);
            setTeamScores(scores);
          } else if (Array.isArray(res.stats.scores)) {
            const sorted = [...res.stats.scores].sort((a: number, b: number) => b - a);
            setTeamScores(sorted);
            // scoresからmembersを構築（名前はUnknown）
            setTeamMembers(sorted.map((score, idx) => ({
              userId: `user_${idx}`,
              name: "Unknown",
              score,
            })));
          }
        }
      } catch (e) {
        console.error("Auto import failed", e);
      } finally {
        setLoadingStats(false);
      }
    };
    void loadTeamData();
  }, []);

  // 工事カテゴリ別の内訳データを取得
  useEffect(() => {
    const loadCategoryBreakdown = async () => {
      if (!myUserId) return;
      setLoadingCategories(true);
      try {
        // 現在月を取得
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        
        const res = await apiClient.get<{
          ok: boolean;
          summary: { totalAmount: number; weightedScore: number; multiplier: number; salesCount: number };
          breakdown: Array<{ categoryLabel: string; totalAmount: number; weightedScore: number; weight: number; count: number }>;
        }>(`/api/v1/tscore/weighted-summary?month=${month}&userId=${myUserId}`);
        
        if (res.ok) {
          setCategoryBreakdown({
            summary: res.summary,
            breakdown: res.breakdown,
          });
        }
      } catch (e) {
        console.error("Failed to load category breakdown", e);
      } finally {
        setLoadingCategories(false);
      }
    };
    void loadCategoryBreakdown();
  }, [myUserId]);

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
        {/* 原資スライダー（実績値/予測値対応） */}
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "var(--color-text-main)",
                }}
              >
                {formatYen(profit)}
              </span>
              {profitSource !== "manual" && (
                <span
                  style={{
                    fontSize: 10,
                    color: profitSource === "actual" ? "#10b981" : "#f59e0b",
                    fontWeight: 600,
                  }}
                >
                  {profitSource === "actual" ? "📊 実績値" : "🔮 予測値"}
                </span>
              )}
            </div>
          </div>

          {/* データソース切り替えボタン */}
          {(actualProfit !== null || predictedProfit !== null) && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {actualProfit !== null && (
                <button
                  onClick={() => {
                    setProfit(actualProfit);
                    setProfitSource("actual");
                    showSnackbar("実績値に切り替えました", "info");
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background:
                      profitSource === "actual"
                        ? "#10b981"
                        : "var(--color-surface)",
                    color:
                      profitSource === "actual"
                        ? "white"
                        : "var(--color-text-main)",
                    borderColor:
                      profitSource === "actual"
                        ? "#10b981"
                        : "var(--color-border)",
                  }}
                >
                  📊 実績値: {formatYen(actualProfit)}
                </button>
              )}
              {predictedProfit !== null && (
                <button
                  onClick={() => {
                    setProfit(predictedProfit);
                    setProfitSource("predicted");
                    showSnackbar("予測値に切り替えました", "info");
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background:
                      profitSource === "predicted"
                        ? "#f59e0b"
                        : "var(--color-surface)",
                    color:
                      profitSource === "predicted"
                        ? "white"
                        : "var(--color-text-main)",
                    borderColor:
                      profitSource === "predicted"
                        ? "#f59e0b"
                        : "var(--color-border)",
                  }}
                >
                  🔮 予測値: {formatYen(predictedProfit)}
                </button>
              )}
              <button
                onClick={() => {
                  setProfitSource("manual");
                  showSnackbar("手動入力モード", "info");
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    profitSource === "manual"
                      ? "#64748b"
                      : "var(--color-surface)",
                  color:
                    profitSource === "manual"
                      ? "white"
                      : "var(--color-text-main)",
                  borderColor:
                    profitSource === "manual"
                      ? "#64748b"
                      : "var(--color-border)",
                }}
              >
                ✏️ 手動入力
              </button>
            </div>
          )}

          <input
            type="range"
            min={500_000}
            max={5_000_000}
            step={10_000}
            value={profit}
            onChange={(e) => {
              setProfit(Number(e.target.value));
              setProfitSource("manual");
            }}
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
          {loadingProfit && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              データ読み込み中...
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "var(--color-border)" }} />

        {/* 工事カテゴリ別 売上内訳 */}
        {categoryBreakdown && categoryBreakdown.breakdown.length > 0 && (
          <div
            style={{
              background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
              borderRadius: 16,
              padding: "20px",
              border: "1px solid #bfdbfe",
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
                <Icon name="construction" size={18} color="#0284c7" />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0c4a6e",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  工事カテゴリ別 売上内訳
                </span>
              </div>
              {categoryBreakdown.summary.multiplier !== 1.0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: categoryBreakdown.summary.multiplier > 1.0 ? "#dcfce7" : "#fee2e2",
                    color: categoryBreakdown.summary.multiplier > 1.0 ? "#166534" : "#991b1b",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span>
                    {categoryBreakdown.summary.multiplier > 1.0 ? "↑" : "↓"}
                  </span>
                  <span>
                    {categoryBreakdown.summary.multiplier > 1.0 ? "+" : ""}
                    {((categoryBreakdown.summary.multiplier - 1.0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* カテゴリ別のプログレスバー */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {categoryBreakdown.breakdown
                .sort((a, b) => b.totalAmount - a.totalAmount)
                .map((item, idx) => {
                  const percentage = categoryBreakdown.summary.totalAmount > 0
                    ? (item.totalAmount / categoryBreakdown.summary.totalAmount) * 100
                    : 0;
                  
                  // カテゴリごとの色を決定（Material 3 カラーパレット）
                  const colors = [
                    { bg: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)", text: "#1e40af" },
                    { bg: "linear-gradient(90deg, #10b981 0%, #059669 100%)", text: "#065f46" },
                    { bg: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)", text: "#92400e" },
                    { bg: "linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)", text: "#6b21a8" },
                    { bg: "linear-gradient(90deg, #ec4899 0%, #db2777 100%)", text: "#9f1239" },
                    { bg: "linear-gradient(90deg, #64748b 0%, #475569 100%)", text: "#334155" },
                  ];
                  const color = colors[idx % colors.length];

                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: color.bg,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--color-text-main)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.categoryLabel || "未分類"}
                          </span>
                          {item.weight !== 1.0 && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#64748b",
                                background: "rgba(100, 116, 139, 0.1)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              ×{item.weight.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--color-text-sub)",
                              minWidth: 50,
                              textAlign: "right",
                            }}
                          >
                            {percentage.toFixed(1)}%
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: color.text,
                              minWidth: 80,
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            ¥{item.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          background: "rgba(148, 163, 184, 0.2)",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${percentage}%`,
                            background: color.bg,
                            borderRadius: 4,
                            transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                            boxShadow: `0 0 8px ${color.text}40`,
                          }}
                        />
                      </div>
                      {item.weightedScore !== item.totalAmount && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginTop: -2,
                            paddingLeft: 20,
                          }}
                        >
                          重み付き: ¥{item.weightedScore.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* サマリー情報 */}
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "rgba(255, 255, 255, 0.6)",
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                color: "#475569",
              }}
            >
              <span style={{ fontWeight: 600 }}>
                合計売上: ¥{categoryBreakdown.summary.totalAmount.toLocaleString()}
              </span>
              <span style={{ fontWeight: 700, color: "#0284c7" }}>
                重み付きスコア: ¥{categoryBreakdown.summary.weightedScore.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {loadingCategories && (
          <div
            style={{
              background: "var(--color-surface-container-low)",
              borderRadius: 16,
              padding: "20px",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            カテゴリ内訳を読み込み中...
          </div>
        )}

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

        {/* チームランキング表示（折りたたみ可能） */}
        <div
          style={{
            background: "var(--color-surface-container-low)",
            borderRadius: 16,
            padding: "20px",
            border: "1px solid var(--color-border)",
          }}
        >
          <button
            onClick={() => setIsTeamRankingExpanded(!isTeamRankingExpanded)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              margin: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="construction" size={18} color="#64748b" />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Team Ranking
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                {loadingStats
                  ? "読み込み中..."
                  : `${teamMembers.length}名`}
              </span>
              <Icon
                name={isTeamRankingExpanded ? "chevronUp" : "chevronDown"}
                size={16}
                color="#64748b"
              />
            </div>
          </button>

          {/* ランキングリスト（折りたたみ可能） */}
          {isTeamRankingExpanded && (
            <div style={{ marginTop: 20 }}>
              {loadingStats ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
              読み込み中...
            </div>
          ) : teamMembers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teamMembers.map((member, idx) => {
                const rank = idx + 1;
                const isMe = myUserId && member.userId === myUserId;
                const isSimulated = isMe && isSimulating;
                const displayScore = isMe ? myTScore : member.score;
                const maxScore = Math.max(...teamMembers.map(m => m.score), myTScore, 170);
                
                // 報酬シミュレーション（このメンバーの場合）
                const memberEffort = calculateEffort(displayScore, days, 2.0);
                const allEfforts = teamMembers
                  .map(m => calculateEffort(isMe && m.userId === myUserId ? myTScore : m.score, days, 2.0))
                  .reduce((sum, e) => sum + e, 0);
                const memberRatio = allEfforts > 0 ? memberEffort / allEfforts : 0;
                const estimatedBasePay = Math.round(profit * memberRatio);
                const estimatedPeerPay = 0; // 簡略化のため0
                const estimatedTotalPay = estimatedBasePay + estimatedPeerPay;

                return (
                  <div
                    key={member.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 12,
                      background: isMe
                        ? isSimulated
                          ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                          : "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
                        : "var(--color-surface)",
                      border: isMe
                        ? `2px solid ${isSimulated ? "#fcd34d" : "#3b82f6"}`
                        : "1px solid var(--color-border)",
                      boxShadow: isMe ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.2s ease",
                      position: "relative",
                      cursor: "pointer",
                    }}
                    title={`${member.name}: ${displayScore}pt | 推定報酬: ${formatYen(estimatedTotalPay)}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateX(4px)";
                      e.currentTarget.style.boxShadow = isMe 
                        ? "0 4px 12px rgba(0,0,0,0.15)" 
                        : "0 2px 8px rgba(0,0,0,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = isMe ? "0 2px 8px rgba(0,0,0,0.1)" : "none";
                    }}
                  >
                    {/* 順位 */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: isMe
                          ? isSimulated
                            ? "#fbbf24"
                            : "#3b82f6"
                          : rank <= 3
                          ? "#10b981"
                          : "#e2e8f0",
                        color: isMe || rank <= 3 ? "white" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                    </div>

                    {/* 名前とスコア */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontWeight: isMe ? 700 : 600,
                              fontSize: 14,
                              color: isMe
                                ? isSimulated
                                  ? "#d97706"
                                  : "#1d4ed8"
                                : "var(--color-text-main)",
                            }}
                          >
                            {member.name}
                          </span>
                          {isMe && (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: isRetroGameMode ? 0 : 4,
                                background: isRetroGameMode
                                  ? "#0a0a0f"
                                  : isSimulated
                                  ? "#fef3c7"
                                  : "#dbeafe",
                                color: isRetroGameMode
                                  ? "#00ffff"
                                  : isSimulated
                                  ? "#d97706"
                                  : "#1d4ed8",
                                border: isRetroGameMode ? "1px solid #00ffff" : "none",
                                boxShadow: isRetroGameMode
                                  ? "0 0 5px rgba(0, 255, 255, 0.3)"
                                  : "none",
                                textShadow: isRetroGameMode
                                  ? "0 0 5px rgba(0, 255, 255, 0.6)"
                                  : "none",
                                fontWeight: 600,
                              }}
                            >
                              {isSimulating ? "シミュレーション中" : "あなた"}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                              color: isMe
                                ? isSimulated
                                  ? "#d97706"
                                  : "#1d4ed8"
                                : "var(--color-text-main)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {displayScore}
                          </span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>/ 170</span>
                        </div>
                      </div>

                      {/* スコアバー（可視化） */}
                      <div
                        style={{
                          marginTop: 8,
                          height: 6,
                          borderRadius: 3,
                          background: "var(--color-border)",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(displayScore / maxScore) * 100}%`,
                            background: isMe
                              ? isSimulated
                                ? "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)"
                                : "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)"
                              : rank <= 3
                              ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                              : "linear-gradient(90deg, #64748b 0%, #475569 100%)",
                            transition: "width 0.3s ease",
                            boxShadow: isMe ? "0 0 8px rgba(59, 130, 246, 0.3)" : "none",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* シミュレーション中の自分の位置を表示 */}
              {isSimulating && myUserId && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: "#fffbeb",
                    border: "1px solid #fcd34d",
                    fontSize: 12,
                    color: "#92400e",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>💡 シミュレーション中:</strong> あなたのスコアを{" "}
                  <strong>{myTScore}pt</strong> に設定しています。
                  {teamMembers.find((m) => m.userId === myUserId) && (
                    <span>
                      {" "}
                      現在の実力は{" "}
                      <strong>
                        {teamMembers.find((m) => m.userId === myUserId)?.score}pt
                      </strong>
                      です。
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              チームメンバーのデータがありません
              </div>
            )}
            </div>
          )}

          {!isTeamRankingExpanded && (
            <p
              style={{
                fontSize: 11,
                color: "#94a3b8",
                marginTop: 12,
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              ※ クリックしてチームランキングを表示
            </p>
          )}

          {isTeamRankingExpanded && (
            <p
              style={{
                fontSize: 11,
                color: "#94a3b8",
                marginTop: 16,
                lineHeight: 1.5,
              }}
            >
              ※ チーム全員のTスコア状況を反映しています。
              あなたが成長したとき、配分バランスがどう変化するかをシミュレートできます。
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// 既存の参照向けにエイリアスを残す
export const PaymasterPredictor = PaymasterCard;
