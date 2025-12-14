/**
 * 品名リスト関連のユーティリティ関数
 */

export type ExpenseItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
};

/**
 * 品名の小計を計算（数量 × 単価）
 */
export function calculateItemSubtotal(item: ExpenseItem): number {
  const quantity = item.quantity || 1;
  const unitPrice = item.unitPrice || 0;
  return quantity * unitPrice;
}

/**
 * 品名リストの合計金額を計算
 */
export function calculateItemsTotal(items: ExpenseItem[]): number {
  return items.reduce((sum, item) => {
    return sum + calculateItemSubtotal(item);
  }, 0);
}

/**
 * 品名合計と入力金額の差をチェック（1円以上の差がある場合にtrueを返す）
 */
export function hasAmountDifference(itemsTotal: number, inputAmount: number): boolean {
  return Math.abs(itemsTotal - inputAmount) > 1;
}
