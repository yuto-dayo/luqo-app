// キャッシュユーティリティ（共通）
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1週間

export type TScoreCacheData = {
  acquired: string[];
  pending: string[];
  timestamp: number;
};

/**
 * T-Score状態をキャッシュから取得（期限切れチェック付き）
 */
export function loadTScoreStateCache(userId: string): TScoreCacheData | null {
  if (typeof window === "undefined") return null;
  
  const cacheKey = `luqo.tscore.state.v1.${userId}`;
  const raw = window.localStorage.getItem(cacheKey);
  if (!raw) return null;
  
  try {
    const cached = JSON.parse(raw) as TScoreCacheData;
    const now = Date.now();
    
    // 期限切れチェック（1週間以上経過している場合は無効）
    if (now - cached.timestamp > CACHE_DURATION_MS) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }
    
    return cached;
  } catch {
    window.localStorage.removeItem(cacheKey);
    return null;
  }
}

/**
 * T-Score状態をキャッシュに保存
 */
export function saveTScoreStateCache(userId: string, acquired: string[], pending: string[]) {
  if (typeof window === "undefined") return;
  
  const cacheKey = `luqo.tscore.state.v1.${userId}`;
  window.localStorage.setItem(cacheKey, JSON.stringify({
    acquired,
    pending,
    timestamp: Date.now(),
  }));
}

/**
 * T-Scoreキャッシュをクリア（スコアが更新された場合など）
 */
export function clearTScoreStateCache(userId: string) {
  if (typeof window === "undefined") return;
  
  const cacheKey = `luqo.tscore.state.v1.${userId}`;
  window.localStorage.removeItem(cacheKey);
}
