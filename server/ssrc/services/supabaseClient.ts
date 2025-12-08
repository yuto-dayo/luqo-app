import { createClient } from "@supabase/supabase-js";

// Ensure these are set in your environment (.env)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 環境変数の検証（起動時にクラッシュを防ぐ）
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is not set");
}
if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY environment variable is not set");
}

/**
 * タイムアウト付きカスタムfetch関数（リトライ機能付き）
 * Supabaseへの接続タイムアウトを60秒に設定し、リトライロジックを追加
 */
const createFetchWithTimeout = (timeoutMs: number = 60000, maxRetries: number = 2) => {
  return async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
    let lastError: any;
    // URLを文字列に変換（スコープ外でも使用可能にする）
    const urlString = typeof url === 'string' ? url : url.toString();
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(urlString, {
          ...options,
          signal: controller.signal,
          // タイムアウトを明示的に設定
          // @ts-ignore - undiciのオプション
          connectTimeout: timeoutMs,
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
        
        // タイムアウトエラーまたは接続エラーの場合のみリトライ
        const isRetryable = 
          error.name === "AbortError" ||
          error.message?.includes("timeout") ||
          error.message?.includes("fetch failed") ||
          error.code === "UND_ERR_CONNECT_TIMEOUT";
        
        if (isRetryable && attempt < maxRetries) {
          // 指数バックオフでリトライ（1秒、2秒、4秒...）
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`Supabase fetch retry ${attempt + 1}/${maxRetries} after ${delayMs}ms`, {
            url: urlString,
            error: error.message || error.code,
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // リトライ不可能または最大リトライ回数に達した場合
        if (error.name === "AbortError") {
          throw new Error(`Request timeout after ${timeoutMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        }
        throw error;
      }
    }
    
    // すべてのリトライが失敗した場合
    throw lastError || new Error("Failed to fetch after retries");
  };
};

// タイムアウト設定（60秒、最大2回リトライ）
const customFetch = createFetchWithTimeout(60000, 2);

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  global: {
    fetch: customFetch,
  },
});

export const createAuthenticatedClient = (token: string) => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      fetch: customFetch,
    },
  });
};

/**
 * Retrieve total number of registered users.
 */
export async function getUserCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Failed to count users", error);
    return 0;
  }
  return count ?? 0;
}
