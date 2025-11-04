// LUQOシステム共通の Event 型定義（フロント側）
// ここを「唯一の真実の寸法」として他の型を揃える。

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

// ===== 各イベントの payload 型 =====

export interface LogPayload {
  text: string; // 自然文ログ（#LOG, #L, #Q, #O など含む）
  tags: string[]; // ["#LOG", "#L", "#D", ...] など
}

export interface ExpensePayload {
  category: string; // "交通費" "道具" など
  amount: number; // 円
  memo?: string;
}

export interface SalePayload {
  siteId: string; // 現場ID
  revenue: number; // 売上（粗）
  memo?: string;
}

export interface LuqoScorePayload {
  month: string; // "2025-10" など
  lu: number;
  q: number;
  o: number;
  total: number; // LUQO合成スコア（重み付き）
}

// ===== 具象イベント型 =====

export type LogEvent = BaseEvent<"log", LogPayload>;
export type ExpenseEvent = BaseEvent<"expense", ExpensePayload>;
export type SaleEvent = BaseEvent<"sale", SalePayload>;
export type LuqoScoreEvent = BaseEvent<"luqo_score", LuqoScorePayload>;

export type AnyEvent = LogEvent | ExpenseEvent | SaleEvent | LuqoScoreEvent;

// ===== ヘルパー関数 =====

// 新規イベントをフロント側で生成するためのユーティリティ。
// id はとりあえず crypto.randomUUID() で発行して、
// あとでサーバー側で上書きしてもOKという運用想定。
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
