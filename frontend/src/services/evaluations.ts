import { apiClient } from "../lib/apiClient";

export type EvaluationPayload = {
  logs: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
};

async function postEvaluation<T>(path: string, payload: EvaluationPayload) {
  if (!Array.isArray(payload.logs) || payload.logs.length === 0) {
    throw new Error("logs must be a non-empty string array");
  }

  return apiClient.post<T>(path, payload);
}

export function evaluateLuqo(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/luqo/evaluate",
    payload,
  );
}

export function evaluateTScore(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/tscore/evaluate",
    payload,
  );
}

export function evaluatePaymaster(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/paymaster/evaluate",
    payload,
  );
}

export function evaluateIncident(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/incidents/evaluate",
    payload,
  );
}
