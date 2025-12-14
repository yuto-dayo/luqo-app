import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * localStorageに保存されているセッショントークンをSupabaseクライアントに設定する
 * Realtime接続時に認証が必要な場合に使用
 */
export async function setSupabaseSession(): Promise<boolean> {
  const token = typeof window !== "undefined" 
    ? localStorage.getItem("session_token")
    : null;

  if (!token) {
    return false;
  }

  try {
    // トークンからセッション情報を復元
    // Supabaseのセッションは access_token, refresh_token, expires_at を含む必要がある
    // 簡易的に、既存のセッションがあるか確認してから設定
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || session.access_token !== token) {
      // セッションが一致しない場合は、setSessionを使用してセッションを設定
      // ただし、refresh_tokenが必要なので、完全なセッション情報が必要
      // ここでは、既存のセッションが有効かどうかを確認するのみ
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.warn("[Supabase] Failed to validate token:", error?.message);
        return false;
      }
      
      // セッションを手動で設定（refresh_tokenがないため、完全ではない）
      // 実際には、ログイン時に取得した完全なセッション情報を使用する方が良い
      console.log("[Supabase] Token validated, but full session restoration requires refresh_token");
    }
    
    return true;
  } catch (error) {
    console.error("[Supabase] Error setting session:", error);
    return false;
  }
}

/**
 * Supabaseクライアントのセッションを初期化（アプリ起動時や認証状態変更時に呼ぶ）
 */
export async function initializeSupabaseSession(): Promise<void> {
  const token = typeof window !== "undefined" 
    ? localStorage.getItem("session_token")
    : null;

  if (!token) {
    return;
  }

  try {
    // 既存のセッションをチェック
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // セッションがなく、トークンがある場合は、セッションを復元を試みる
    if (!session && token) {
      // ユーザー情報を取得してトークンの有効性を確認
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (!userError && user) {
        // トークンは有効だが、セッションが設定されていない
        // Realtime接続には認証されたクライアントが必要な場合がある
        console.log("[Supabase] Token valid but session not set. Realtime may require authenticated client.");
      }
    }
  } catch (error) {
    console.error("[Supabase] Error initializing session:", error);
  }
}

