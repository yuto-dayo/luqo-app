import { apiClient } from "../lib/apiClient";
import type { LogEvent, LogEventRequest, LogEventSource } from "../types/events";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_SOURCE: LogEventSource = "daily-log";

export type CreateLogEventInput = {
  text: string;
  userId?: string;
  source?: LogEventSource;
  ts?: number;
};

export function createLogEventRequest(
  input: CreateLogEventInput,
): LogEventRequest {
  const ts = typeof input.ts === "number" ? input.ts : Date.now();

  return {
    userId: input.userId ?? DEFAULT_USER_ID,
    text: input.text.trim(),
    source: input.source ?? DEFAULT_SOURCE,
    ts,
  };
}

export async function postLog(body: LogEventRequest): Promise<LogEvent> {
  const data = await apiClient.post<{ event: LogEvent }>(
    "/api/v1/logs",
    body,
  );
  return data.event;
}
