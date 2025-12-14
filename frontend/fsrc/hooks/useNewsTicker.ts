import { useState, useEffect } from "react";
import { fetchNews } from "../lib/api";

const CACHE_KEY = "ai_news_cached";
const LAST_UPDATE_KEY = "ai_news_last_update";
const CACHE_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2日

/**
 * ニュースチッカーのロジックを管理するカスタムフック
 * 2日に1回更新されるキャッシュ機能付き
 */
export function useNewsTicker(isOpen: boolean) {
  const [weeklyLogNews, setWeeklyLogNews] = useState<string[]>([]);
  const [weeklyLogLoading, setWeeklyLogLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadWeeklyLogs = async () => {
      // キャッシュチェック
      const lastUpdate = localStorage.getItem(LAST_UPDATE_KEY);
      const cachedNews = localStorage.getItem(CACHE_KEY);
      const now = Date.now();

      if (lastUpdate && cachedNews) {
        const lastUpdateTime = parseInt(lastUpdate, 10);
        if (now - lastUpdateTime < CACHE_DURATION_MS) {
          try {
            const parsed = JSON.parse(cachedNews);
            // エラーメッセージの場合はキャッシュを無視して再取得を試みる
            if (parsed.includes("ニュースの取得に失敗しました")) {
              console.log("[NewsTicker] Cached error message detected, forcing refresh");
              // キャッシュをクリアして再取得
              localStorage.removeItem(CACHE_KEY);
              localStorage.removeItem(LAST_UPDATE_KEY);
            } else {
              setWeeklyLogNews(parsed);
              return;
            }
          } catch (e) {
            console.warn("Failed to parse cached news", e);
          }
        }
      }

      // データ取得
      setWeeklyLogLoading(true);
      try {
        const res = await fetchNews(7);

        if (!res.ok || !res.newsItems || res.newsItems.length === 0) {
          const fallbackNews = ["過去1週間のログはありません"];
          setWeeklyLogNews(fallbackNews);
          localStorage.setItem(CACHE_KEY, JSON.stringify(fallbackNews));
          localStorage.setItem(LAST_UPDATE_KEY, now.toString());
          return;
        }

        const finalNews = res.newsItems;
        setWeeklyLogNews(finalNews);
        localStorage.setItem(CACHE_KEY, JSON.stringify(finalNews));
        localStorage.setItem(LAST_UPDATE_KEY, now.toString());
      } catch (err) {
        console.error("Failed to load news", err);
        
        // エラー時は、古いキャッシュがあればそれを使用し、なければエラーメッセージを表示
        // エラーメッセージをキャッシュに保存しない（2日間固定されないようにする）
        if (cachedNews) {
          try {
            const parsed = JSON.parse(cachedNews);
            // エラーメッセージでない場合のみ古いキャッシュを使用
            if (!parsed.includes("ニュースの取得に失敗しました") && !parsed.includes("過去1週間のログはありません")) {
              setWeeklyLogNews(parsed);
              console.log("[NewsTicker] Using old cache due to fetch error");
              return;
            }
          } catch (e) {
            // パースに失敗した場合は無視
          }
        }
        
        // 古いキャッシュがない、またはエラーメッセージの場合のみ、新しいエラーメッセージを表示
        const errorNews = ["ニュースの取得に失敗しました"];
        setWeeklyLogNews(errorNews);
        // エラーメッセージはキャッシュに保存しない（次回再試行できるように）
      } finally {
        setWeeklyLogLoading(false);
      }
    };

    void loadWeeklyLogs();
  }, [isOpen]);

  return {
    weeklyLogNews,
    weeklyLogLoading,
  };
}

