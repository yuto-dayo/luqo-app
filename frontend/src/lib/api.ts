import type { LogEvent } from "./events";

export type LuqoScore = {
  LU: number;
  Q: number;
  O: number;
  total: number;
  reasoning: string;
};

export type LuqoScoreResponse = {
  ok: boolean;
  score: LuqoScore;
};

const API_BASE =
  (import.meta.env.VITE_API_BASE?.replace(/\/$/, "") as string | undefined) ||
  "http://localhost:4000";

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}${
        text ? ` - ${text}` : ""
      }`
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    return undefined as unknown as T;
  }
}

// LogEvent をそのままサーバーに送る
export async function postLogEvent(event: LogEvent): Promise<LogEvent> {
  const data = await request<{ event: LogEvent }>("/api/v1/luqo/log", {
    method: "POST",
    body: JSON.stringify({ event }),
  });
  return data.event;
}

export async function fetchLuqoScore(params: {
  userId: string;
  month: string;
}): Promise<LuqoScoreResponse> {
  return request<LuqoScoreResponse>("/api/v1/luqo/score-month", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
