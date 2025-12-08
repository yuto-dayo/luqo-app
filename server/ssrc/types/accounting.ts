/**
 * 売上確定イベントのペイロード
 * accounting_sale_registered
 */
export type SalePayload = {
  amount: number; // 税抜金額
  tax: number; // 消費税
  clientName: string; // 取引先名
  siteName?: string; // 現場名（任意）
  occurredAt: string; // 売上計上日 (YYYY-MM-DD)
  description?: string; // 摘要・メモ
  evidenceUrl?: string; // 請求書・検収書の画像URL (OCR時の元画像)
  // 分析・UX用メタデータ
  inputType: "ocr_verified" | "manual_entry";
  opsReward: number; // このアクションで付与されたポイント
};

/**
 * ダッシュボード表示用レスポンス
 */
export type DashboardResponse = {
  currentMonth: string; // "YYYY-MM"
  pl: {
    sales: number;
    expenses: number;
    profit: number;
    distributable: number; // 分配原資
  };
  // 現場数などのメトリクス
  metrics?: {
    siteCount: number;
    salesGrowth: number;
  };
  opsRanking: {
    userId: string;
    points: number;
    badge?: string;
  }[];
  history: HistoryItem[];
};

export type ExpenseItem = {
  name: string; // 品名
  quantity?: number; // 数量（任意）
  unitPrice?: number; // 単価（任意）
};

export type ExpenseManualInput = {
  amount: number;
  merchantName: string;
  date: string;
  category?: string;
  description?: string;
  siteName?: string;
  items?: ExpenseItem[]; // 品名リスト（何を買ったか）
};

export type ExpensePayload = {
  amount: number;
  merchant: string;
  category: string;
  description: string;
  date: string;
  risk_level: "HIGH" | "LOW";
  status: string;
  voteId?: string;
  manual: boolean;
  siteName?: string;
  items?: ExpenseItem[]; // 品名リスト
};

/**
 * 履歴表示用の軽量アイテム
 */
export type HistoryItem = {
  id: string;
  kind: "sale" | "expense";
  date: string;
  title: string; // 取引先名 or 店名
  amount: number;
  category?: string; // 経費の場合のみ
  status?: string; // approved, pending_vote 等
};

// イベント種別の定数管理
export const ACCOUNTING_EVENTS = {
  SALE_REGISTERED: "accounting_sale_registered",
  EXPENSE_REGISTERED: "accounting_expense_registered", // 後ほど実装
  OPS_POINT_GRANTED: "ops_point_granted",
} as const;
