import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../lib/apiClient";
import { SalesInputModal } from "../components/accounting/SalesInputModal";
import { InvoiceGeneratorModal } from "../components/accounting/InvoiceGeneratorModal";
import { ExpenseApprovalModal } from "../components/accounting/ExpenseApprovalModal";
import { DateRangePicker } from "../components/DateRangePicker";
import type { AccountingDashboardData, HistoryItem } from "../types/accounting";
import { Icon } from "../components/ui/Icon";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useModal } from "../contexts/ModalContext";
import { useAccountingRealtime } from "../hooks/useAccountingRealtime";
import { fetchUserProfiles } from "../lib/api";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import { loadUserNamesCache, saveUserNamesCache } from "../lib/cacheUtils";

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

type FilterType = "all" | "sales" | "expenses";

export default function AccountingPage() {
  const isRetroGameMode = useRetroGameMode();
  const { isAnyModalOpen } = useModal();
  const [data, setData] = useState<AccountingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // リアルタイム更新時のローディング（サイレント）
  const [userNames, setUserNames] = useState<Record<string, string>>({}); // userId -> name のマップ
  const [voidModal, setVoidModal] = useState<{ isOpen: boolean; item: HistoryItem | null }>({ isOpen: false, item: null });
  const [voidReason, setVoidReason] = useState("");
  
  // フィルターと期間設定のstate
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { confirm } = useConfirm();
  const { showSnackbar } = useSnackbar();
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const showSnackbarRef = useRef(showSnackbar);
  const FETCH_DEBOUNCE_MS = 1000; // 1秒以内の連続呼び出しを防ぐ

  // showSnackbarをrefで保持（依存配列から除外するため）
  useEffect(() => {
    showSnackbarRef.current = showSnackbar;
  }, [showSnackbar]);

  // データ取得関数（内部実装）
  const fetchDataInternal = useCallback(async (silent: boolean = false) => {
    if (isFetchingRef.current) return; // 既に取得中の場合はスキップ
    isFetchingRef.current = true;
    
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const res = await apiClient.get<AccountingDashboardData>("/api/v1/accounting/dashboard");
      setData(res);
      
      // ユーザー名を取得（キャッシュを活用、不足分のみ取得）
      if (res.opsRanking && res.opsRanking.length > 0) {
        const userIds = res.opsRanking.map((rank) => rank.userId);
        const profilesMap: Record<string, string> = {};
        
        // 1. まずキャッシュから取得
        const cachedNames = loadUserNamesCache();
        Object.assign(profilesMap, cachedNames);
        
        // 2. まだ取得できていないユーザー名のみ追加取得
        const missingUserIds = userIds.filter((id) => !profilesMap[id]);
        if (missingUserIds.length > 0) {
          const additionalProfiles = await fetchUserProfiles(missingUserIds);
          Object.assign(profilesMap, additionalProfiles);
          // 取得したユーザー名をキャッシュに保存
          saveUserNamesCache(profilesMap);
        }
        
        setUserNames(profilesMap);
      }
      
      // サイレント更新の場合は通知を表示しない（ユーザー体験のため）
    } catch (e) {
      console.error(e);
      if (!silent) {
        showSnackbarRef.current("データの取得に失敗しました", "error");
      }
      // サイレント更新でエラーが起きてもユーザーに通知しない（初回読み込みではないため）
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []); // 依存配列を空にして、再作成を防ぐ

  // デバウンス付きのfetchData
  const fetchData = useCallback((silent: boolean = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // 既にスケジュールされているタイマーをクリア
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    if (timeSinceLastFetch < FETCH_DEBOUNCE_MS) {
      // デバウンス期間内なら、残り時間後に実行
      fetchTimeoutRef.current = setTimeout(() => {
        lastFetchTimeRef.current = Date.now();
        void fetchDataInternal(silent);
      }, FETCH_DEBOUNCE_MS - timeSinceLastFetch);
    } else {
      // デバウンス期間を過ぎているなら即座に実行
      lastFetchTimeRef.current = now;
      void fetchDataInternal(silent);
    }
  }, [fetchDataInternal]);

  // 初回データ読み込み（初回のみ実行）
  useEffect(() => {
    void fetchData(false);
    // クリーンアップ: タイマーをクリア
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして、初回のみ実行

  // リアルタイム更新の統合（ページがフォーカスされている時のみ有効）
  useAccountingRealtime(() => {
    // データが既に存在する場合のみサイレント更新
    void fetchData(true);
  }, true);

  // フィルターと期間設定に基づいて履歴をフィルタリング
  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];

    let filtered = [...data.history];

    // フィルタータイプでフィルタリング
    if (filterType === "sales") {
      filtered = filtered.filter((item) => item.kind === "sale");
    } else if (filterType === "expenses") {
      filtered = filtered.filter((item) => item.kind === "expense");
    }

    // 期間でフィルタリング
    if (startDate && endDate) {
      filtered = filtered.filter((item) => {
        const itemDate = item.date.split("T")[0]; // YYYY-MM-DD形式に変換
        return itemDate >= startDate && itemDate <= endDate;
      });
    } else if (startDate) {
      filtered = filtered.filter((item) => {
        const itemDate = item.date.split("T")[0];
        return itemDate >= startDate;
      });
    } else if (endDate) {
      filtered = filtered.filter((item) => {
        const itemDate = item.date.split("T")[0];
        return itemDate <= endDate;
      });
    }

    return filtered;
  }, [data?.history, filterType, startDate, endDate]);

  // ★追加: 履歴を日付でグルーピングするロジック
  const groupedHistory = useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) return [];

    const groups: { title: string; items: HistoryItem[] }[] = [];
    
    filteredHistory.forEach((item) => {
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
  }, [filteredHistory]);

  // 期間のクイック選択ハンドラー
  const handleQuickSelect = useCallback((days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setEndDate(formatDateForInput(end));
    setStartDate(formatDateForInput(start));
    setShowDatePicker(false);
  }, []);

  // 日付をYYYY-MM-DD形式にフォーマット
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDelete = async (item: HistoryItem) => {
    // 取り消し理由入力モーダルを開く
    setVoidModal({ isOpen: true, item });
    setVoidReason("");
  };

  const handleVoidConfirm = async () => {
    if (!voidModal.item) return;
    
    // 取り消し理由のバリデーション
    if (!voidReason.trim()) {
      showSnackbar("取り消し理由を入力してください", "error");
      return;
    }

    const message = `この取引を逆仕訳（取り消し）しますか？\n\n${voidModal.item.date}\n${voidModal.item.title}\n¥${Math.abs(voidModal.item.amount).toLocaleString()}\n\n理由: ${voidReason}\n\n※獲得したOpsポイントも返還されます。\n※元の取引は削除されず、逆仕訳として記録されます。`;

    if (await confirm(message)) {
      try {
        setLoading(true);
        const res = await apiClient.post<{ ok: boolean, message: string }>(
          "/api/v1/accounting/void",
          { eventId: voidModal.item.id, reason: voidReason.trim() }
        );

        if (res.ok) {
          showSnackbar("逆仕訳（取り消し）を記録しました", "info");
          setVoidModal({ isOpen: false, item: null });
          setVoidReason("");
          // 取り消し後は即座にデータを再取得（リアルタイム更新もあるが、確実に反映させるため）
          void fetchData(false);
        }
      } catch (e: any) {
        console.error(e);
        const errorMessage = e?.response?.data?.error || "取り消しに失敗しました";
        showSnackbar(errorMessage, "error");
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <Icon name="info" size={16} color="#64748b" />
                Recent History
              </h3>
              
              {/* フィルタートグルスイッチ */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={() => setFilterType("all")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: filterType === "all" ? 700 : 600,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: filterType === "all" ? "#2563eb" : "#e5e7eb",
                    background: filterType === "all" ? "#2563eb" : "white",
                    color: filterType === "all" ? "white" : "#64748b",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  全て
                </button>
                <button
                  onClick={() => setFilterType("sales")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: filterType === "sales" ? 700 : 600,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: filterType === "sales" ? "#0284c7" : "#e5e7eb",
                    background: filterType === "sales" ? "#0284c7" : "white",
                    color: filterType === "sales" ? "white" : "#64748b",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  売上のみ
                </button>
                <button
                  onClick={() => setFilterType("expenses")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: filterType === "expenses" ? 700 : 600,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: filterType === "expenses" ? "#ef4444" : "#e5e7eb",
                    background: filterType === "expenses" ? "#ef4444" : "white",
                    color: filterType === "expenses" ? "white" : "#64748b",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  経費のみ
                </button>
              </div>
            </div>

            {/* 期間設定UI */}
            <div style={{ 
              marginBottom: 16, 
              padding: "16px", 
              background: isRetroGameMode ? "#1a1a2e" : "#f8fafc", 
              borderRadius: isRetroGameMode ? "0" : "12px", 
              border: isRetroGameMode ? "2px solid #00ffff" : "1px solid #e2e8f0",
              boxShadow: isRetroGameMode ? "0 0 10px rgba(0, 255, 255, 0.5), 4px 4px 0px #000000" : "none"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ 
                  fontSize: "13px", 
                  fontWeight: 600, 
                  color: isRetroGameMode ? "#00ffff" : "#475569", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6,
                  textShadow: isRetroGameMode ? "0 0 8px rgba(0, 255, 255, 0.8)" : "none"
                }}>
                  <Icon name="timer" size={14} color={isRetroGameMode ? "#00ffff" : "#64748b"} />
                  期間設定
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: isRetroGameMode ? "0" : "6px",
                      border: isRetroGameMode ? "2px solid #00ffff" : "1px solid #cbd5e1",
                      background: isRetroGameMode ? "#0a0a0f" : "white",
                      color: isRetroGameMode ? "#00ffff" : "#64748b",
                      cursor: "pointer",
                      boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
                    }}
                  >
                    クリア
                  </button>
                )}
              </div>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onQuickSelect={handleQuickSelect}
              />
            </div>

            {/* フィルター適用中の表示 */}
            {(filterType !== "all" || startDate || endDate) && (
              <div style={{ 
                marginBottom: 12, 
                padding: "8px 12px", 
                background: isRetroGameMode ? "#0a0a0f" : "#eff6ff", 
                borderRadius: isRetroGameMode ? "0" : "8px",
                border: isRetroGameMode ? "2px solid #00ffff" : "none",
                boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
                fontSize: "12px", 
                color: isRetroGameMode ? "#00ff88" : "#1e40af",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <Icon name="search" size={14} color={isRetroGameMode ? "#00ff88" : "#1e40af"} />
                <span>
                  {filteredHistory.length}件の履歴を表示中
                  {filterType !== "all" && ` (${filterType === "sales" ? "売上" : "経費"}のみ)`}
                  {(startDate || endDate) && ` (期間: ${startDate || "開始日未設定"} ～ ${endDate || "終了日未設定"})`}
                </span>
              </div>
            )}

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
                  {(filterType !== "all" || startDate || endDate) ? (
                    <>
                      <div style={{ marginBottom: 8, fontWeight: 600 }}>該当する履歴が見つかりませんでした</div>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>
                        フィルター条件を変更してください
                      </div>
                    </>
                  ) : (
                    "履歴はありません 🍃"
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* 固定ボタン - Portalでbody直下に配置（モーダルが開いている時は非表示） */}
      {typeof document !== "undefined" && !isAnyModalOpen &&
        createPortal(
          <div style={{
            position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: "12px", zIndex: 9990,
            maxWidth: "calc(100vw - 48px)", // 画面端との余白を確保
            padding: "0 12px" // 左右の余白を追加
          }}>
            <button
              onClick={() => setIsInvoiceModalOpen(true)}
              style={{
                height: "56px", padding: "0 32px", borderRadius: "28px",
                background: "#2563eb", color: "white", border: "none",
                boxShadow: "0 8px 20px rgba(37, 99, 235, 0.4)",
                display: "flex", alignItems: "center", gap: "12px",
                fontSize: "16px", fontWeight: 700, cursor: "pointer",
                transition: "transform 0.2s",
                whiteSpace: "nowrap" // テキストの折り返しを防止
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <Icon name="document" size={20} color="white" />
              請求書生成
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                height: "56px", padding: "0 32px", borderRadius: "28px",
                background: "#0f172a", color: "white", border: "none",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.4)",
                display: "flex", alignItems: "center", gap: "12px",
                fontSize: "16px", fontWeight: 700, cursor: "pointer",
                transition: "transform 0.2s",
                whiteSpace: "nowrap" // テキストの折り返しを防止
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <Icon name="pen" size={20} color="white" />
              売上・経費登録
            </button>
            <button
              onClick={() => setIsApprovalModalOpen(true)}
              style={{
                height: "56px", padding: "0 32px", borderRadius: "28px",
                background: "#f59e0b", color: "white", border: "none",
                boxShadow: "0 8px 20px rgba(245, 158, 11, 0.4)",
                display: "flex", alignItems: "center", gap: "12px",
                fontSize: "16px", fontWeight: 700, cursor: "pointer",
                transition: "transform 0.2s",
                whiteSpace: "nowrap" // テキストの折り返しを防止
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <Icon name="check-circle" size={20} color="white" />
              承認待ち経費
            </button>
          </div>,
          document.body
        )}

      <ExpenseApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onReviewComplete={() => {
          // 審議完了後、データを再取得
          fetchData(false);
        }}
      />

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

      <InvoiceGeneratorModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
      />

      {/* 取り消し理由入力モーダル */}
      {voidModal.isOpen && voidModal.item && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setVoidModal({ isOpen: false, item: null });
              setVoidReason("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "24px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>
              取引の逆仕訳（取り消し）
            </h3>
            <div style={{ marginBottom: "16px", padding: "12px", background: "#f1f5f9", borderRadius: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                {voidModal.item.title}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                {voidModal.item.date} · ¥{Math.abs(voidModal.item.amount).toLocaleString()}
              </div>
            </div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>
              取り消し理由 <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="例: 入力ミス、重複登録、取引内容の変更など"
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: "20px",
              }}
              autoFocus
            />
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "20px", lineHeight: 1.5 }}>
              ※ 元の取引は削除されず、逆仕訳として記録されます（監査証跡のため）
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => {
                  setVoidModal({ isOpen: false, item: null });
                  setVoidReason("");
                }}
                style={{
                  padding: "10px 24px",
                  borderRadius: "100px",
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleVoidConfirm}
                disabled={!voidReason.trim()}
                style={{
                  padding: "10px 24px",
                  borderRadius: "100px",
                  border: "none",
                  background: voidReason.trim() ? "#ef4444" : "#cbd5e1",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: voidReason.trim() ? "pointer" : "not-allowed",
                  transition: "background 0.2s",
                }}
              >
                逆仕訳を実行
              </button>
            </div>
          </div>
        </div>
      )}

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
