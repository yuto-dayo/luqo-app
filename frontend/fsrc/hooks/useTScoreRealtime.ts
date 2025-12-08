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

  // Supabase Realtimeサブスクリプションの開始
  const startRealtime = useCallback(async () => {
    if (isSubscribedRef.current || !enabled) return;

    try {
      // star_statesテーブルの変更を監視
      const channel = supabase
        .channel("tscore-updates")
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
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[TScore Realtime] Failed, will retry on next interaction");
            isSubscribedRef.current = false;
          }
        });

      subscriptionRef.current = {
        unsubscribe: () => {
          channel.unsubscribe();
          isSubscribedRef.current = false;
        },
      };
    } catch (err) {
      console.error("[TScore Realtime] Setup error:", err);
      isSubscribedRef.current = false;
    }
  }, [enabled, onDataChange, targetUserId]);

  // サブスクリプションの停止
  const stopRealtime = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      isSubscribedRef.current = false;
    }
  }, []);

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
    };
  }, [enabled, startRealtime, stopRealtime]);

  return {
    refresh: onDataChange,
  };
}
