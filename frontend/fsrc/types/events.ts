// frontend/src/types/events.ts
// MVP logs API 型定義（simple text log）

export type LogEventSource = "daily-log";

// クライアント → サーバーに送る形
export type LogEventRequest = {
  userId: string;
  text: string;
  source: LogEventSource;
  ts?: number;
};

// サーバー → クライアントに返す形
export type LogEvent = {
  id: string;
  userId: string;
  text: string;
  source: LogEventSource;
  ts: number;
};

// Bandit / Paymaster / PersonalWeights で使う共通の履歴型
export type LogItem = {
  id: string;
  ts: number;
  text: string;
};