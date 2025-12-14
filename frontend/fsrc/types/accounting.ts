/**
 * 工事カテゴリ定義
 * work_categories テーブルと同期
 */
export type WorkCategory = {
  id: string; // UUID
  code: string; // システム内部識別子（例: 'cloth', 'electric'）
  label: string; // 表示名（例: 'クロス工事', '電気工事'）
  defaultWeight: number; // TScore計算時の重み係数（デフォルト: 1.0）
  isActive: boolean; // アクティブフラグ
  createdAt?: string;
  updatedAt?: string;
};

export type SalePayload = {
  amount: number;
  clientName: string;
  siteName?: string;
  occurredAt: string;
  inputType: "manual" | "ocr";
  description?: string;
  // 工事カテゴリ情報
  workCategoryId?: string; // 工事カテゴリID（UUID）
  workCategoryLabel?: string; // 工事カテゴリ表示名（スナップショット用）
};

export type AccountingDashboardData = {
  currentMonth: string;
  pl: {
    sales: number;
    expenses: number;
    profit: number;
    distributable: number;
  };
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

export type SalesRegistrationResponse = {
  message: string;
  earnedPoints: number;
  aiMessage: string;
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

export type HistoryItem = {
  id: string;
  kind: "sale" | "expense";
  date: string;
  title: string;
  amount: number;
  category?: string;
  status?: string; // approved, pending_vote, rejected
};

// イベント種別の定数管理（サーバー側と同期）
export const ACCOUNTING_EVENTS = {
  SALE_REGISTERED: "accounting_sale_registered",
  EXPENSE_REGISTERED: "accounting_expense_registered",
  OPS_POINT_GRANTED: "ops_point_granted",
} as const;

// 請求書関連の型定義
export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: string;
  siteName?: string; // 現場名（分離表示用）
};

export type InvoiceData = {
  invoiceNumber: string;
  issueDate: string;
  clientName: string;
  issuer: {
    companyName: string;
    representative: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  taxBreakdown: {
    taxable10: {
      amount: number;
      tax: number;
    };
    exempt: {
      amount: number;
      tax: number;
    };
  };
  period: {
    startDate: string;
    endDate: string;
  };
};

export type InvoiceResponse = {
  ok: boolean;
  invoice: InvoiceData;
};

/**
 * 取引詳細情報
 */
export type TransactionDetail = {
  id: string;
  kind: "sale" | "expense";
  createdAt: string;
  createdBy: {
    userId: string;
    userName: string;
  };
  date: string;
  title: string;
  amount: number;
  category?: string;
  status?: string;
  description?: string;
  siteName?: string;
  // 売上固有
  tax?: number;
  workCategoryId?: string;
  workCategoryLabel?: string;
  inputType?: string;
  opsReward?: number;
  // 経費固有
  riskLevel?: "HIGH" | "LOW";
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewFeedback?: string;
  items?: ExpenseItem[];
};
