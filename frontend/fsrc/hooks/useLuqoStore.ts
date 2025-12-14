import { create } from "zustand";
import type { LogItem } from "../types/events";
import { fetchLuqoScore } from "../lib/api";
import { apiClient } from "../lib/apiClient";
import type { LuqoScore } from "../types/luqo";
export type Score = LuqoScore;

// キャッシュの有効期限: 1週間（7日間）
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
// 自動更新の間隔: 1週間（7日間）ごとに自動更新
const AUTO_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// キャッシュキーの生成
const getCacheKey = (month: string) => `luqo.score.v1.${month}`;

// キャッシュからスコアを取得（期限切れチェック付き）
function loadScoreCache(month: string): { score: Score; isFixed: boolean; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  
  const raw = window.localStorage.getItem(getCacheKey(month));
  if (!raw) return null;
  
  try {
    const cached = JSON.parse(raw) as { score: Score; isFixed: boolean; timestamp: number };
    const now = Date.now();
    
    // 期限切れチェック（1週間以上経過している場合は無効）
    if (now - cached.timestamp > CACHE_DURATION_MS) {
      window.localStorage.removeItem(getCacheKey(month));
      return null;
    }
    
    return cached;
  } catch {
    window.localStorage.removeItem(getCacheKey(month));
    return null;
  }
}

// スコアをキャッシュに保存
function saveScoreCache(month: string, score: Score, isFixed: boolean) {
  if (typeof window === "undefined") return;
  
  window.localStorage.setItem(getCacheKey(month), JSON.stringify({
    score,
    isFixed,
    timestamp: Date.now(),
  }));
}

type MonthlyEvaluation = {
  reasoning: string;
};

const DEFAULT_SCORE: Score = {
  LU: 0, Q: 0, O: 0, total: 0,
  ui: {
    headline: "データ待ち",
    greeting: "ログを入力してスコアを算出しましょう",
    color: "#64748b",
    icon: "document",
    theme: {
      color: "#64748b",
      shape: "rounded",
      radiusLevel: 16,
      vibe: "calm"
    }
  }
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const generateLogId = () => {
  const globalCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

type State = {
  // --- user/score ---
  userId: string | null;
  month: string;
  score: Score;
  setUserId: (id: string | null) => void;
  setMonth: (month: string) => void;
  setScore: (p: Partial<Score>) => void;

  // --- logs/drafts ---
  logDraft: string;
  lastSavedLog: string | null;
  history: ReadonlyArray<LogItem>;
  setLogDraft: (s: string) => void;
  resetLogDraft: () => void;
  markLogSaved: (text: string) => void;
  setHistory: (h: ReadonlyArray<LogItem>) => void;

  // --- dashboard ---
  monthlyScore: Score;
  monthlyEvaluation: MonthlyEvaluation | null;
  isFixed: boolean;
  loading: boolean;
  error: string | null;
  fetchScore: (opts?: { okrStartAt?: string; okrEndAt?: string }) => Promise<void>;
  finalizeScore: (opts?: { force?: boolean }) => Promise<void>;
  forceFetchScore: () => Promise<void>;
};

export const useLuqoStore = create<State>((set, get) => ({
  userId: typeof window !== "undefined"
    ? window.localStorage.getItem("luqo_user_id")
    : null,
  month: getCurrentMonth(),
  score: DEFAULT_SCORE,
  setUserId: (userId) => {
    if (typeof window !== "undefined") {
      if (userId) {
        window.localStorage.setItem("luqo_user_id", userId);
      } else {
        window.localStorage.removeItem("luqo_user_id");
      }
    }
    set({ userId });
  },
  setMonth: (month) => set({ month }),
  setScore: (p) => set((s) => ({ score: { ...s.score, ...p } })),

  logDraft: "",
  lastSavedLog: null,
  history: [],
  setLogDraft: (logDraft) => set({ logDraft }),
  resetLogDraft: () =>
    set((state) => ({
      logDraft: state.lastSavedLog ?? "",
    })),
  markLogSaved: (text) =>
    set((state) => ({
      lastSavedLog: text,
      history: [
        ...state.history,
        {
          id: generateLogId(),
          ts: Date.now(),
          text,
        },
      ],
    })),
  setHistory: (history) => set({ history }),

  monthlyScore: DEFAULT_SCORE,
  monthlyEvaluation: null,
  isFixed: false,
  loading: false,
  error: null,
  fetchScore: async (opts) => {
    const { userId, month } = get();
    if (!userId) return;

    // まずキャッシュをチェック
    const cached = loadScoreCache(month);
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      const cacheAgeHours = Math.round(cacheAge / (1000 * 60 * 60));
      
      // 確定済みスコアの場合は、キャッシュをそのまま使用（更新しない）
      if (cached.isFixed) {
        console.log(`[LUQO] Using fixed cached score for ${month} (cache age: ${cacheAgeHours} hours)`);
        set({
          score: cached.score,
          monthlyScore: cached.score,
          monthlyEvaluation: { reasoning: cached.score.reasoning ?? "" },
          isFixed: cached.isFixed,
        });
        return; // 確定済みなので更新しない
      }

      // OKRの開始日（startAt）に合わせて「週の区切り」で更新する（プランB: 14日×3フェーズの中間/終端に揃う）
      // 例: OKR開始Day0 → Day7/14/21/28/35/42 のタイミングで更新
      const isCurrentMonth = month === getCurrentMonth();
      const okrStartAt = opts?.okrStartAt;
      const okrEndAt = opts?.okrEndAt;
      if (isCurrentMonth && okrStartAt && okrEndAt) {
        const startMs = new Date(okrStartAt).getTime();
        const endMs = new Date(okrEndAt).getTime();
        const nowMs = Date.now();
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs < endMs && nowMs >= startMs && nowMs < endMs) {
          const tickMs = AUTO_UPDATE_INTERVAL_MS; // 7日
          const elapsed = Math.max(0, nowMs - startMs);
          const currentTickStartMs = startMs + Math.floor(elapsed / tickMs) * tickMs;

          if (cached.timestamp >= currentTickStartMs) {
            console.log(`[LUQO] Using cached draft score for ${month} (aligned to OKR week tick, cache age: ${cacheAgeHours} hours)`);
            set({
              score: cached.score,
              monthlyScore: cached.score,
              monthlyEvaluation: { reasoning: cached.score.reasoning ?? "" },
              isFixed: cached.isFixed,
            });
            return;
          }

          console.log(`[LUQO] OKR week tick reached for ${month}, fetching fresh score...`);
        }
      }
      
      // ドラフトスコアの場合、週1回（7日）ごとに自動更新
      if (cacheAge < AUTO_UPDATE_INTERVAL_MS) {
        console.log(`[LUQO] Using cached draft score for ${month} (cache age: ${cacheAgeHours} hours, will auto-update in ${Math.round((AUTO_UPDATE_INTERVAL_MS - cacheAge) / (1000 * 60 * 60 * 24))} days)`);
        set({
          score: cached.score,
          monthlyScore: cached.score,
          monthlyEvaluation: { reasoning: cached.score.reasoning ?? "" },
          isFixed: cached.isFixed,
        });
        return; // まだ更新間隔に達していないのでキャッシュを使用
      }
      
      // 週1回の更新タイミングに達した場合、バックグラウンドで更新
      console.log(`[LUQO] Cache expired for ${month} (cache age: ${cacheAgeHours} hours), fetching fresh score...`);
    }

    set({ loading: true, error: null });

    try {
      // finalize: false で常に最新の推計値を取得し、勝手に確定しないようにする
      const res = await fetchLuqoScore({ month, finalize: false });

      if (res.ok && res.score) {
        const scoreData: Score = {
          LU: res.score.LU,
          Q: res.score.Q,
          O: res.score.O,
          total: res.score.total,
          reasoning: res.score.reasoning,
          ui: res.score.ui,
          adjustments: res.score.adjustments, // adjustmentsも含める
        };
        
        const isFixed = res.isFixed ?? false;
        
        // 取得したデータをキャッシュに保存
        saveScoreCache(month, scoreData, isFixed);
        
        set({
          score: scoreData,
          monthlyScore: res.score,
          monthlyEvaluation: { reasoning: res.score.reasoning },
          isFixed,
        });
      } else {
        set({ error: "No score data returned" });
      }
    } catch (e: any) {
      console.error("fetchScore error:", e);
      set({ error: e?.message || "Failed to fetch score" });
    } finally {
      set({ loading: false });
    }
  },

  finalizeScore: async (opts) => {
    const { userId, month } = get();
    if (!userId) return;

    const force = opts?.force ?? true;
    set({ loading: true });
    try {
      const res = await fetchLuqoScore({ month, finalize: true, force });
      if (res.ok && res.score) {
        const scoreData: Score = {
          LU: res.score.LU,
          Q: res.score.Q,
          O: res.score.O,
          total: res.score.total,
          reasoning: res.score.reasoning,
          ui: res.score.ui,
          adjustments: res.score.adjustments,
        };
        
        // 確定されたスコアをキャッシュに保存（キャッシュを更新）
        saveScoreCache(month, scoreData, true);
        
        set({
          score: scoreData,
          monthlyEvaluation: { reasoning: res.score.reasoning },
          isFixed: true,
          monthlyScore: res.score,
        });
      }
    } catch (e: any) {
      set({ error: e?.message || "Failed to finalize score" });
    } finally {
      set({ loading: false });
    }
  },

  // 手動更新用: 強制再計算して即確定
  forceFetchScore: async () => {
    const { userId, month } = get();
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const res = await apiClient.post<any>("/api/v1/luqo/score-month", {
        month,
        finalize: true,
        force: true,
      });

      if (res.ok && res.score) {
        const scoreData: Score = {
          LU: res.score.LU,
          Q: res.score.Q,
          O: res.score.O,
          total: res.score.total,
          reasoning: res.score.reasoning,
          ui: res.score.ui,
          adjustments: res.score.adjustments,
        };
        
        // 強制更新されたスコアをキャッシュに保存（キャッシュを更新）
        saveScoreCache(month, scoreData, true);
        
        set({
          score: scoreData,
          monthlyScore: res.score,
          monthlyEvaluation: { reasoning: res.score.reasoning },
          isFixed: true,
        });
      }
    } catch (e: any) {
      set({ error: e?.message || "Failed to force update" });
    } finally {
      set({ loading: false });
    }
  }
}));

// ---- primitive / tuple selectors ----
export const useUserId = () => useLuqoStore((s) => s.userId);
export const useSetUserId = () => useLuqoStore((s) => s.setUserId);
export const useMonth = () => useLuqoStore((s) => s.month);
export const useSetMonth = () => useLuqoStore((s) => s.setMonth);

export const useScoreNum: () => readonly [number, number, number, number] = () =>
  useLuqoStore((s) => [s.score.LU, s.score.Q, s.score.O, s.score.total] as const);
export const useScoreReady = () => useLuqoStore((s) => s.score.total > 0);
export const useSetScore = () => useLuqoStore((s) => s.setScore);

// logs
export const useLogDraft = () => useLuqoStore((s) => s.logDraft);
export const useLastSavedLog = () =>
  useLuqoStore((s) => s.lastSavedLog ?? "");
export const useSetLogDraft = () => useLuqoStore((s) => s.setLogDraft);
export const useResetLogDraft = () => useLuqoStore((s) => s.resetLogDraft);
export const useMarkLogSaved = () => useLuqoStore((s) => s.markLogSaved);

// history selectors
export const useHistoryKeys: () => readonly [number, string | null] = () =>
  useLuqoStore((s) => {
    const len = s.history.length;
    const lastId = len > 0 ? s.history[len - 1].id : null;
    return [len, lastId] as const;
  });
export const useHistoryRaw = () => useLuqoStore((s) => s.history);

// primitive selectors for fine-grained subscriptions
export const useScoreLU = () => useLuqoStore((s) => s.score.LU);
export const useScoreQ = () => useLuqoStore((s) => s.score.Q);
export const useScoreO = () => useLuqoStore((s) => s.score.O);
export const useScoreTotal = () => useLuqoStore((s) => s.score.total);
export const useHistoryLen = () => useLuqoStore((s) => s.history.length);
export const useForceFetchScore = () => useLuqoStore((s) => s.forceFetchScore);
export const useHistoryLast = () =>
  useLuqoStore((s) => {
    const len = s.history.length;
    return len > 0 ? s.history[len - 1].id : null;
  });

// direct access helper to avoid subscribing to arrays
export const readHistoryOnce = () => useLuqoStore.getState().history;

export const useIsFixed = () => useLuqoStore((s) => s.isFixed);
export const useFinalizeScore = () => useLuqoStore((s) => s.finalizeScore);
export const useTheme = () => useLuqoStore((s) => s.score.ui?.theme);
