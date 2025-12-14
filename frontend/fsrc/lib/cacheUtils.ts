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

// ============================================================
// ユーザー名キャッシュ（グローバル）
// ============================================================

const USER_NAMES_CACHE_KEY = "luqo.userNames.v1";
const USER_NAMES_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1週間

type UserNamesCache = {
  names: Record<string, string>; // userId -> name
  timestamp: number;
};

/**
 * ユーザー名キャッシュを取得
 */
export function loadUserNamesCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  
  const raw = window.localStorage.getItem(USER_NAMES_CACHE_KEY);
  if (!raw) return {};
  
  try {
    const cached = JSON.parse(raw) as UserNamesCache;
    const now = Date.now();
    
    // 期限切れチェック（1週間以上経過している場合は無効）
    if (now - cached.timestamp > USER_NAMES_CACHE_DURATION_MS) {
      window.localStorage.removeItem(USER_NAMES_CACHE_KEY);
      return {};
    }
    
    return cached.names;
  } catch {
    window.localStorage.removeItem(USER_NAMES_CACHE_KEY);
    return {};
  }
}

/**
 * ユーザー名キャッシュを保存（既存のキャッシュとマージ）
 */
export function saveUserNamesCache(newNames: Record<string, string>) {
  if (typeof window === "undefined") return;
  
  const existing = loadUserNamesCache();
  const merged = { ...existing, ...newNames };
  
  window.localStorage.setItem(USER_NAMES_CACHE_KEY, JSON.stringify({
    names: merged,
    timestamp: Date.now(),
  }));
}

/**
 * 特定のユーザー名をキャッシュから取得
 */
export function getUserNameFromCache(userId: string): string | undefined {
  const cache = loadUserNamesCache();
  return cache[userId];
}

















