// Vite の環境変数（.env）から API のベースURLを取得
// 例: VITE_API_BASE_URL="http://localhost:4000"
// 
// 開発時（スマホから接続する場合）:
// - 環境変数が設定されていない場合、現在のホスト名を使用してAPIのURLを自動決定
// - 例: スマホから http://192.168.1.100:5173 にアクセスした場合、
//   APIは http://192.168.1.100:4000 に自動的に接続されます
export function getApiBaseUrl(): string {
  // 環境変数が明示的に設定されている場合はそれを使用
  if (import.meta.env.VITE_API_BASE_URL) {
    if (import.meta.env.DEV && typeof window !== "undefined") {
      console.log("[Config] Using VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);
    }
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 開発環境で、ブラウザから実行されている場合
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    // localhost の場合はデフォルトのポートを使用
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const url = "http://localhost:4000";
      if (import.meta.env.DEV) {
        console.log(`[Config] getApiBaseUrl() - localhost detected, returning: ${url}`);
      }
      return url;
    }
    
    // それ以外（スマホから接続した場合など）は同じホスト名でポート4000を使用
    const url = `http://${hostname}:4000`;
    if (import.meta.env.DEV) {
      console.log(`[Config] getApiBaseUrl() - hostname: ${hostname}, origin: ${origin}, returning: ${url}`);
    }
    return url;
  }

  // 本番環境またはサーバーサイドレンダリング時
  const url = "http://localhost:4000";
  if (import.meta.env.DEV) {
    console.log(`[Config] getApiBaseUrl() - fallback, returning: ${url}`);
  }
  return url;
}

// 後方互換性のため、定数としてもエクスポート（動的に取得）
// 注意: この値はモジュール読み込み時に一度だけ評価されるため、
// スマホから接続する場合は getApiBaseUrl() を直接使用することを推奨
export const API_BASE_URL = getApiBaseUrl();

// 開発環境でAPIのURLをログ出力（デバッグ用）
if (import.meta.env.DEV && typeof window !== "undefined") {
  console.log("[Config] API Base URL (initial):", API_BASE_URL);
  console.log("[Config] Current hostname:", window.location.hostname);
  console.log("[Config] Current origin:", window.location.origin);
  console.log("[Config] API Base URL (dynamic):", getApiBaseUrl());
}
