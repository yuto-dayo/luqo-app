import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { useSnackbar } from "../../contexts/SnackbarContext";
import { apiClient } from "../../lib/apiClient";
import type { WorkCategory } from "../../types/accounting";
import styles from "../../pages/WorkCategoryEditPage.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  category: WorkCategory | null;
  onSuccess: () => void;
};

export const DeleteCategoryProposalModal: React.FC<Props> = ({ isOpen, onClose, category, onSuccess }) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    if (category) {
      setReason("");
    }
  }, [category, isOpen]);

  if (!isOpen || !category) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showSnackbar("削除理由を入力してください", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ ok: boolean }>(
        "/api/v1/master/categories/propose-delete",
        {
          categoryId: category.id,
          reason: reason.trim(),
        }
      );

      if (res.ok) {
        showSnackbar("カテゴリ削除の申請を送信しました！AI審査に入ります。", "success");
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
          工事カテゴリ削除申請: {category.label}
        </h3>
        <div className={styles.modalForm}>
          <div className={styles.modalWarning}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Icon name="alert" size={24} color="var(--color-error)" />
              <strong>警告</strong>
            </div>
            <p>このカテゴリを削除すると、今後このカテゴリを選択できなくなります。</p>
            <p style={{ fontSize: "12px", marginTop: "8px" }}>
              過去の売上データで使用されている場合は削除できません。
            </p>
          </div>

          <label className={styles.modalLabel} style={{ marginTop: "var(--spacing-md)" }}>
            削除理由 <span style={{ color: "var(--color-error)", fontSize: "12px" }}>*必須</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例: 実際には使用されていないため、管理を簡素化したい"
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
            disabled={!reason.trim() || isSubmitting}
            className={styles.modalButtonSave}
            style={{ background: "var(--color-error)" }}
          >
            {isSubmitting ? "送信中..." : "削除申請する"}
          </button>
        </div>
      </div>
    </div>
  );
};








