import React from "react";
import { calculateItemSubtotal, calculateItemsTotal, hasAmountDifference } from "../../utils/expenseItems";
import type { ExpenseItem } from "../../utils/expenseItems";
import styles from "./ExpenseItemList.module.css";

type Props = {
  items: ExpenseItem[];
  totalAmount: number;
  onAddItem: () => void;
  onUpdateItem: (index: number, field: "name" | "quantity" | "unitPrice", value: string | number | undefined) => void;
  onRemoveItem: (index: number) => void;
  onApplyTotal: (total: number) => void;
};

export const ExpenseItemList: React.FC<Props> = ({
  items,
  totalAmount,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onApplyTotal,
}) => {
  const itemsTotal = calculateItemsTotal(items);
  const hasDifference = hasAmountDifference(itemsTotal, totalAmount);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label className={styles.label}>品名（何を買ったか）</label>
        <button type="button" onClick={onAddItem} className={styles.addButton}>
          +
        </button>
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>
          プラスボタンで品名を追加
        </div>
      ) : (
        <div className={styles.items}>
          {items.map((item, index) => {
            const subtotal = calculateItemSubtotal(item);
            return (
              <div key={index} className={styles.item}>
                <div className={styles.itemHeader}>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onUpdateItem(index, "name", e.target.value)}
                    placeholder="例: ビス 3.5×25"
                    className={styles.itemNameInput}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveItem(index)}
                    className={styles.removeButton}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.itemDetails}>
                  <div className={styles.detailField}>
                    <label className={styles.detailLabel}>数量</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        onUpdateItem(
                          index,
                          "quantity",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      placeholder="1"
                      className={styles.detailInput}
                    />
                  </div>
                  <div className={styles.detailField}>
                    <label className={styles.detailLabel}>単価 (¥)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice || ""}
                      onChange={(e) =>
                        onUpdateItem(
                          index,
                          "unitPrice",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      placeholder="0"
                      className={styles.detailInput}
                    />
                  </div>
                  <div className={styles.detailField}>
                    <label className={styles.detailLabel}>小計</label>
                    <div className={styles.subtotal}>
                      ¥{subtotal.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length > 0 && (
            <div className={`${styles.totalCard} ${hasDifference ? styles.hasDifference : ""}`}>
              <div className={styles.totalHeader}>
                <div className={styles.totalLabelGroup}>
                  <span className={styles.totalLabel}>品名合計（参考）</span>
                  {hasDifference && (
                    <span className={styles.differenceWarning}>
                      金額（税抜）と不一致
                    </span>
                  )}
                </div>
                <div className={styles.totalValueGroup}>
                  <span className={styles.totalValue}>
                    ¥{itemsTotal.toLocaleString()}
                  </span>
                  {hasDifference && (
                    <button
                      type="button"
                      onClick={() => onApplyTotal(itemsTotal)}
                      className={styles.applyButton}
                    >
                      反映
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.totalNote}>
                ※ 金額（税抜）フィールドが優先されます。税込金額を入力する場合は、品名合計と異なる場合があります。
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
