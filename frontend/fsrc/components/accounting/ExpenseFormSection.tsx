import React from "react";
import { ExpenseItemList } from "./ExpenseItemList";
import type { ExpenseItem } from "../../utils/expenseItems";
import styles from "./SalesInputModal.module.css";

type Props = {
  amount: string;
  onAmountChange: (value: string) => void;
  merchantName: string;
  onMerchantNameChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  items: ExpenseItem[];
  onAddItem: () => void;
  onUpdateItem: (index: number, field: "name" | "quantity" | "unitPrice", value: string | number | undefined) => void;
  onRemoveItem: (index: number) => void;
  onApplyTotal: (total: number) => void;
};

export const ExpenseFormSection: React.FC<Props> = ({
  amount,
  onAmountChange,
  merchantName,
  onMerchantNameChange,
  category,
  onCategoryChange,
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onApplyTotal,
}) => {
  return (
    <div>
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
            className={`${styles.amountInput} ${styles.expenses}`}
          />
        </div>
      </div>
      <div className={styles.formFields}>
        <div className={styles.field}>
          <label className={styles.label}>支払先 (店名)</label>
          <input
            type="text"
            value={merchantName}
            onChange={(e) => onMerchantNameChange(e.target.value)}
            placeholder="例: コーナンPro"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>科目</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={styles.select}
          >
            <option value="material">🛠️ 材料費</option>
            <option value="tool">🪚 工具器具</option>
            <option value="travel">🚕 旅費交通費</option>
            <option value="food">🍱 会議費/飲食</option>
            <option value="other">📦 その他</option>
          </select>
        </div>

        <ExpenseItemList
          items={items}
          totalAmount={Number(amount) || 0}
          onAddItem={onAddItem}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          onApplyTotal={onApplyTotal}
        />
      </div>
    </div>
  );
};
