// LUQOシステム共通の Event 型定義（サーバー側）
// フロントの frontend/src/lib/events.ts と意味を揃えること。

export type EventKind = "log" | "expense" | "sale" | "luqo_score";

export interface BaseEvent<K extends EventKind = EventKind, P = unknown> {
  id: string;
  userId: string;
  kind: K;
  occurredAt: string;
  recordedAt: string;
  payload: P;
}

export interface LogPayload {
  text: string;
  tags: string[];
}

export interface ExpensePayload {
  category: string;
  amount: number;
  memo?: string;
}

export interface SalePayload {
  siteId: string;
  revenue: number;
  memo?: string;
}

export interface LuqoScorePayload {
  month: string;
  lu: number;
  q: number;
  o: number;
  total: number;
}

export type LogEvent = BaseEvent<"log", LogPayload>;
export type ExpenseEvent = BaseEvent<"expense", ExpensePayload>;
export type SaleEvent = BaseEvent<"sale", SalePayload>;
export type LuqoScoreEvent = BaseEvent<"luqo_score", LuqoScorePayload>;

export type AnyEvent = LogEvent | ExpenseEvent | SaleEvent | LuqoScoreEvent;

// LUQOスコア用のログ行ビュー
export type EventRow = {
  id?: string;
  userId?: string;
  month?: string;
  createdAt?: string;
  text?: string | null;
  raw?: {
    text?: string | null;
    [key: string]: any;
  };
  [key: string]: any;
};
