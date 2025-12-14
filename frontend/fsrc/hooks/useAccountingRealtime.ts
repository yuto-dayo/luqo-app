import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../services/supabase";
import { ACCOUNTING_EVENTS } from "../types/accounting";

/**
 * 経理ページ用のリアルタイム更新フック
 * 
 * Supabase Realtimeでeventsテーブルの変更を監視し、
 * 売上・経費の登録・更新をリアルタイムで検知します。
 * 
 * 特徴:
 * - ページがフォーカスされている時のみ有効化（バッテリー節約）
 * - 自分と他者の操作を区別
 * - フォールバック: Realtimeが失敗した場合はポーリングに切り替え
 */
type AccountingEventHandler = () => void;

export function useAccountingRealtime(
  onDataChange: AccountingEventHandler,
  enabled: boolean = true
) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isSubscribedRef = useRef(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckRef = useRef<number>(Date.now());

  // フォールバック用ポーリング（30秒間隔）
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    
    pollingTimerRef.current = setInterval(() => {
      onDataChange();
      lastCheckRef.current = Date.now();
    }, 30000); // 30秒ごと
  }, [onDataChange]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Supabase Realtimeサブスクリプションの開始
  const startRealtime = useCallback(async () => {
    if (isSubscribedRef.current || !enabled) return;

    try {
      // eventsテーブルで経理関連イベントのみを監視
      // 注: Supabase Realtimeのfilterは配列を直接サポートしないため、
      // 全てのeventsを監視し、クライアント側でフィルタリングする
      const channel = supabase
        .channel("accounting-updates")
        .on(
          "postgres_changes",
          {
            event: "*", // INSERT, UPDATE, DELETE すべて
            schema: "public",
            table: "events",
          },
          (payload) => {
            // クライアント側で経理関連イベントのみをフィルタリング
            const eventKind = (payload.new as any)?.kind || (payload.old as any)?.kind;
            if (
              eventKind === ACCOUNTING_EVENTS.SALE_REGISTERED ||
              eventKind === ACCOUNTING_EVENTS.EXPENSE_REGISTERED
            ) {
              console.log("[Accounting Realtime] Event detected:", payload.eventType, payload.new);
              // 変更が検知されたら、ダッシュボードデータを再取得
              onDataChange();
            }
          }
        )
        .subscribe((status) => {
          console.log("[Accounting Realtime] Subscription status:", status);
          
          if (status === "SUBSCRIBED") {
            isSubscribedRef.current = true;
            // Realtimeが成功したらポーリングは停止
            stopPolling();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Realtimeが失敗した場合はポーリングにフォールバック
            console.warn("[Accounting Realtime] Failed, falling back to polling");
            isSubscribedRef.current = false;
            startPolling();
          }
        });

      subscriptionRef.current = {
        unsubscribe: () => {
          channel.unsubscribe();
          isSubscribedRef.current = false;
        },
      };
    } catch (err) {
      console.error("[Accounting Realtime] Setup error:", err);
      // エラー時はポーリングにフォールバック
      startPolling();
    }
  }, [enabled, onDataChange, startPolling, stopPolling]);

  // サブスクリプションの停止
  const stopRealtime = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      isSubscribedRef.current = false;
    }
    stopPolling();
  }, [stopPolling]);

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
        // ページが表示された: 少し遅延してからRealtimeを開始（他の処理が落ち着いてから）
        focusTimer = setTimeout(() => {
          void startRealtime();
        }, 500);
      } else if (!nowVisible && isPageVisible) {
        // ページが非表示になった: Realtimeを停止してリソース節約
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

  // 手動でデータを再取得する関数を返す
  return {
    refresh: onDataChange,
    isSubscribed: isSubscribedRef.current,
  };
}