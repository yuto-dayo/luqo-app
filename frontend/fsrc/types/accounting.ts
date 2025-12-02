export type SalePayload = {
  amount: number;
  clientName: string;
  siteName?: string;
  occurredAt: string;
  inputType: "manual" | "ocr";
  description?: string;
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

export type ExpenseManualInput = {
  amount: number;
  merchantName: string;
  date: string;
  category?: string;
  description?: string;
  siteName?: string;
};

export type HistoryItem = {
  id: string;
  kind: "sale" | "expense";
  date: string;
  title: string;
  amount: number;
  category?: string;
  status?: string;
};

// イベント種別の定数管理（サーバー側と同期）
export const ACCOUNTING_EVENTS = {
  SALE_REGISTERED: "accounting_sale_registered",
  EXPENSE_REGISTERED: "accounting_expense_registered",
  OPS_POINT_GRANTED: "ops_point_granted",
} as const;
