import React, { useEffect, useState } from "react";
import { useSnackbar } from "../../contexts/SnackbarContext";
import { apiClient } from "../../lib/apiClient";
import styles from "../../pages/WorkCategoryEditPage.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AddCategoryProposalModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    if (isOpen) {
      setLabel("");
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!label.trim()) {
      showSnackbar("カテゴリ名を入力してください", "error");
      return;
    }

    if (!reason.trim()) {
      showSnackbar("追加理由を入力してください", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ ok: boolean }>(
        "/api/v1/master/categories/propose-add",
        {
          label: label.trim(),
          reason: reason.trim(),
        }
      );

      if (res.ok) {
        showSnackbar("カテゴリ追加の申請を送信しました！AI審査に入ります。", "success");
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      console.error(e);
      showSnackbar(e?.message || "申請の送信に失敗しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          工事カテゴリ追加申請
        </h3>
        <div className={styles.modalForm}>
          <label className={styles.modalLabel}>
            カテゴリ名 <span style={{ color: "var(--color-error)", fontSize: "12px" }}>*必須</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例: 塗装工事"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              }
            }}
            className={styles.modalInput}
          />

          <label className={styles.modalLabel} style={{ marginTop: "var(--spacing-md)" }}>
            追加理由 <span style={{ color: "var(--color-error)", fontSize: "12px" }}>*必須</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例: 外壁塗装の需要が増えているため、独立したカテゴリとして管理したい"
            rows={4}
            className={styles.modalTextarea}
          />
        </div>
        <div className={styles.modalButtonGroup}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={styles.modalButtonCancel}
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!label.trim() || !reason.trim() || isSubmitting}
            className={styles.modalButtonSave}
          >
            {isSubmitting ? "送信中..." : "申請する"}
          </button>
        </div>
      </div>
    </div>
  );
};








