import { API_BASE_URL } from "../config";

type RequestOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
};

const baseUrl = API_BASE_URL.endsWith("/")
  ? API_BASE_URL
  : `${API_BASE_URL}/`;

const resolveUrl = (path: string) => {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return `${baseUrl}${path.replace(/^\//, "")}`;
  }
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveUrl(path);
  const res = await fetch(url, init);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`${init.method ?? "GET"} ${url} failed:`, res.status, text);
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, {
      method: "GET",
      signal: options?.signal,
      headers: options?.headers,
    });
  },
  post<T>(path: string, body: unknown, options?: RequestOptions) {
    return request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      signal: options?.signal,
    });
  },
};
