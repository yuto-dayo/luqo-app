import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../services/supabase";

/**
 * TScore関連のリアルタイム更新フック
 * star_statesテーブルの変更を監視し、変更があった場合のみコールバックを実行
 */
type TScoreEventHandler = (userId?: string) => void;

export function useTScoreRealtime(
  onDataChange: TScoreEventHandler,
  enabled: boolean = true,
  targetUserId?: string
) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isSubscribedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const startRealtimeRef = useRef<(() => Promise<void>) | null>(null);
  const maxRetries = 5; // 最大リトライ回数
  const baseRetryDelay = 1000; // 初期リトライ遅延（ミリ秒）

  // リトライをクリーンアップする関数
  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // 指数バックオフ付きリトライ関数
  const scheduleRetry = useCallback(() => {
    clearRetry();
    
    if (retryCountRef.current >= maxRetries) {
      console.warn("[TScore Realtime] Max retries reached. Giving up.");
      retryCountRef.current = 0;
      return;
    }

    // 指数バックオフ: 1秒、2秒、4秒、8秒、16秒...
    const delay = baseRetryDelay * Math.pow(2, retryCountRef.current);
    retryCountRef.current += 1;

    console.log(`[TScore Realtime] Scheduling retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`);
    
    retryTimerRef.current = setTimeout(() => {
      if (!isSubscribedRef.current && enabled && startRealtimeRef.current) {
        void startRealtimeRef.current();
      }
    }, delay);
  }, [enabled, clearRetry]);

  // Supabase Realtimeサブスクリプションの開始
  const startRealtime = useCallback(async () => {
    if (isSubscribedRef.current || !enabled) return;

    // 既存のサブスクリプションをクリーンアップ
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    try {
      // star_statesテーブルの変更を監視
      const channel = supabase
        .channel(`tscore-updates-${Date.now()}`) // 一意なチャンネル名で重複を防ぐ
        .on(
          "postgres_changes",
          {
            event: "*", // INSERT, UPDATE, DELETE すべて
            schema: "public",
            table: "star_states",
          },
          (payload) => {
            console.log("[TScore Realtime] Event detected:", payload.eventType, payload.new);
            
            // 特定のユーザーの変更のみ監視する場合
            if (targetUserId) {
              const changedUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id;
              if (changedUserId === targetUserId) {
                onDataChange(targetUserId);
              } else {
                // 他のユーザーの変更でも、承認待ちリストに影響する可能性があるため通知
                onDataChange();
              }
            } else {
              // 全ユーザーの変更を監視
              onDataChange();
            }
          }
        )
        .subscribe((status) => {
          console.log("[TScore Realtime] Subscription status:", status);
          
          if (status === "SUBSCRIBED") {
            isSubscribedRef.current = true;
            retryCountRef.current = 0; // 成功したらリトライカウントをリセット
            clearRetry();
            console.log("[TScore Realtime] Successfully subscribed");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`[TScore Realtime] Connection failed (${status}), will retry automatically`);
            isSubscribedRef.current = false;
            
            // 自動リトライをスケジュール
            scheduleRetry();
          } else if (status === "CLOSED") {
            // CLOSEDは正常な状態（ページが非表示になった時など）なので、リトライしない
            isSubscribedRef.current = false;
            clearRetry();
          }
        });

      subscriptionRef.current = {
        unsubscribe: () => {
          channel.unsubscribe();
          isSubscribedRef.current = false;
          clearRetry();
        },
      };
    } catch (err) {
      console.error("[TScore Realtime] Setup error:", err);
      isSubscribedRef.current = false;
      
      // エラー時もリトライをスケジュール
      scheduleRetry();
    }
  }, [enabled, onDataChange, targetUserId, clearRetry, scheduleRetry]);

  // startRealtimeRefを更新
  useEffect(() => {
    startRealtimeRef.current = startRealtime;
  }, [startRealtime]);

  // サブスクリプションの停止
  const stopRealtime = useCallback(() => {
    clearRetry();
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      isSubscribedRef.current = false;
    }
    retryCountRef.current = 0; // 停止時はリトライカウントをリセット
  }, [clearRetry]);

  // ページの可視性・フォーカス管理
  useEffect(() => {
    if (!enabled) {
      stopRealtime();
      return;
    }

    let isPageVisible = !document.hidden;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      
      if (nowVisible && !isPageVisible) {
        // ページが表示された: 少し遅延してからRealtimeを開始
        focusTimer = setTimeout(() => {
          void startRealtime();
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
      focusTimer = setTimeout(() => {
        void startRealtime();
      }, 500);
    };

    const handleBlur = () => {
      if (focusTimer) clearTimeout(focusTimer);
      stopRealtime();
    };

    // 初回: ページが表示されている場合は即座に開始
    if (isPageVisible) {
      void startRealtime();
    }

    // イベントリスナー登録
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      stopRealtime();
      clearRetry();
    };
  }, [enabled, startRealtime, stopRealtime, clearRetry]);

  return {
    refresh: onDataChange,
  };
}
