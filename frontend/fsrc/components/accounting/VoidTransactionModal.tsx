import React, { useState } from "react";
import type { HistoryItem } from "../../types/accounting";
import styles from "./VoidTransactionModal.module.css";

type Props = {
  isOpen: boolean;
  item: HistoryItem | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export const VoidTransactionModal: React.FC<Props> = ({ isOpen, item, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>
          取引の逆仕訳（取り消し）
        </h3>
        <div className={styles.itemInfo}>
          <div className={styles.itemTitle}>{item.title}</div>
          <div className={styles.itemDetails}>
            {item.date} · ¥{Math.abs(item.amount).toLocaleString()}
          </div>
        </div>
        <label className={styles.label}>
          取り消し理由 <span className={styles.required}>*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例: 入力ミス、重複登録、取引内容の変更など"
          className={styles.textarea}
          autoFocus
        />
        <div className={styles.note}>
          ※ 元の取引は削除されず、逆仕訳として記録されます（監査証跡のため）
        </div>
        <div className={styles.buttonGroup}>
          <button
            onClick={handleClose}
            className={styles.cancelButton}
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
            className={styles.confirmButton}
          >
            {isSubmitting ? "実行中..." : "逆仕訳を実行"}
          </button>
        </div>
      </div>
    </div>
  );
};








