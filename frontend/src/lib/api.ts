import type { KpiKey, LuqoScore as BaseLuqoScore } from "../types/luqo";
import type { PayrollPreviewRequest } from "../types/payroll";
import type { LogEvent, LogEventRequest } from "../types/events";
import { apiClient } from "./apiClient";

export type LuqoScore = BaseLuqoScore & { reasoning: string };

export type LogItem = {
  id: string;
  ts: number;
  text: string;
};

export type LuqoScoreResponse = {
  ok: boolean;
  score: LuqoScore;
};

export type PersonalWeightsResponse = {
  ok: boolean;
  weights: { lu: number; q: number; o: number };
  probabilities: { lu: number; q: number; o: number };
  values: { lu: number; q: number; o: number };
  correlations: { lu: number; q: number; o: number };
  room: { lu: number; q: number; o: number };
  meta?: { n: number; note?: string };
};

export type BanditSuggestResponse = {
  ok: boolean;
  baseKpi: KpiKey;
  chosenKpi: KpiKey;
  scores: Record<"quality" | "growth" | "innovation", number>;
  suggestion: { action: string; luqoHint: string };
};

export type PaymasterComboRequest = {
  lu: number;
  q: number;
  o: number;
  tScore: number;
  history: ReadonlyArray<LogItem>;
};

export type PersonalWeightsRequest = {
  history: ReadonlyArray<LogItem>;
  temperature?: number;
};

export type PaymasterResponse = {
  ok: boolean;
  userId: string;
  luqoTotal: number;
  luqoWeights: { lu: number; q: number; o: number };
  combo: number;
};

// -------------------------------
// Logs
// -------------------------------
// 例: userId を外から渡す版
export async function postLogEventWithUser(
  text: string,
  userId: string,
): Promise<LogEvent> {
  const body: LogEventRequest = {
    userId,
    text,
    ts: Date.now(),
    source: "daily-log",
  };
  const data = await apiClient.post<{ event: LogEvent }>(
    "/api/v1/logs",
    body,
  );
  return data.event;
}

// -------------------------------
//  LUQO Score
// -------------------------------
export async function fetchLuqoScore(params: {
  month: string;
}): Promise<LuqoScoreResponse> {
  return apiClient.post<LuqoScoreResponse>(
    "/api/v1/luqo/score-month",
    params,
  );
}

// -------------------------------
//  Personal Bandit Weights
// -------------------------------
export async function fetchPersonalWeights(
  params: PersonalWeightsRequest,
): Promise<PersonalWeightsResponse> {
  return apiClient.post<PersonalWeightsResponse>(
    "/api/v1/bandit/personal-weights",
    params,
  );
}

// -------------------------------
//  Bandit Suggest
// -------------------------------
export async function fetchBanditSuggestion(
  params: { kpi: KpiKey; score: BaseLuqoScore },
  options?: { signal?: AbortSignal },
): Promise<BanditSuggestResponse> {
  return apiClient.post<BanditSuggestResponse>(
    "/api/v1/bandit/suggest",
    params,
    { signal: options?.signal },
  );
}

// -------------------------------
//  Paymaster Combo
// -------------------------------
export async function fetchPaymasterCombo(
  body: PaymasterComboRequest,
): Promise<PaymasterResponse> {
  return apiClient.post<PaymasterResponse>(
    "/api/v1/paymaster/combo",
    body,
  );
}

// -------------------------------
// Payroll Preview
// -------------------------------
export async function postPayrollPreview(
  payload: PayrollPreviewRequest,
): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>(
    "/api/v1/payroll/preview",
    payload,
  );
}
