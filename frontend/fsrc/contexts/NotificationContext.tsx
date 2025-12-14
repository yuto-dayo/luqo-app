import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../services/supabase";

type NotificationItem = {
  id?: string;
  text: string;
  createdAt?: string;
  kind?: string;
};

type NotificationContextType = {
  count: number;
  notifications: NotificationItem[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

type NotificationProviderProps = {
  children: ReactNode;
};

// グローバルな状態（モジュールスコープで管理）
let globalNotifications: NotificationItem[] = [];
let globalCount = 0;
let subscriptionRef: { unsubscribe: () => void } | null = null;
let isSubscribed = false;
let isFetching = false;
let retryTimer: any = null;
let retryCount = 0;
const maxRetries = 5; // 最大リトライ回数
const baseRetryDelay = 1000; // 初期リトライ遅延（ミリ秒）

// 認証状態をチェック
function isAuthenticated(): boolean {
  return !!localStorage.getItem("session_token");
}

// 状態を更新するコールバック
let updateState: ((n: NotificationItem[], c: number) => void) | null = null;

// 通知を取得する関数（グローバルに1つだけ）
async function fetchNotificationsGlobal(): Promise<void> {
  // 認証されていない場合は何もしない
  if (!isAuthenticated()) {
    return;
  }

  // 既にフェッチ中の場合はスキップ
  if (isFetching) {
    return;
  }

  try {
    isFetching = true;

    const res = await apiClient.get<{ items: NotificationItem[] }>("/api/v1/notifications");
    if (res?.items) {
      globalNotifications = res.items;
      globalCount = res.items.length;
      // 状態を更新
      if (updateState) {
        updateState(globalNotifications, globalCount);
      }
    }
  } catch (e: any) {
    // AbortError（リクエストがキャンセルされた場合）は正常な動作なので無視
    if (e?.name === "AbortError" || e?.isAborted) {
      return;
    }
    // 401エラーの場合はサブスクリプションを停止
    if (e?.status === 401) {
      stopRealtime();
      return;
    }
    // その他のエラーは開発環境でのみログ出力
    if (import.meta.env.DEV) {
      console.warn("[NotificationContext] Failed to fetch notifications:", e);
    }
  } finally {
    isFetching = false;
  }
}

// リトライをクリーンアップする関数
function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// 指数バックオフ付きリトライ関数
function scheduleRetry(): void {
  clearRetry();

  if (retryCount >= maxRetries) {
    console.warn("[NotificationContext] Max retries reached. Giving up.");
    retryCount = 0;
    return;
  }

  // 指数バックオフ: 1秒、2秒、4秒、8秒、16秒...
  const delay = baseRetryDelay * Math.pow(2, retryCount);
  retryCount += 1;

  console.log(`[NotificationContext] Scheduling retry ${retryCount}/${maxRetries} in ${delay}ms`);

  retryTimer = setTimeout(() => {
    if (!isSubscribed && isAuthenticated()) {
      startRealtime();
    }
  }, delay);
}

// Supabase Realtimeサブスクリプションの開始
function startRealtime(): void {
  // 認証されていない場合は開始しない
  if (!isAuthenticated()) {
    return;
  }

  // 既に開始済みの場合は何もしない
  if (isSubscribed || subscriptionRef) {
    return;
  }

  try {
    // 既存のサブスクリプションをクリーンアップ
    const currentSub = subscriptionRef;
    if (currentSub) {
      (currentSub as any).unsubscribe();
      subscriptionRef = null;
    }

    // eventsテーブルで通知（kind="notification"）のみを監視
    const channel = supabase
      .channel(`notifications-updates-${Date.now()}`) // 一意なチャンネル名で重複を防ぐ
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE すべて
          schema: "public",
          table: "events",
          filter: "kind=eq.notification", // 通知のみフィルタ
        },
        (payload) => {
          console.log("[NotificationContext] Event detected:", payload.eventType);
          // DB側で変更があった場合のみ更新
          void fetchNotificationsGlobal();
        }
      )
      .subscribe((status) => {
        console.log("[NotificationContext] Subscription status:", status);

        if (status === "SUBSCRIBED") {
          isSubscribed = true;
          retryCount = 0; // 成功したらリトライカウントをリセット
          clearRetry();
          console.log("[NotificationContext] Successfully subscribed");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[NotificationContext] Connection failed (${status}), will retry automatically`);
          isSubscribed = false;

          // 自動リトライをスケジュール
          scheduleRetry();
        } else if (status === "CLOSED") {
          // CLOSEDは正常な状態（ページが非表示になった時など）なので、リトライしない
          isSubscribed = false;
          clearRetry();
        }
      });

    subscriptionRef = {
      unsubscribe: () => {
        channel.unsubscribe();
        isSubscribed = false;
        subscriptionRef = null;
        clearRetry();
      },
    };
  } catch (err) {
    console.error("[NotificationContext] Setup error:", err);
    isSubscribed = false;

    // エラー時もリトライをスケジュール
    scheduleRetry();
  }
}

function stopRealtime(): void {
  clearRetry();
  if (subscriptionRef) {
    subscriptionRef.unsubscribe();
    subscriptionRef = null;
    isSubscribed = false;
  }
  retryCount = 0; // 停止時はリトライカウントをリセット
}

/**
 * 通知データを管理するProvider
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [count, setCount] = useState(globalCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>(globalNotifications);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // ページの可視性・フォーカス管理
  useEffect(() => {
    mountedRef.current = true;

    // 状態更新コールバックを設定
    updateState = (n, c) => {
      if (mountedRef.current) {
        setNotifications(n);
        setCount(c);
      }
    };

    let isPageVisible = !document.hidden;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;

      if (nowVisible && !isPageVisible) {
        // ページが表示された: Realtime接続のみ再開（APIは呼ばない - Realtimeが変更を監視しているため）
        focusTimer = setTimeout(() => {
          startRealtime();
        }, 500);
      } else if (!nowVisible && isPageVisible) {
        // ページが非表示になった: Realtimeを停止してリソース節約
        if (focusTimer) clearTimeout(focusTimer);
        stopRealtime();
      }

      isPageVisible = nowVisible;
    };

    const handleFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      // Realtime接続のみ再開（APIは呼ばない - Realtimeが変更を監視しているため）
      focusTimer = setTimeout(() => {
        startRealtime();
      }, 500);
    };

    const handleBlur = () => {
      if (focusTimer) clearTimeout(focusTimer);
      stopRealtime();
    };

    // 初回: ページが表示されている場合は即座に開始
    if (isPageVisible) {
      void fetchNotificationsGlobal();
      startRealtime();
    }

    // イベントリスナー登録
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      mountedRef.current = false;
      if (focusTimer) clearTimeout(focusTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      stopRealtime();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated()) return;

    setLoading(true);
    try {
      // スロットリングを無視してすぐに取得
      isFetching = false;
      await fetchNotificationsGlobal();
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        count,
        notifications,
        loading,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * NotificationContextを使用するためのカスタムフック
 */
export const useNotificationContext = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
};
