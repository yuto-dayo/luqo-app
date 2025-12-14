import React from "react";
import type { WorkCategory } from "../../types/accounting";
import styles from "./CategorySelector.module.css";

type SelectedCategory = {
  id: string;
  label: string;
  amount: string;
};

type Props = {
  selectedCategories: SelectedCategory[];
  workCategories: WorkCategory[];
  loadingCategories: boolean;
  onToggleCategory: (categoryId: string) => void;
  onUpdateCategoryAmount: (categoryId: string, amount: string) => void;
  onRemoveCategory: (categoryId: string) => void;
};

export const CategorySelector: React.FC<Props> = ({
  selectedCategories,
  workCategories,
  loadingCategories,
  onToggleCategory,
  onUpdateCategoryAmount,
  onRemoveCategory,
}) => {
  return (
    <div className={styles.container}>
      <label className={styles.label}>
        工事カテゴリ
        <span className={styles.optional}>(任意)</span>
      </label>
      <div className={styles.categoryList}>
        {loadingCategories ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : workCategories.length === 0 ? (
          <div className={styles.empty}>カテゴリが登録されていません</div>
        ) : (
          workCategories.map((cat) => {
            const isSelected = selectedCategories.some((sc) => sc.id === cat.id);
            return (
              <label
                key={cat.id}
                className={`${styles.categoryItem} ${isSelected ? styles.selected : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleCategory(cat.id)}
                  className={styles.checkbox}
                />
                <span className={styles.categoryLabel}>
                  {cat.label}
                  {cat.defaultWeight !== 1.0 && (
                    <span className={styles.weight}>
                      (×{cat.defaultWeight.toFixed(1)})
                    </span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>

      {selectedCategories.length > 0 && (
        <div className={styles.amountInputs}>
          {selectedCategories.map((selectedCat) => (
            <div key={selectedCat.id} className={styles.amountInputCard}>
              <div className={styles.amountInputHeader}>
                <label className={styles.amountInputLabel}>
                  {selectedCat.label} の金額
                </label>
                <button
                  type="button"
                  onClick={() => onRemoveCategory(selectedCat.id)}
                  className={styles.removeButton}
                >
                  削除
                </button>
              </div>
              <div className={styles.amountInputWrapper}>
                <span className={styles.currencySymbol}>¥</span>
                <input
                  type="number"
                  value={selectedCat.amount}
                  onChange={(e) => onUpdateCategoryAmount(selectedCat.id, e.target.value)}
                  placeholder="0"
                  className={styles.amountInput}
                />
              </div>
            </div>
          ))}
          <div className={styles.note}>
            選択したカテゴリの売上はTScore計算に反映されます
          </div>
        </div>
      )}
    </div>
  );
};
