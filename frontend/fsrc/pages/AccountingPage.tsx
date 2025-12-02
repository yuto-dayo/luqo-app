import React, { useEffect, useState, useMemo, useCallback } from "react";
import { apiClient } from "../lib/apiClient";
import { SalesInputModal } from "../components/accounting/SalesInputModal";
import type { AccountingDashboardData, HistoryItem } from "../types/accounting";
import { Icon } from "../components/ui/Icon";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useAccountingRealtime } from "../hooks/useAccountingRealtime";
import { fetchUserProfiles } from "../lib/api";

// 日付フォーマット用ヘルパー
const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return "日付不明";
  const target = new Date(dateStr);
  const now = new Date();
  
  // 時間をリセットして日付比較
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (targetDay.getTime() === today.getTime()) return "今日 🔥";
  if (targetDay.getTime() === yesterday.getTime()) return "昨日";
  
  // それ以外は "11/25 (月)" の形式
  return target.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
};

export default function AccountingPage() {
  const [data, setData] = useState<AccountingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // リアルタイム更新時のローディング（サイレント）
  const [userNames, setUserNames] = useState<Record<string, string>>({}); // userId -> name のマップ
  const { confirm } = useConfirm();
  const { showSnackbar } = useSnackbar();

  // データ取得関数（useCallbackでメモ化してRealtimeフックから参照可能に）
  const fetchData = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const res = await apiClient.get<AccountingDashboardData>("/api/v1/accounting/dashboard");
      setData(res);
      
      // ユーザー名を取得
      if (res.opsRanking && res.opsRanking.length > 0) {
        const userIds = res.opsRanking.map((rank) => rank.userId);
        const profiles = await fetchUserProfiles(userIds);
        setUserNames(profiles);
      }
      
      // サイレント更新の場合は通知を表示しない（ユーザー体験のため）
    } catch (e) {
      console.error(e);
      if (!silent) {
        showSnackbar("データの取得に失敗しました", "error");
      }
      // サイレント更新でエラーが起きてもユーザーに通知しない（初回読み込みではないため）
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showSnackbar]);

  // 初回データ読み込み
  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  // リアルタイム更新の統合（ページがフォーカスされている時のみ有効）
  useAccountingRealtime(() => {
    // データが既に存在する場合のみサイレント更新
    void fetchData(true);
  }, true);

  // ★追加: 履歴を日付でグルーピングするロジック
  const groupedHistory = useMemo(() => {
    if (!data?.history) return [];

    const groups: { title: string; items: HistoryItem[] }[] = [];
    
    data.history.forEach((item) => {
      // 日付文字列(YYYY-MM-DD)またはISO文字列から日付部分を抽出
      const dateKey = item.date.split("T")[0];
      const label = formatDateLabel(item.date);

      let group = groups.find((g) => g.title === label);
      if (!group) {
        group = { title: label, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });

    return groups;
  }, [data?.history]);

  const handleDelete = async (item: HistoryItem) => {
    const message = `この取引を取り消しますか？\n\n${item.date}\n${item.title}\n¥${Math.abs(item.amount).toLocaleString()}\n\n※獲得したOpsポイントも取り消されます。`;

    if (await confirm(message)) {
      try {
        setLoading(true);
        const res = await apiClient.post<{ ok: boolean, message: string }>(
          "/api/v1/accounting/void",
          { eventId: item.id }
        );

        if (res.ok) {
          showSnackbar("取り消しました", "info");
          // 取り消し後は即座にデータを再取得（リアルタイム更新もあるが、確実に反映させるため）
          void fetchData(false);
        }
      } catch (e) {
        console.error(e);
        showSnackbar("取り消しに失敗しました", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 80 }}>

      {loading && !data && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading numbers...</div>}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px 16px 0" }}>
          {/* PL Card */}
          <section className="card" style={{ background: "#1e293b", color: "white", padding: "24px", borderRadius: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: 4 }}>今月の分配原資 (予想)</div>
                <div style={{ fontSize: "32px", fontWeight: 800, lineHeight: 1 }}>
                  ¥{data.pl.distributable.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", opacity: 0.7 }}>暫定利益</div>
                <div style={{ fontSize: "16px", fontWeight: 700 }}>¥{data.pl.profit.toLocaleString()}</div>
              </div>
            </div>

            <div style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ flex: data.pl.sales, background: "#38bdf8" }} />
              <div style={{ flex: data.pl.expenses, background: "#f43f5e" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
              <span style={{ color: "#38bdf8" }}>売上: ¥{data.pl.sales.toLocaleString()}</span>
              <span style={{ color: "#f43f5e" }}>経費: ¥{data.pl.expenses.toLocaleString()}</span>
            </div>
          </section>

          {/* Ops Ranking */}
          <section>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#475569", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <Icon name="star" size={16} color="#eab308" />
              Ops Ranking
            </h3>
            <div style={{ display: "flex", overflowX: "auto", gap: "12px", paddingBottom: "4px" }}>
              {data.opsRanking.map((rank, i) => (
                <div key={rank.userId} className="card" style={{ padding: "12px 16px", minWidth: "140px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: i === 0 ? "#fef9c3" : "#f1f5f9",
                    color: i === 0 ? "#ca8a04" : "#64748b",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px"
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>{userNames[rank.userId] || rank.userId}</div>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{rank.points} Pt</div>
                  </div>
                </div>
              ))}
              {data.opsRanking.length === 0 && (
                <div style={{ textAlign: "center", padding: 12, color: "#94a3b8", fontSize: "12px", width: "100%" }}>まだランキングデータがありません</div>
              )}
            </div>
          </section>

          {/* History (Grouped) */}
          <section>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#475569", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <Icon name="info" size={16} color="#64748b" />
              Recent History
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {groupedHistory.map((group) => (
                <div key={group.title}>
                  {/* 日付セクションヘッダー */}
                  <div style={{ 
                    fontSize: "13px", fontWeight: 700, color: "#94a3b8", 
                    marginBottom: "8px", paddingLeft: "4px",
                    position: "sticky", top: 64, zIndex: 10, 
                    // 背景を透過させつつ、文字が読みやすいように工夫 (Glassmorphism)
                    textShadow: "0 2px 4px rgba(255,255,255,0.8)"
                  }}>
                    {group.title}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {group.items.map((item) => {
                      const isSale = item.kind === "sale";
                      const sign = isSale ? "+" : "-";
                      const color = isSale ? "#0284c7" : "#ef4444";
                      const isNegative = item.amount < 0;

                      return (
                        <div
                          key={item.id}
                          className="card"
                          style={{
                            padding: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderLeft: `4px solid ${color}`,
                            opacity: isNegative ? 0.6 : 1,
                            background: isNegative ? "#f3f4f6" : "white",
                            position: "relative",
                            overflow: "hidden"
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                              {isNegative && <span style={{ fontSize: "10px", background: "#94a3b8", color: "white", padding: "2px 6px", borderRadius: "4px" }}>訂正</span>}
                              {item.title}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>
                              {item.category ? `${item.category}` : "売上"}
                              {item.status === "pending_vote" && <span style={{ color: "#f59e0b", fontWeight: 700, marginLeft: 6 }}>⚠️ 審議中</span>}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ fontSize: "16px", fontWeight: 700, color: isNegative ? "#64748b" : color }}>
                              {item.amount < 0 ? "" : sign}¥{Math.abs(item.amount).toLocaleString()}
                            </div>

                            {!isNegative && (
                              <button
                                onClick={() => handleDelete(item)}
                                style={{
                                  border: "none", background: "transparent", color: "#cbd5e1",
                                  cursor: "pointer", padding: "8px", display: "flex", alignItems: "center",
                                  transition: "color 0.2s"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                                onMouseLeave={(e) => e.currentTarget.style.color = "#cbd5e1"}
                                aria-label="取り消し"
                              >
                                <Icon name="trash" size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {groupedHistory.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: "13px", background: "#f1f5f9", borderRadius: "16px" }}>
                  履歴はありません 🍃
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          height: "56px", padding: "0 24px", borderRadius: "28px",
          background: "#0f172a", color: "white", border: "none",
          boxShadow: "0 8px 20px rgba(15, 23, 42, 0.4)",
          display: "flex", alignItems: "center", gap: "12px",
          fontSize: "16px", fontWeight: 700, cursor: "pointer", zIndex: 100,
          transition: "transform 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "translateX(-50%) scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
      >
        <Icon name="pen" size={20} color="white" />
        売上・経費登録
      </button>

      <SalesInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // モーダル閉じた後、少し遅延してからデータ更新（DB書き込みが完了してから）
          setTimeout(() => {
            void fetchData(false);
          }, 500);
        }}
      />

      {/* リアルタイム更新中のインジケーター（右上に小さく表示） */}
      {isRefreshing && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.9)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          <div
            className="spinner"
            style={{
              width: 12,
              height: 12,
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "white",
              borderRadius: "50%",
            }}
          />
          更新中...
        </div>
      )}
    </div>
  );
}
