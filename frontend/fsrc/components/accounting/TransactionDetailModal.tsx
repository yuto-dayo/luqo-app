import React, { useEffect, useState } from "react";
import { apiClient } from "../../lib/apiClient";
import type { TransactionDetail } from "../../types/accounting";
import { Icon } from "../ui/Icon";
import { useRetroGameMode } from "../../hooks/useRetroGameMode";
import styles from "./TransactionDetailModal.module.css";

type Props = {
  isOpen: boolean;
  transactionId: string | null;
  onClose: () => void;
};

export const TransactionDetailModal: React.FC<Props> = ({
  isOpen,
  transactionId,
  onClose,
}) => {
  const isRetroGameMode = useRetroGameMode();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !transactionId) {
      setTransaction(null);
      setError(null);
      return;
    }

    // 取引詳細を取得
    const fetchTransactionDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<{ ok: boolean; transaction: TransactionDetail }>(
          `/api/v1/accounting/transaction/${transactionId}`
        );
        if (res.ok && res.transaction) {
          setTransaction(res.transaction);
        } else {
          setError("取引詳細の取得に失敗しました");
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.response?.data?.error || "取引詳細の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void fetchTransactionDetail();
  }, [isOpen, transactionId]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "approved":
        return "承認済み";
      case "pending_vote":
        return "審議中";
      case "rejected":
        return "否決";
      case "recorded":
        return "記録済み";
      default:
        return status || "不明";
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "var(--color-success, #10b981)";
      case "pending_vote":
        return "var(--color-warning, #f59e0b)";
      case "rejected":
        return "var(--color-error, #ef4444)";
      default:
        return "var(--color-text-muted, #64748b)";
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>取引詳細</h3>
          <button onClick={onClose} className={styles.closeButton} aria-label="閉じる">
            <Icon name="close" size={20} />
          </button>
        </div>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>読み込み中...</span>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <Icon name="alert-circle" size={20} color="var(--color-error, #ef4444)" />
            <span>{error}</span>
          </div>
        )}

        {transaction && !loading && (
          <div className={styles.content}>
            {/* 基本情報 */}
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>基本情報</h4>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>種類</span>
                  <span className={styles.infoValue}>
                    {transaction.kind === "sale" ? "売上" : "経費"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>金額</span>
                  <span className={`${styles.infoValue} ${styles.amount} ${transaction.kind === "sale" ? styles.amountSale : styles.amountExpense}`}>
                    {transaction.amount < 0 ? "" : transaction.kind === "sale" ? "+" : "-"}
                    ¥{Math.abs(transaction.amount).toLocaleString()}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>取引先</span>
                  <span className={styles.infoValue}>{transaction.title}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>取引日</span>
                  <span className={styles.infoValue}>{formatDate(transaction.date)}</span>
                </div>
                {transaction.category && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>カテゴリ</span>
                    <span className={styles.infoValue}>{transaction.category}</span>
                  </div>
                )}
                {transaction.status && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>ステータス</span>
                    <span
                      className={styles.infoValue}
                      style={{ color: getStatusColor(transaction.status) }}
                    >
                      {getStatusLabel(transaction.status)}
                    </span>
                  </div>
                )}
                {transaction.siteName && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>現場名</span>
                    <span className={styles.infoValue}>{transaction.siteName}</span>
                  </div>
                )}
              </div>
            </section>

            {/* 処理情報 */}
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>処理情報</h4>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>登録者</span>
                  <span className={styles.infoValue}>{transaction.createdBy.userName}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>登録日時</span>
                  <span className={styles.infoValue}>{formatDateTime(transaction.createdAt)}</span>
                </div>
                {transaction.inputType && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>入力方法</span>
                    <span className={styles.infoValue}>
                      {transaction.inputType === "ocr_verified" ? "OCR（画像解析）" : "手入力"}
                    </span>
                  </div>
                )}
                {transaction.opsReward !== undefined && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>獲得ポイント</span>
                    <span className={styles.infoValue}>
                      <Icon name="star" size={14} color="#eab308" />
                      {transaction.opsReward} Pt
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* 売上固有情報 */}
            {transaction.kind === "sale" && (
              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>売上詳細</h4>
                <div className={styles.infoGrid}>
                  {transaction.tax !== undefined && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>消費税</span>
                      <span className={styles.infoValue}>¥{transaction.tax.toLocaleString()}</span>
                    </div>
                  )}
                  {transaction.workCategoryLabel && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>工事カテゴリ</span>
                      <span className={styles.infoValue}>{transaction.workCategoryLabel}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 経費固有情報 */}
            {transaction.kind === "expense" && (
              <>
                {transaction.riskLevel && (
                  <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>経費詳細</h4>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>リスクレベル</span>
                        <span
                          className={styles.infoValue}
                          style={{
                            color:
                              transaction.riskLevel === "HIGH"
                                ? "var(--color-error, #ef4444)"
                                : "var(--color-success, #10b981)",
                          }}
                        >
                          {transaction.riskLevel === "HIGH" ? "高" : "低"}
                        </span>
                      </div>
                      {transaction.reviewerName && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>審議者</span>
                          <span className={styles.infoValue}>{transaction.reviewerName}</span>
                        </div>
                      )}
                      {transaction.reviewedAt && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>審議完了日時</span>
                          <span className={styles.infoValue}>
                            {formatDateTime(transaction.reviewedAt)}
                          </span>
                        </div>
                      )}
                      {transaction.reviewFeedback && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>審議フィードバック</span>
                          <span className={styles.infoValue}>{transaction.reviewFeedback}</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}
                {transaction.items && transaction.items.length > 0 && (
                  <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>品名リスト</h4>
                    <div className={styles.itemsList}>
                      {transaction.items.map((item, index) => (
                        <div key={index} className={styles.itemCard}>
                          <div className={styles.itemName}>{item.name}</div>
                          {(item.quantity || item.unitPrice) && (
                            <div className={styles.itemDetails}>
                              {item.quantity && (
                                <span className={styles.itemDetail}>
                                  数量: {item.quantity}
                                </span>
                              )}
                              {item.unitPrice && (
                                <span className={styles.itemDetail}>
                                  単価: ¥{item.unitPrice.toLocaleString()}
                                </span>
                              )}
                              {item.quantity && item.unitPrice && (
                                <span className={styles.itemDetail}>
                                  小計: ¥{(item.quantity * item.unitPrice).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* 備考 */}
            {transaction.description && (
              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>備考</h4>
                <div className={styles.description}>{transaction.description}</div>
              </section>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.closeButtonFooter}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};







