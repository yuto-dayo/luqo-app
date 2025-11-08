// frontend/src/lib/events.ts
// LUQOシステム共通の Event 型定義（フロント側）

// イベント種別
export type EventKind = "log" | "expense" | "sale" | "luqo_score";

// ベースとなるイベント型
export interface BaseEvent<K extends EventKind = EventKind, P = unknown> {
  id: string; // UUID（フロント仮発行でOK）
  userId: string; // 職人ID
  kind: K; // イベント種別
  occurredAt: string; // 実際に起きた日時（ISO文字列）
  recordedAt: string; // システムに記録した日時（ISO文字列）
  payload: P; // 種別ごとの中身
}

// ---- 各ペイロード型 ----

export interface LogPayload {
  text: string;
  tags?: string[];
}

export interface ExpensePayload {
  amount: number;
  category: string;
  note?: string;
}

export interface SalePayload {
  amount: number;
  clientName?: string;
  note?: string;
}

export interface LuqoScorePayload {
  month: string; // "2025-10" など
  lu: number;
  q: number;
  o: number;
  total: number;
}

// ---- 各イベント型 ----

export type LogEvent = BaseEvent<"log", LogPayload>;
export type ExpenseEvent = BaseEvent<"expense", ExpensePayload>;
export type SaleEvent = BaseEvent<"sale", SalePayload>;
export type LuqoScoreEvent = BaseEvent<"luqo_score", LuqoScorePayload>;

export type AnyEvent = LogEvent | ExpenseEvent | SaleEvent | LuqoScoreEvent;

// ---- ヘルパー ----

export const createEvent = <K extends EventKind, P>(args: {
  userId: string;
  kind: K;
  occurredAt: string; // new Date().toISOString() など
  payload: P;
}): BaseEvent<K, P> => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId: args.userId,
    kind: args.kind,
    occurredAt: args.occurredAt,
    recordedAt: now,
    payload: args.payload,
  };
};

// ログ専用ショートカット
export const createLogEvent = (args: {
  userId: string;
  text: string;
  tags?: string[];
  occurredAt?: string;
}): LogEvent =>
  createEvent<"log", LogPayload>({
    userId: args.userId,
    kind: "log",
    occurredAt: args.occurredAt ?? new Date().toISOString(),
    payload: {
      text: args.text,
      tags: args.tags,
    },
  }) as LogEvent;
