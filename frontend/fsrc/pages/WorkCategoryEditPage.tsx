import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";
import { apiClient } from "../lib/apiClient";
import type { WorkCategory } from "../types/accounting";
import styles from "./WorkCategoryEditPage.module.css";

// カテゴリ追加申請モーダル
const AddCategoryProposalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
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

// カテゴリ削除申請モーダル
const DeleteCategoryProposalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  category: WorkCategory | null;
  onSuccess: () => void;
}> = ({ isOpen, onClose, category, onSuccess }) => {
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

// 重み係数変更申請モーダル
const WeightProposalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  category: WorkCategory | null;
  onSuccess: () => void;
}> = ({ isOpen, onClose, category, onSuccess }) => {
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

export default function WorkCategoryEditPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [deleteTargetCategory, setDeleteTargetCategory] = useState<WorkCategory | null>(null);
  const [weightEditingCategory, setWeightEditingCategory] = useState<WorkCategory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoAdjusting, setIsAutoAdjusting] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ ok: boolean; categories: WorkCategory[] }>("/api/v1/master/categories");
      if (res.ok && res.categories) {
        setCategories(res.categories);
      }
    } catch (error) {
      showSnackbar("工事カテゴリの取得に失敗しました", "error");
    } finally {
      setIsLoading(false);
    }
  };


  // 自動調整実行
  const handleAutoAdjust = async () => {
    if (!confirm("総売上からカテゴリ毎の売上割合を計算し、重み係数を自動調整しますか？")) {
      return;
    }

    setIsAutoAdjusting(true);
    try {
      const res = await apiClient.post<{
        ok: boolean;
        message: string;
        updates: Array<{ categoryId: string; oldWeight: number; newWeight: number; salesRatio: number }>;
        totalSales: number;
        error?: string;
      }>("/api/v1/master/categories/auto-adjust-weights", {});

      if (res.ok) {
        await loadCategories();
        showSnackbar(res.message, "success");
        if (res.updates && res.updates.length > 0) {
          console.log("自動調整結果:", res.updates);
        }
      } else {
        showSnackbar(res.error || "自動調整に失敗しました", "error");
      }
    } catch (error: any) {
      console.error("Auto adjust error:", error);
      showSnackbar(error?.message || "自動調整に失敗しました", "error");
    } finally {
      setIsAutoAdjusting(false);
    }
  };

  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  const openDeleteModal = (category: WorkCategory) => {
    setDeleteTargetCategory(category);
    setIsDeleteModalOpen(true);
  };

  const openWeightProposalModal = (category: WorkCategory) => {
    setWeightEditingCategory(category);
    setIsWeightModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeleteTargetCategory(null);
  };

  const closeWeightModal = () => {
    setIsWeightModalOpen(false);
    setWeightEditingCategory(null);
  };

  return (
    <>
      <div className={styles.container}>
        {/* ヘッダー */}
        <header className={styles.pageHeader}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            <Icon name="arrowLeft" size={24} color="var(--color-text-main)" />
          </button>
          <h2 className={styles.pageTitle}>工事カテゴリ編集</h2>
          <button
            onClick={handleAutoAdjust}
            disabled={isAutoAdjusting}
            className={styles.autoAdjustButton}
            title="総売上から自動で重み係数を調整"
          >
            {isAutoAdjusting ? "調整中..." : "自動調整"}
          </button>
        </header>

        {/* コンテンツ */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <p>読み込み中...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <Icon name="info" size={48} color="var(--color-text-muted)" />
              </div>
              <p className={styles.emptyStateText}>登録されている工事カテゴリはありません</p>
              <p className={styles.emptyStateSubtext}>右下のボタンから追加できます</p>
            </div>
          ) : (
            <div className={styles.categoryList}>
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={styles.categoryItem}
                >
                  <div className={styles.categoryItemContent}>
                    <div className={styles.categoryHeader}>
                      <div className={styles.categoryInfo}>
                        <div className={styles.categoryLabel}>{category.label}</div>
                        <div className={styles.categoryCode}>{category.code}</div>
                      </div>
                    </div>
                    <div className={styles.weightSection}>
                      <div className={styles.weightHeader}>
                        <span className={styles.weightLabel}>重み係数</span>
                        <span className={styles.weightValue}>
                          {category.defaultWeight.toFixed(1)}x
                        </span>
                      </div>
                      <div className={styles.weightActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openWeightProposalModal(category);
                          }}
                          className={styles.weightProposalButton}
                        >
                          変更申請
                        </button>
                      </div>
                      {category.defaultWeight !== 1.0 && (
                        <div className={styles.weightWarning}>
                          TScore計算に {category.defaultWeight > 1.0 ? "+" : ""}{((category.defaultWeight - 1.0) * 100).toFixed(0)}% の影響
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(category);
                    }}
                    className={styles.deleteButton}
                  >
                    <Icon name="trash" size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新規追加 FAB - Portalでbody直下に配置 */}
      {typeof document !== "undefined" &&
        createPortal(
          <button onClick={openAddModal} className={styles.fab} aria-label="工事カテゴリを追加">
            <Icon name="plus" size={24} color="var(--color-on-seed, white)" />
          </button>,
          document.body
        )}

      {/* カテゴリ追加申請モーダル */}
      <AddCategoryProposalModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onSuccess={loadCategories}
      />

      {/* カテゴリ削除申請モーダル */}
      <DeleteCategoryProposalModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        category={deleteTargetCategory}
        onSuccess={loadCategories}
      />

      {/* 重み係数変更申請モーダル */}
      <WeightProposalModal
        isOpen={isWeightModalOpen}
        onClose={closeWeightModal}
        category={weightEditingCategory}
        onSuccess={loadCategories}
      />
    </>
  );
}
