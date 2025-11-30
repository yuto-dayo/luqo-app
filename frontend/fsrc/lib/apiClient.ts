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

// ★ 追加: ローカルストレージからトークンを取得するヘルパー
function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("session_token")
    : null;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveUrl(path);

  // ★ 変更: 既存のヘッダーに認証ヘッダーをマージする
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(init.headers ?? {}),
  };

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    // 401エラー（認証切れ）ならログイン画面へ飛ばす
    if (res.status === 401) {
      console.warn("Unauthorized access. Redirecting to login...");
      // トークンをクリア
      if (typeof window !== "undefined") {
        localStorage.removeItem("session_token");
        localStorage.removeItem("luqo_user_id");
        window.location.href = "/login";
      }
    }

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
      headers: options?.headers, // request関数内でContent-Type等は付与されるのでシンプルに
      signal: options?.signal,
    });
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, {
      method: "DELETE",
      headers: options?.headers,
      signal: options?.signal,
    });
  },
};
