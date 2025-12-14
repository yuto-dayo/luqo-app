import React from "react";
import { CategorySelector } from "./CategorySelector";
import type { WorkCategory } from "../../types/accounting";
import styles from "./SalesInputModal.module.css";

type Client = { id: string; name: string };

type SelectedCategory = {
  id: string;
  label: string;
  amount: string;
};

type Props = {
  amount: string;
  onAmountChange: (value: string) => void;
  clientName: string;
  onClientNameChange: (value: string) => void;
  clients: Client[];
  selectedCategories: SelectedCategory[];
  workCategories: WorkCategory[];
  loadingCategories: boolean;
  onToggleCategory: (categoryId: string) => void;
  onUpdateCategoryAmount: (categoryId: string, amount: string) => void;
  onRemoveCategory: (categoryId: string) => void;
};

export const SalesFormSection: React.FC<Props> = ({
  amount,
  onAmountChange,
  clientName,
  onClientNameChange,
  clients,
  selectedCategories,
  workCategories,
  loadingCategories,
  onToggleCategory,
  onUpdateCategoryAmount,
  onRemoveCategory,
}) => {
  return (
    <div>
      {selectedCategories.length === 0 && (
        <div>
          <label className={styles.amountInputLabel}>金額 (税抜)</label>
          <div className={styles.amountInputWrapper}>
            <span className={styles.currencySymbol}>¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              autoFocus
              className={styles.amountInput}
            />
          </div>
        </div>
      )}
      <div className={styles.formFields}>
        <div className={styles.field}>
          <label className={styles.label}>取引先</label>
          <select
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            className={styles.select}
          >
            <option value="" disabled>
              選択してください
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <div className={styles.link}>
            <a href="/settings" className={styles.linkAnchor}>
              ＋ 設定で追加する
            </a>
          </div>
        </div>

        <CategorySelector
          selectedCategories={selectedCategories}
          workCategories={workCategories}
          loadingCategories={loadingCategories}
          onToggleCategory={onToggleCategory}
          onUpdateCategoryAmount={onUpdateCategoryAmount}
          onRemoveCategory={onRemoveCategory}
        />
      </div>
    </div>
  );
};
