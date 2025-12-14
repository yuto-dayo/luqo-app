import { getApiBaseUrl } from "../config";

type RequestOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
};

// 動的にAPIのベースURLを取得（スマホから接続する場合に対応）
function getBaseUrl(): string {
  // 開発環境で、ブラウザから実行されている場合
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    
    // localhost の場合はデフォルトのポートを使用
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:4000/";
    }
    
    // それ以外（スマホから接続した場合など）は同じホスト名でポート4000を使用
    // 環境変数が設定されている場合はそれを使用（ただし、localhostを含む場合は現在のhostnameに置き換え）
    if (import.meta.env.VITE_API_BASE_URL) {
      let envUrl = import.meta.env.VITE_API_BASE_URL;
      // 環境変数にlocalhostが含まれている場合、現在のhostnameに置き換え
      if (envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
        // ポート番号を保持しながらhostnameを置き換え
        const portMatch = envUrl.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : "4000";
        envUrl = `http://${hostname}:${port}`;
      }
      return envUrl.endsWith("/") ? envUrl : `${envUrl}/`;
    }
    
    const url = `http://${hostname}:4000/`;
    if (import.meta.env.DEV) {
      console.log(`[API Client] getBaseUrl() - hostname: ${hostname}, returning: ${url}`);
    }
    return url;
  }
  
  // フォールバック: getApiBaseUrl() を使用
  let apiBaseUrl = getApiBaseUrl();
  // 開発環境で、ブラウザから実行されている場合、localhostを現在のhostnameに置き換え
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      if (apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1")) {
        const portMatch = apiBaseUrl.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : "4000";
        apiBaseUrl = `http://${hostname}:${port}`;
      }
    }
  }
  return apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
}

const resolveUrl = (path: string) => {
  const baseUrl = getBaseUrl(); // getBaseUrl()内で既にlocalhostの置き換えが行われているため、ここでは不要
  
  // パスが既に完全なURLの場合は、localhostを置き換えてから返す
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (import.meta.env.DEV && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        if (path.includes("localhost") || path.includes("127.0.0.1")) {
          const correctedPath = path.replace(/localhost|127\.0\.0\.1/g, hostname);
          console.warn(
            `[API Client] WARNING: Path contained localhost, corrected: ${path} -> ${correctedPath}`
          );
          return correctedPath;
        }
      }
    }
    if (import.meta.env.DEV) {
      console.warn(
        `[API Client] Path is already a full URL: ${path}. ` +
        `This should be a relative path. Base URL: ${baseUrl}`
      );
    }
    return path;
  }
  
  try {
    const resolved = new URL(path, baseUrl).toString();
    
    // 解決されたURLにlocalhostが含まれている場合は、再度置き換え（念のため）
    if (import.meta.env.DEV && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        if (resolved.includes("localhost") || resolved.includes("127.0.0.1")) {
          const corrected = resolved.replace(/localhost|127\.0\.0\.1/g, hostname);
          console.warn(
            `[API Client] WARNING: Resolved URL contained localhost, corrected: ${resolved} -> ${corrected}`
          );
          return corrected;
        }
      }
    }
    
    // デバッグログは必要最小限に（開発環境でのみ）
    if (import.meta.env.DEV) {
      // ログを減らすため、最初の数回のみ表示
      const logKey = `api_log_count_${path}`;
      const count = (sessionStorage.getItem(logKey) || "0");
      if (parseInt(count) < 3) {
        console.log(`[API Client] Resolved URL: ${path} + ${baseUrl} = ${resolved}`);
        sessionStorage.setItem(logKey, String(parseInt(count) + 1));
      }
    }
    return resolved;
  } catch (error) {
    // URL解決に失敗した場合は、単純に結合
    const fallback = `${baseUrl}${path.replace(/^\//, "")}`;
    if (import.meta.env.DEV) {
      console.warn(`[API Client] URL resolution failed, using fallback: ${fallback}`, error);
    }
    return fallback;
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
  const baseUrl = getBaseUrl();

  // デバッグ用: 開発環境でリクエスト情報をログ出力（必要最小限に）
  if (import.meta.env.DEV) {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "unknown";
    // ログを減らすため、最初の数回のみ詳細ログを表示
    const logKey = `api_request_log_${path}`;
    const count = (sessionStorage.getItem(logKey) || "0");
    if (parseInt(count) < 2) {
      console.log(`[API Request] ${init.method ?? "GET"} ${url}`, {
        baseUrl,
        path,
        hostname,
        resolvedUrl: url,
      });
      sessionStorage.setItem(logKey, String(parseInt(count) + 1));
    }
    
    // localhostに接続しようとしている場合に警告（これは問題なので常に表示）
    if (url.includes("localhost") && hostname !== "localhost" && hostname !== "127.0.0.1") {
      console.warn(
        `[API Warning] Attempting to connect to localhost from ${hostname}. ` +
        `This will fail on mobile devices. Expected URL: ${url.replace("localhost", hostname)}`
      );
    }
  }

  // ★ 変更: 既存のヘッダーに認証ヘッダーをマージする
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(init.headers ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (error: any) {
    // AbortError（リクエストがキャンセルされた場合）は無視
    if (error.name === "AbortError" || error.message?.includes("aborted")) {
      // コンポーネントがアンマウントされた際の正常なキャンセルなので、エラーを再スローしない
      const abortError = new Error("Request aborted") as any;
      abortError.name = "AbortError";
      abortError.isAborted = true;
      throw abortError;
    }
    
    // ネットワークエラー（接続できない場合など）
    console.error(`[API Network Error] ${init.method ?? "GET"} ${url}:`, error);
    const networkError = new Error(
      `Network error: ${error.message || "Failed to connect to server"}. ` +
      `Please check if the server is running at ${url}`
    ) as any;
    networkError.status = 0;
    networkError.isNetworkError = true;
    throw networkError;
  }

  if (!res.ok) {
    // 401エラー（認証切れ）ならログイン画面へ飛ばす
    if (res.status === 401) {
      // 既にログインページにいる場合はリダイレクトしない
      const isOnLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
      
      if (!isOnLoginPage && typeof window !== "undefined") {
        console.warn("Unauthorized access. Redirecting to login...");
        // トークンをクリア
        localStorage.removeItem("session_token");
        localStorage.removeItem("luqo_user_id");
        
        // リダイレクトは一度だけ行う（フラグを設定）
        if (!(window as any).__redirectingToLogin) {
          (window as any).__redirectingToLogin = true;
          window.location.href = "/login";
        }
      }
    }

    // エラーレスポンスのJSONを取得
    let errorData: any = null;
    try {
      const text = await res.text();
      if (text) {
        errorData = JSON.parse(text);
      }
    } catch {
      // JSONパースに失敗した場合は無視
    }
    
    console.error(`${init.method ?? "GET"} ${url} failed:`, res.status, errorData || "No error details");
    
    // エラーデータがある場合は、それを含めたエラーをthrow
    const error = new Error(errorData?.error || `${init.method ?? "GET"} ${path} failed: ${res.status}`) as any;
    error.status = res.status;
    error.data = errorData;
    throw error;
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
  put<T>(path: string, body: unknown, options?: RequestOptions) {
    return request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: options?.headers,
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

