import React, { useEffect, useState } from "react";
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

export const WeightProposalModal: React.FC<Props> = ({ isOpen, onClose, category, onSuccess }) => {
  const [newWeight, setNewWeight] = useState(1.0);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    if (category) {
      setNewWeight(category.defaultWeight);
      setReason("");
    }
  }, [category, isOpen]);

  if (!isOpen || !category) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showSnackbar("変更理由を入力してください", "error");
      return;
    }

    if (Math.abs(newWeight - category.defaultWeight) < 0.01) {
      showSnackbar("現在の値と同じです", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ ok: boolean }>(
        "/api/v1/master/categories/propose-weight-change",
        {
          categoryId: category.id,
          newWeight,
          reason: reason.trim(),
        }
      );

      if (res.ok) {
        showSnackbar("重み係数変更の申請を送信しました！AI審査に入ります。", "success");
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
          重み係数変更申請: {category.label}
        </h3>
        <div className={styles.modalForm}>
          <div className={styles.weightInfo}>
            <div className={styles.weightInfoRow}>
              <span>現在の重み係数:</span>
              <span className={styles.weightValue}>{category.defaultWeight.toFixed(1)}x</span>
            </div>
            <div className={styles.weightInfoRow}>
              <span>新しい重み係数:</span>
              <span className={styles.weightValue}>{newWeight.toFixed(1)}x</span>
            </div>
          </div>
          
          <label className={styles.modalLabel} style={{ marginTop: "var(--spacing-md)" }}>
            重み係数: <span className={styles.weightValue}>{newWeight.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={newWeight}
            onChange={(e) => setNewWeight(parseFloat(e.target.value))}
            className={styles.modalSlider}
          />
          {newWeight !== category.defaultWeight && (
            <div className={styles.weightWarning}>
              TScore計算に {newWeight > category.defaultWeight ? "+" : ""}{((newWeight - category.defaultWeight) * 100).toFixed(0)}% の影響
            </div>
          )}

          <label className={styles.modalLabel} style={{ marginTop: "var(--spacing-md)" }}>
            変更理由 <span style={{ color: "var(--color-error)", fontSize: "12px" }}>*必須</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例: このカテゴリの技術難易度が高いため、重み係数を上げる必要があります"
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
            disabled={!reason.trim() || isSubmitting || Math.abs(newWeight - category.defaultWeight) < 0.01}
            className={styles.modalButtonSave}
          >
            {isSubmitting ? "送信中..." : "申請する"}
          </button>
        </div>
      </div>
    </div>
  );
};








