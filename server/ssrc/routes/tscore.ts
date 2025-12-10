import { Router, Request, Response, NextFunction } from "express";
import { dbClient } from "../lib/dbClient";
import type { AuthedRequest } from "../types/authed-request";
import { getUserCount, supabaseAdmin } from "../services/supabaseClient";
import { ACCOUNTING_EVENTS, type SalePayload, type WorkCategory } from "../types/accounting";

const router = Router();

// 楽観的ロックのリトライ設定
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 200;

// ユーティリティ: 指定時間待機
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// GET /stats
// ユーザー総数と承認待ち件数を返す
router.get(
    "/stats",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = req as AuthedRequest;
            const totalUsers = await getUserCount();
            const pendingStates = await dbClient.getPendingStarStates(r.supabase);
            const pendingCount = pendingStates.length;

            res.json({
                ok: true,
                stats: {
                    totalUsers,
                    pendingCount,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// GET /pending
// 自分以外の承認待ち申請リストを取得する
// ★修正: DB側でフィルタリングを行うRPC関数を使用（パフォーマンス改善）
router.get(
    "/pending",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = req as AuthedRequest;
            const currentUserId = r.userId;

            // DB側でフィルタリングされたタスクを取得（RPC関数を使用）
            const { data, error } = await r.supabase.rpc("get_my_pending_tasks", {
                current_user_id: currentUserId
            });

            if (error) {
                console.error("[GET /pending] RPC error:", error);
                throw new Error(`Failed to fetch pending tasks: ${error.message}`);
            }

            // RPC関数はJSONB配列を返すため、そのまま使用
            const myTasks = data || [];

            res.json({ ok: true, items: myTasks });
        } catch (err) {
            next(err);
        }
    }
);

// GET /state/:targetUserId
router.get(
    "/state/:targetUserId",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { targetUserId } = req.params;
            const r = req as AuthedRequest;
            const state = await dbClient.getStarState(targetUserId, r.supabase);
            res.json({ ok: true, state });
        } catch (err) {
            next(err);
        }
    }
);

// POST /action
// Body: { action: 'apply'|'approve'|'reject'|'pass', starId: string, targetUserId: string, evidence?: string, feedback?: string }
// ★修正: 楽観的ロックによる排他制御を実装
router.post(
    "/action",
    async (req: Request, res: Response, next: NextFunction) => {
        const { action, starId, targetUserId, feedback, evidence } = req.body;
        const r = req as AuthedRequest;

        if (!action || !starId || !targetUserId) {
            res.status(400).json({ ok: false, error: "Missing required fields" });
            return;
        }

        try {
            // バリデーション
            if (action === "apply" && (!evidence || typeof evidence !== "string" || !evidence.trim())) {
                return res.status(400).json({ ok: false, error: "申請には根拠が必要です" });
            }
            if (action === "reject" && (!feedback || typeof feedback !== "string" || !feedback.trim())) {
                throw new Error("Feedback is required for rejection");
            }
            if (!["apply", "approve", "reject", "pass"].includes(action)) {
                throw new Error("Invalid action");
            }

            // RPC呼び出し (DB側で排他制御とロジック実行)
            // ★修正: 楽観的ロックのリトライロジックを実装（排他エラー時のみ再試行）
            let lastError: any = null;
            let result: any = null;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                const { data, error } = await r.supabase.rpc("vote_star", {
                    target_user_id: targetUserId,
                    star_id: starId,
                    action_type: action,
                    feedback: action === "apply" ? (evidence || null) : (feedback || null)
                });

                if (error) {
                    lastError = error;
                    
                    // 再試行すべきエラーかどうかを判定
                    // 排他制御関連のエラー（デッドロック、ロックタイムアウトなど）のみ再試行
                    const isRetryableError = 
                        error.message?.includes("deadlock") ||
                        error.message?.includes("lock timeout") ||
                        error.message?.includes("could not obtain lock") ||
                        error.code === "40P01" || // PostgreSQL deadlock detected
                        error.code === "55P03";    // PostgreSQL lock_not_available

                    // 再試行不可なエラー（認証エラー、バリデーションエラーなど）は即座に返す
                    if (error.message?.includes("Self voting is not allowed")) {
                        return res.status(400).json({ ok: false, error: "自分自身への投票はできません" });
                    }
                    if (error.message?.includes("Not authenticated")) {
                        return res.status(401).json({ ok: false, error: "認証が必要です" });
                    }
                    if (error.message?.includes("is not pending")) {
                        return res.status(400).json({ ok: false, error: "このスターは申請待ちではありません" });
                    }

                    // 再試行可能なエラーで、まだ試行回数が残っている場合は待機して再試行
                    if (isRetryableError && attempt < MAX_RETRIES - 1) {
                        console.warn(`[vote_star] Retryable error on attempt ${attempt + 1}/${MAX_RETRIES}:`, error.message);
                        await sleep(RETRY_DELAY_MS);
                        continue;
                    }

                    // 再試行不可、または最大試行回数に達した場合はエラーを返す
                    console.error("RPC vote_star error:", error);
                    throw new Error(`Database error: ${error.message}`);
                }

                // 成功した場合は結果を保存してループを抜ける
                result = data;
                break;
            }

            // 全ての試行が失敗した場合
            if (!result && lastError) {
                console.error("RPC vote_star failed after all retries:", lastError);
                throw new Error(`Database error after ${MAX_RETRIES} attempts: ${lastError.message}`);
            }

            res.json(result);

        } catch (err: any) {
            if (err?.message === "Feedback is required for rejection" || err?.message === "Invalid action") {
                res.status(400).json({ ok: false, error: err.message });
                return;
            }
            // Database error メッセージもチェック
            if (err?.message?.includes("Self voting is not allowed")) {
                res.status(400).json({ ok: false, error: "自分自身への投票はできません" });
                return;
            }
            next(err);
        }
    }
);

// ====================================================
// 工事カテゴリ別 重み付きスコア計算 API
// ====================================================

/**
 * 重み付きスコアサマリーを取得
 * GET /api/v1/tscore/weighted-summary
 * 
 * 計算式: TotalScore = Σ (売上額_i * カテゴリ重み_i)
 * カテゴリ未指定の売上は重み 1.0 として計算
 * 
 * @query month - 対象月 (YYYY-MM形式、省略時は当月)
 * @query userId - 対象ユーザーID (省略時は全ユーザー)
 */
router.get(
    "/weighted-summary",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = req as AuthedRequest;
            const { month: queryMonth, userId: queryUserId } = req.query;
            
            // 対象月の決定
            const now = new Date();
            const targetMonth = (queryMonth as string) || 
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            
            // 対象ユーザーIDの決定（省略時は自分）
            const targetUserId = (queryUserId as string) || r.userId;

            // 月の範囲を計算
            const [y, m] = targetMonth.split("-").map(Number);
            const startOfMonth = new Date(y, m - 1, 1);
            const endOfMonth = new Date(y, m, 1);

            // 1. 工事カテゴリマスタを取得（重み係数）
            const { data: categoriesData, error: categoriesError } = await r.supabase
                .from("work_categories")
                .select("id, code, label, default_weight")
                .eq("is_active", true);

            if (categoriesError) {
                console.error("[Weighted Summary] Failed to fetch categories:", categoriesError);
                throw new Error("カテゴリの取得に失敗しました");
            }

            // カテゴリIDから重みへのマップを作成
            const categoryWeightMap = new Map<string, { weight: number; label: string; code: string }>();
            (categoriesData || []).forEach((cat: any) => {
                categoryWeightMap.set(cat.id, {
                    weight: Number(cat.default_weight) || 1.0,
                    label: cat.label,
                    code: cat.code,
                });
            });

            // 2. 対象月の売上イベントを取得
            const { data: salesEvents, error: salesError } = await r.supabase
                .from("events")
                .select("*")
                .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
                .eq("user_id", targetUserId)
                .gte("created_at", startOfMonth.toISOString())
                .lt("created_at", endOfMonth.toISOString());

            if (salesError) {
                console.error("[Weighted Summary] Failed to fetch sales:", salesError);
                throw new Error("売上データの取得に失敗しました");
            }

            // 3. カテゴリ別の重み付きスコアを計算
            interface CategoryScore {
                categoryId: string | null;
                categoryCode: string | null;
                categoryLabel: string;
                weight: number;
                totalAmount: number;
                weightedScore: number;
                count: number;
            }

            const categoryScores = new Map<string, CategoryScore>();
            let overallTotalAmount = 0;
            let overallWeightedScore = 0;
            let totalSalesCount = 0;

            (salesEvents || []).forEach((event: any) => {
                const payload = event.payload as SalePayload;
                
                // 逆仕訳（取り消し）データは除外
                if ((payload as any).isReversal) return;

                const amount = Number(payload.amount) || 0;
                const categoryId = payload.workCategoryId || "uncategorized";
                const categoryInfo = categoryId !== "uncategorized" 
                    ? categoryWeightMap.get(categoryId) 
                    : null;
                
                const weight = categoryInfo?.weight || 1.0;
                const label = categoryInfo?.label || payload.workCategoryLabel || "未分類";
                const code = categoryInfo?.code || "uncategorized";
                
                // カテゴリ別集計
                const existing = categoryScores.get(categoryId) || {
                    categoryId: categoryId === "uncategorized" ? null : categoryId,
                    categoryCode: categoryId === "uncategorized" ? null : code,
                    categoryLabel: label,
                    weight,
                    totalAmount: 0,
                    weightedScore: 0,
                    count: 0,
                };

                existing.totalAmount += amount;
                existing.weightedScore += amount * weight;
                existing.count += 1;
                categoryScores.set(categoryId, existing);

                // 全体集計
                overallTotalAmount += amount;
                overallWeightedScore += amount * weight;
                totalSalesCount += 1;
            });

            // 結果を配列に変換
            const breakdown = Array.from(categoryScores.values())
                .sort((a, b) => b.weightedScore - a.weightedScore);

            res.json({
                ok: true,
                summary: {
                    month: targetMonth,
                    userId: targetUserId,
                    totalAmount: overallTotalAmount,
                    weightedScore: Math.round(overallWeightedScore),
                    salesCount: totalSalesCount,
                    // スコア倍率（重み適用による上昇率）
                    multiplier: overallTotalAmount > 0 
                        ? Math.round((overallWeightedScore / overallTotalAmount) * 100) / 100 
                        : 1.0,
                },
                breakdown, // カテゴリ別内訳
                categories: categoriesData || [], // 利用可能なカテゴリ一覧
            });

        } catch (err: any) {
            console.error("[Weighted Summary] Error:", err);
            res.status(500).json({ ok: false, error: err?.message || "重み付きスコアの計算に失敗しました" });
        }
    }
);

/**
 * 全ユーザーの重み付きスコアランキングを取得
 * GET /api/v1/tscore/weighted-ranking
 * 
 * @query month - 対象月 (YYYY-MM形式、省略時は当月)
 * @query limit - 取得件数（デフォルト: 10）
 */
router.get(
    "/weighted-ranking",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = req as AuthedRequest;
            const { month: queryMonth, limit: queryLimit } = req.query;
            
            // 対象月の決定
            const now = new Date();
            const targetMonth = (queryMonth as string) || 
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const limitCount = Math.min(Number(queryLimit) || 10, 100);

            // 月の範囲を計算
            const [y, m] = targetMonth.split("-").map(Number);
            const startOfMonth = new Date(y, m - 1, 1);
            const endOfMonth = new Date(y, m, 1);

            // 1. 工事カテゴリマスタを取得
            const { data: categoriesData } = await r.supabase
                .from("work_categories")
                .select("id, default_weight")
                .eq("is_active", true);

            const categoryWeightMap = new Map<string, number>();
            (categoriesData || []).forEach((cat: any) => {
                categoryWeightMap.set(cat.id, Number(cat.default_weight) || 1.0);
            });

            // 2. 対象月の全売上イベントを取得
            const { data: salesEvents, error: salesError } = await supabaseAdmin
                .from("events")
                .select("user_id, payload")
                .eq("kind", ACCOUNTING_EVENTS.SALE_REGISTERED)
                .gte("created_at", startOfMonth.toISOString())
                .lt("created_at", endOfMonth.toISOString());

            if (salesError) {
                throw new Error("売上データの取得に失敗しました");
            }

            // 3. ユーザー別の重み付きスコアを集計
            const userScores = new Map<string, { totalAmount: number; weightedScore: number; count: number }>();

            (salesEvents || []).forEach((event: any) => {
                const payload = event.payload as SalePayload;
                
                // 逆仕訳（取り消し）データは除外
                if ((payload as any).isReversal) return;

                const userId = event.user_id;
                const amount = Number(payload.amount) || 0;
                const categoryId = payload.workCategoryId;
                const weight = categoryId ? (categoryWeightMap.get(categoryId) || 1.0) : 1.0;

                const existing = userScores.get(userId) || { totalAmount: 0, weightedScore: 0, count: 0 };
                existing.totalAmount += amount;
                existing.weightedScore += amount * weight;
                existing.count += 1;
                userScores.set(userId, existing);
            });

            // 4. ランキングを作成
            const ranking = Array.from(userScores.entries())
                .map(([userId, scores]) => ({
                    userId,
                    totalAmount: scores.totalAmount,
                    weightedScore: Math.round(scores.weightedScore),
                    salesCount: scores.count,
                    multiplier: scores.totalAmount > 0 
                        ? Math.round((scores.weightedScore / scores.totalAmount) * 100) / 100 
                        : 1.0,
                }))
                .sort((a, b) => b.weightedScore - a.weightedScore)
                .slice(0, limitCount);

            // 5. ユーザー名を取得
            if (ranking.length > 0) {
                const userIds = ranking.map(r => r.userId);
                const { data: profiles } = await supabaseAdmin
                    .from("profiles")
                    .select("id, name")
                    .in("id", userIds);

                const profileMap = new Map<string, string>();
                (profiles || []).forEach((p: any) => {
                    if (p.name) profileMap.set(p.id, p.name);
                });

                ranking.forEach((r: any) => {
                    r.userName = profileMap.get(r.userId) || undefined;
                });
            }

            res.json({
                ok: true,
                month: targetMonth,
                ranking,
            });

        } catch (err: any) {
            console.error("[Weighted Ranking] Error:", err);
            res.status(500).json({ ok: false, error: err?.message || "ランキングの取得に失敗しました" });
        }
    }
);

export default router;
