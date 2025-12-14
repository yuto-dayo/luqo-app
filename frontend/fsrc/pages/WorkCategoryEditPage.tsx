import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { useSnackbar } from "../contexts/SnackbarContext";
import { apiClient } from "../lib/apiClient";
import type { WorkCategory } from "../types/accounting";
import { AddCategoryProposalModal } from "../components/accounting/AddCategoryProposalModal";
import { DeleteCategoryProposalModal } from "../components/accounting/DeleteCategoryProposalModal";
import { WeightProposalModal } from "../components/accounting/WeightProposalModal";
import styles from "./WorkCategoryEditPage.module.css";

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
