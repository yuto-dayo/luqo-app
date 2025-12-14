import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../lib/apiClient";
import { SalesInputModal } from "../components/accounting/SalesInputModal";
import { InvoiceGeneratorModal } from "../components/accounting/InvoiceGeneratorModal";
import { ExpenseApprovalModal } from "../components/accounting/ExpenseApprovalModal";
import { VoidTransactionModal } from "../components/accounting/VoidTransactionModal";
import { TransactionDetailModal } from "../components/accounting/TransactionDetailModal";
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
import styles from "./AccountingPage.module.css";

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
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; transactionId: string | null }>({ isOpen: false, transactionId: null });
  
  // フィルターと期間設定のstate
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // FAB展開状態
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  
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
  };

  const handleVoidConfirm = async (reason: string) => {
    if (!voidModal.item) return;

    const message = `この取引を逆仕訳（取り消し）しますか？\n\n${voidModal.item.date}\n${voidModal.item.title}\n¥${Math.abs(voidModal.item.amount).toLocaleString()}\n\n理由: ${reason}\n\n※獲得したOpsポイントも返還されます。\n※元の取引は削除されず、逆仕訳として記録されます。`;

    if (await confirm(message)) {
      try {
        setLoading(true);
        const res = await apiClient.post<{ ok: boolean, message: string }>(
          "/api/v1/accounting/void",
          { eventId: voidModal.item.id, reason }
        );

        if (res.ok) {
          showSnackbar("逆仕訳（取り消し）を記録しました", "info");
          setVoidModal({ isOpen: false, item: null });
          // 取り消し後は即座にデータを再取得（リアルタイム更新もあるが、確実に反映させるため）
          void fetchData(false);
        }
      } catch (e: any) {
        console.error(e);
        const errorMessage = e?.response?.data?.error || "取り消しに失敗しました";
        showSnackbar(errorMessage, "error");
        throw e; // モーダル側でエラーハンドリングできるように
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={`page ${styles.page}`}>

      {loading && !data && <div className={styles.loadingState}>Loading numbers...</div>}

      {data && (
        <div className={styles.section}>
          {/* PL Card */}
          <section className={`card ${styles.plCard}`}>
            <div className={styles.plHeader}>
              <div>
                <div className={styles.plTitle}>今月の分配原資 (予想)</div>
                <div className={styles.plAmount}>
                  ¥{data.pl.distributable.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={styles.plProfitLabel}>暫定利益</div>
                <div className={styles.plProfitValue}>¥{data.pl.profit.toLocaleString()}</div>
              </div>
            </div>

            <div className={styles.plBar}>
              <div className={styles.plBarSales} style={{ flex: data.pl.sales }} />
              <div className={styles.plBarExpenses} style={{ flex: data.pl.expenses }} />
            </div>
            <div className={styles.plSummary}>
              <span className={styles.plSummarySales}>売上: ¥{data.pl.sales.toLocaleString()}</span>
              <span className={styles.plSummaryExpenses}>経費: ¥{data.pl.expenses.toLocaleString()}</span>
            </div>
          </section>

          {/* Ops Ranking */}
          <section>
            <h3 className={styles.sectionTitle}>
              <Icon name="star" size={16} color="#eab308" />
              Ops Ranking
            </h3>
            <div className={styles.opsRanking}>
              {data.opsRanking.map((rank, i) => (
                <div key={rank.userId} className={`card ${styles.opsRankingCard}`}>
                  <div className={i === 0 ? styles.opsRankingBadgeFirst : styles.opsRankingBadgeOther}>
                    {i + 1}
                  </div>
                  <div>
                    <div className={styles.opsRankingName}>{userNames[rank.userId] || rank.userId}</div>
                    <div className={styles.opsRankingPoints}>{rank.points} Pt</div>
                  </div>
                </div>
              ))}
              {data.opsRanking.length === 0 && (
                <div className={styles.opsRankingEmpty}>まだランキングデータがありません</div>
              )}
            </div>
          </section>

          {/* History (Grouped) */}
          <section>
            <div className={styles.historyHeader}>
              <h3 className={styles.sectionTitle}>
                <Icon name="info" size={16} color="#64748b" />
                Recent History
              </h3>
              
              {/* フィルタートグルスイッチ */}
              <div className={styles.filterButtons}>
                <button
                  onClick={() => setFilterType("all")}
                  className={filterType === "all" ? styles.filterButtonAll : styles.filterButtonAllInactive}
                >
                  全て
                </button>
                <button
                  onClick={() => setFilterType("sales")}
                  className={filterType === "sales" ? styles.filterButtonSales : styles.filterButtonSalesInactive}
                >
                  売上のみ
                </button>
                <button
                  onClick={() => setFilterType("expenses")}
                  className={filterType === "expenses" ? styles.filterButtonExpenses : styles.filterButtonExpensesInactive}
                >
                  経費のみ
                </button>
              </div>
            </div>

            {/* 期間設定UI */}
            <div className={styles.datePickerContainer}>
              <div className={styles.datePickerHeader}>
                <div className={styles.datePickerTitle}>
                  <Icon name="timer" size={14} color={isRetroGameMode ? "#00ffff" : "#64748b"} />
                  期間設定
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className={styles.datePickerClearButton}
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
              <div className={styles.filterInfo}>
                <Icon name="search" size={14} color={isRetroGameMode ? "#00ff88" : "#1e40af"} />
                <span>
                  {filteredHistory.length}件の履歴を表示中
                  {filterType !== "all" && ` (${filterType === "sales" ? "売上" : "経費"}のみ)`}
                  {(startDate || endDate) && ` (期間: ${startDate || "開始日未設定"} ～ ${endDate || "終了日未設定"})`}
                </span>
              </div>
            )}

            <div className={styles.historyGroups}>
              {groupedHistory.map((group) => (
                <div key={group.title} className={styles.historyGroup}>
                  {/* 日付セクションヘッダー */}
                  <div className={styles.historyGroupTitle}>
                    {group.title}
                  </div>

                  <div className={styles.historyItems}>
                    {group.items.map((item) => {
                      const isSale = item.kind === "sale";
                      const sign = isSale ? "+" : "-";
                      const isNegative = item.amount < 0;

                      return (
                        <div
                          key={item.id}
                          className={`card ${styles.historyItem} ${isSale ? styles.historyItemSale : styles.historyItemExpense} ${isNegative ? styles.historyItemNegative : ""}`}
                          onClick={() => setDetailModal({ isOpen: true, transactionId: item.id })}
                          style={{ cursor: "pointer" }}
                        >
                          <div className={styles.historyItemContent}>
                            <div className={styles.historyItemTitle}>
                              {isNegative && <span className={styles.historyItemBadge}>訂正</span>}
                              {item.title}
                            </div>
                            <div className={styles.historyItemCategory}>
                              {item.category ? `${item.category}` : "売上"}
                              {item.status === "pending_vote" && <span className={styles.historyItemPending}>⚠️ 審議中</span>}
                            </div>
                          </div>

                          <div className={styles.historyItemActions}>
                            <div className={`${styles.historyItemAmount} ${isNegative ? styles.historyItemAmountNegative : isSale ? styles.historyItemAmountSale : styles.historyItemAmountExpense}`}>
                              {item.amount < 0 ? "" : sign}¥{Math.abs(item.amount).toLocaleString()}
                            </div>

                            {!isNegative && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(item);
                                }}
                                className={styles.historyItemDeleteButton}
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
                <div className={styles.historyEmpty}>
                  {(filterType !== "all" || startDate || endDate) ? (
                    <>
                      <div className={styles.historyEmptyTitle}>該当する履歴が見つかりませんでした</div>
                      <div className={styles.historyEmptySubtitle}>
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

      {/* FAB Menu - Portalでbody直下に配置（モーダルが開いている時は非表示） */}
      {typeof document !== "undefined" && !isAnyModalOpen &&
        createPortal(
          <div className={`${styles.fabMenu} ${isFabExpanded ? styles.fabMenuExpanded : ""}`}>
            {/* 子FABボタン */}
            <button
              onClick={() => {
                setIsInvoiceModalOpen(true);
                setIsFabExpanded(false);
              }}
              className={`${styles.fabChild} ${styles.fabChildInvoice} ${isFabExpanded ? styles.fabChildVisible : ""}`}
              style={{ '--index': 0 } as React.CSSProperties}
              aria-label="請求書生成"
            >
              <Icon name="document" size={24} color="white" />
            </button>
            <button
              onClick={() => {
                setIsModalOpen(true);
                setIsFabExpanded(false);
              }}
              className={`${styles.fabChild} ${styles.fabChildSales} ${isFabExpanded ? styles.fabChildVisible : ""}`}
              style={{ '--index': 1 } as React.CSSProperties}
              aria-label="売上・経費登録"
            >
              <Icon name="pen" size={24} color="white" />
            </button>
            <button
              onClick={() => {
                setIsApprovalModalOpen(true);
                setIsFabExpanded(false);
              }}
              className={`${styles.fabChild} ${styles.fabChildApproval} ${isFabExpanded ? styles.fabChildVisible : ""}`}
              style={{ '--index': 2 } as React.CSSProperties}
              aria-label="承認待ち経費"
            >
              <Icon name="check-circle" size={24} color="white" />
            </button>
            
            {/* 親FABボタン */}
            <button
              onClick={() => setIsFabExpanded(!isFabExpanded)}
              className={`${styles.fabParent} ${isFabExpanded ? styles.fabParentExpanded : ""}`}
              aria-label={isFabExpanded ? "メニューを閉じる" : "メニューを開く"}
            >
              <Icon 
                name={isFabExpanded ? "close" : "plus"} 
                size={24} 
                color="white" 
              />
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
      <VoidTransactionModal
        isOpen={voidModal.isOpen}
        item={voidModal.item}
        onClose={() => setVoidModal({ isOpen: false, item: null })}
        onConfirm={handleVoidConfirm}
      />

      {/* 取引詳細モーダル */}
      <TransactionDetailModal
        isOpen={detailModal.isOpen}
        transactionId={detailModal.transactionId}
        onClose={() => setDetailModal({ isOpen: false, transactionId: null })}
      />

      {/* リアルタイム更新中のインジケーター（右上に小さく表示） */}
      {isRefreshing && (
        <div className={styles.refreshingIndicator}>
          <div className={styles.refreshingSpinner} />
          更新中...
        </div>
      )}
    </div>
  );
}
