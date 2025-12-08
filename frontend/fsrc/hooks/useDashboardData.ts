import { useState, useEffect, useCallback } from "react";
import { useLuqoStore, useUserId, useHistoryLast, readHistoryOnce } from "../hooks/useLuqoStore";
import { fetchBanditSuggestion, fetchTScoreState, type BanditSuggestResponse } from "../lib/api";
import { STAR_CATALOG } from "../data/starCatalog";
import { useSnackbar } from "../contexts/SnackbarContext";
import { loadTScoreStateCache, saveTScoreStateCache } from "../lib/cacheUtils";
import { useTScoreRealtime } from "./useTScoreRealtime";

const BANDIT_CACHE_KEY = "luqo.banditMission.v1";

// キャッシュから個人ミッションを取得（期限切れチェック付き）
function loadBanditCache(): BanditSuggestResponse | null {
    if (typeof window === "undefined") return null;
    
    const raw = window.localStorage.getItem(BANDIT_CACHE_KEY);
    if (!raw) return null;
    
    try {
        const cached = JSON.parse(raw) as { data: BanditSuggestResponse; missionEndAt: string };
        const endAt = new Date(cached.missionEndAt);
        
        // 期限切れチェック
        if (isNaN(endAt.getTime()) || endAt.getTime() < Date.now()) {
            window.localStorage.removeItem(BANDIT_CACHE_KEY);
            return null;
        }
        
        return cached.data;
    } catch {
        window.localStorage.removeItem(BANDIT_CACHE_KEY);
        return null;
    }
}

// 個人ミッションをキャッシュに保存
function saveBanditCache(data: BanditSuggestResponse) {
    if (typeof window === "undefined") return;
    if (!data.suggestion?.missionEndAt) return;
    
    window.localStorage.setItem(BANDIT_CACHE_KEY, JSON.stringify({
        data,
        missionEndAt: data.suggestion.missionEndAt,
    }));
}


export function useDashboardData() {
    const score = useLuqoStore((state) => state.score);
    const fetchScore = useLuqoStore((s) => s.fetchScore);
    const userId = useUserId();
    const historyBumpId = useHistoryLast();
    const { showSnackbar } = useSnackbar();

    const [banditData, setBanditData] = useState<BanditSuggestResponse | null>(() => loadBanditCache());
    const [banditLoading, setBanditLoading] = useState(false);
    const [rawScore, setRawScore] = useState(0);
    const [pendingStars, setPendingStars] = useState<string[]>([]);

    // AI生成の挨拶があれば使う、なければデフォルト
    const greeting = score.ui?.greeting || "Hello";
    const headlineColor = score.ui?.color || "#1f1f1f";

    // エラー表示のロジック修正: エラーはSnackbarで表示し、挨拶はデフォルトに戻す
    // ただし、FABでニュース風に表示するため、通常のgreetingはSnackbarで表示しない
    const isErrorGreeting = greeting.includes("失敗") || greeting.length > 100; // 長すぎるのもエラー扱い（100文字以上）
    const displayGreeting = isErrorGreeting ? "Welcome back" : greeting;

    useEffect(() => {
        // エラー時のみSnackbarで表示（FABでニュース風に表示するため、通常は表示しない）
        if (isErrorGreeting) {
            showSnackbar(`AI Status: ${greeting}`, "error");
        }
    }, [isErrorGreeting, greeting, showSnackbar]);

    // Banditの取得ロジック（キャッシュ優先）
    useEffect(() => {
        if (!score.total) return;
        
        // まずキャッシュをチェック
        const cached = loadBanditCache();
        if (cached) {
            setBanditData(cached);
            return; // キャッシュがあればAPIを呼ばない
        }
        
        // キャッシュがない場合のみAPIを呼び出す
        setBanditLoading(true);
        const history = readHistoryOnce();
        void fetchBanditSuggestion({
            kpi: "quality",
            score: { lu: score.LU, q: score.Q, o: score.O, total: score.total, ui: score.ui },
            history,
        })
            .then((res) => {
                if (res?.ok) {
                    setBanditData(res);
                    saveBanditCache(res); // 取得したデータをキャッシュに保存
                }
            })
            .catch((e) => {
                console.error("Failed to load bandit mission", e);
                setBanditData(null);
            })
            .finally(() => setBanditLoading(false));
    }, [score.total, score.LU, score.Q, score.O, historyBumpId, score.ui]);

    // T-Scoreの取得ロジック（キャッシュ優先）
    const loadStars = useCallback(async (forceRefresh: boolean = false) => {
        if (!userId) return;

        // まずキャッシュをチェック（強制更新でない場合のみ）
        if (!forceRefresh) {
            const cached = loadTScoreStateCache(userId);
            if (cached) {
                // キャッシュから合計ポイントを計算
                const acquiredSet = new Set(cached.acquired);
                const totalPoints = STAR_CATALOG.filter(item => acquiredSet.has(item.id)).reduce((sum, item) => sum + item.points, 0);
                setRawScore(totalPoints);
                setPendingStars(cached.pending);
            }
        }

        try {
            // 強制更新の場合はキャッシュをスキップ、そうでない場合はキャッシュを有効活用
            const res = await fetchTScoreState(userId, { skipCache: forceRefresh });
            if (res.ok) {
                const acquiredSet = new Set(res.state.acquired);
                const totalPoints = STAR_CATALOG.filter(item => acquiredSet.has(item.id)).reduce((sum, item) => sum + item.points, 0);

                // 取得したデータをキャッシュに保存
                saveTScoreStateCache(userId, res.state.acquired, res.state.pending);
                setRawScore(totalPoints);
                setPendingStars(res.state.pending);
            }
        } catch (e) {
            console.error("Failed to load T-Score stats", e);
        }
    }, [userId]);

    useEffect(() => {
        // 初回はキャッシュを優先して読み込み
        void loadStars(false);
        
        // 状態更新イベントをリッスン（後方互換性のため残す）
        const handleStateUpdate = (event: CustomEvent) => {
            if (event.detail?.userId === userId) {
                // イベント経由の更新は強制更新
                void loadStars(true);
            }
        };
        
        window.addEventListener('tscore-state-updated', handleStateUpdate as EventListener);
        
        return () => {
            window.removeEventListener('tscore-state-updated', handleStateUpdate as EventListener);
        };
    }, [userId, loadStars]);

    // Supabase RealtimeでDB変更を監視（変更があった場合のみ更新、強制更新）
    useTScoreRealtime(() => loadStars(true), true, userId);

    // ミッション更新後の再取得関数
    const refreshBanditData = useCallback(() => {
        // キャッシュをクリア
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(BANDIT_CACHE_KEY);
        }
        
        // 再取得
        if (score.total) {
            setBanditLoading(true);
            const history = readHistoryOnce();
            void fetchBanditSuggestion({
                kpi: "quality",
                score: { lu: score.LU, q: score.Q, o: score.O, total: score.total, ui: score.ui },
                history,
            })
                .then((res) => {
                    if (res?.ok) {
                        setBanditData(res);
                        saveBanditCache(res);
                    }
                })
                .catch((e) => {
                    console.error("Failed to refresh bandit mission", e);
                    setBanditData(null);
                })
                .finally(() => setBanditLoading(false));
        }
    }, [score.total, score.LU, score.Q, score.O, score.ui]);

    return {
        score,
        fetchScore,
        banditData,
        banditLoading,
        rawScore,
        pendingStars,
        greeting: displayGreeting,
        headlineColor,
        historyBumpId,
        refreshBanditData,
    };
}
