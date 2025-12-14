import React, { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "../../lib/apiClient";
import { useSnackbar } from "../../contexts/SnackbarContext";
import { Icon } from "../ui/Icon";
import { useRetroGameMode } from "../../hooks/useRetroGameMode";
import styles from "./ExpenseApprovalModal.module.css";

type PendingExpense = {
  id: string;
  eventId: string;
  kind: "expense";
  date: string;
  title: string;
  amount: number;
  category?: string;
  status?: string;
  applicantId: string;
  applicantName?: string;
  reviewerName?: string;
  createdAt: string;
};

type PendingExpensesResponse = {
  ok: boolean;
  items: PendingExpense[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onReviewComplete?: () => void; // 審議完了後のコールバック
};

export const ExpenseApprovalModal: React.FC<Props> = ({ isOpen, onClose, onReviewComplete }) => {
  const [items, setItems] = useState<PendingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const isRetroGameMode = useRetroGameMode();
  const { showSnackbar } = useSnackbar();
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const FETCH_DEBOUNCE_MS = 1000;

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);
      const res = await apiClient.get<PendingExpensesResponse>("/api/v1/accounting/pending-expenses");

      if (res.ok) {
        setItems(res.items);
      } else {
        showSnackbar("承認待ち経費の取得に失敗しました", "error");
      }
    } catch (e: any) {
      console.error("Failed to fetch pending expenses", e);
      showSnackbar("承認待ち経費の取得に失敗しました", "error");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [showSnackbar]);

  useEffect(() => {
    if (isOpen) {
      // デバウンス処理
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => {
        fetchData();
      }, 100);
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [isOpen, fetchData]);

  const handleApprove = async (eventId: string) => {
    try {
      setReviewingId(eventId);
      const res = await apiClient.post<{ ok: boolean; message: string }>("/api/v1/accounting/review-expense", {
        eventId,
        action: "approve",
      });

      if (res.ok) {
        showSnackbar("経費を承認しました", "success");
        await fetchData();
        onReviewComplete?.();
      } else {
        showSnackbar((res as any).error || "承認に失敗しました", "error");
      }
    } catch (e: any) {
      console.error("Approve error:", e);
      showSnackbar(e?.message || "承認に失敗しました", "error");
    } finally {
      setReviewingId(null);
    }
  };

  const handleReject = async (eventId: string) => {
    if (!rejectFeedback.trim()) {
      showSnackbar("否決理由を入力してください", "error");
      return;
    }

    try {
      setIsRejecting(true);
      const res = await apiClient.post<{ ok: boolean; message: string }>("/api/v1/accounting/review-expense", {
        eventId,
        action: "reject",
        feedback: rejectFeedback.trim(),
      });

      if (res.ok) {
        showSnackbar("経費を否決しました", "info");
        setRejectFeedback("");
        setRejectingId(null);
        await fetchData();
        onReviewComplete?.();
      } else {
        showSnackbar((res as any).error || "否決に失敗しました", "error");
      }
    } catch (e: any) {
      console.error("Reject error:", e);
      showSnackbar(e?.message || "否決に失敗しました", "error");
    } finally {
      setIsRejecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>承認待ち経費</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>読み込み中...</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <p>現在、承認待ちの経費はありません。</p>
            </div>
          ) : (
            <div className={styles.list}>
              {items.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemTitle}>
                      <span className={styles.merchant}>{item.title}</span>
                      <span className={styles.category}>{item.category || "その他"}</span>
                    </div>
                    <div className={styles.amount}>¥{item.amount.toLocaleString()}</div>
                  </div>

                  <div className={styles.itemDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>申請者:</span>
                      <span className={styles.value}>{item.applicantName || "不明"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>日付:</span>
                      <span className={styles.value}>{item.date}</span>
                    </div>
                    {item.createdAt && (
                      <div className={styles.detailRow}>
                        <span className={styles.label}>申請日時:</span>
                        <span className={styles.value}>
                          {new Date(item.createdAt).toLocaleString("ja-JP", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {rejectingId === item.eventId ? (
                    <div className={styles.rejectForm}>
                      <textarea
                        className={styles.feedbackInput}
                        placeholder="否決理由を入力してください..."
                        value={rejectFeedback}
                        onChange={(e) => setRejectFeedback(e.target.value)}
                        rows={3}
                      />
                      <div className={styles.rejectFormActions}>
                        <button
                          className={`${styles.button} ${styles.cancelButton}`}
                          onClick={() => {
                            setRejectingId(null);
                            setRejectFeedback("");
                          }}
                        >
                          キャンセル
                        </button>
                        <button
                          className={`${styles.button} ${styles.confirmRejectButton}`}
                          onClick={() => handleReject(item.eventId)}
                          disabled={!rejectFeedback.trim() || isRejecting}
                        >
                          {isRejecting ? "否決中..." : "否決確定"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      <button
                        className={`${styles.button} ${styles.approveButton}`}
                        onClick={() => handleApprove(item.eventId)}
                        disabled={reviewingId === item.eventId || rejectingId !== null}
                      >
                        {reviewingId === item.eventId ? "承認中..." : "承認"}
                      </button>
                      <button
                        className={`${styles.button} ${styles.rejectButton}`}
                        onClick={() => {
                          if (reviewingId === item.eventId || isRejecting) return;
                          setRejectingId(item.eventId);
                          setRejectFeedback("");
                        }}
                        disabled={reviewingId === item.eventId || isRejecting || rejectingId !== null}
                      >
                        否決
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};








