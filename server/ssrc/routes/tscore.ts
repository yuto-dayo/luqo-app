import { Router, Request, Response, NextFunction } from "express";
import { dbClient } from "../lib/dbClient";
import type { AuthedRequest } from "../types/authed-request";
import { getUserCount } from "../services/supabaseClient";

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
router.get(
    "/pending",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = req as AuthedRequest;
            const currentUserId = r.userId;

            // DBから承認待ちがある全ユーザーを取得
            const allPending = await dbClient.getPendingStarStates(r.supabase);

            const myTasks = allPending.map(userItem => {
                // 自分の申請は除外
                if (userItem.userId === currentUserId) return null;

                // 「まだ自分が投票していないスター」だけを抽出
                const unvotedStars = userItem.pending.filter(starId => {
                    const votes = userItem.votes?.[starId];
                    if (!votes) return true; // まだ誰も投票してないなら表示

                    // 承認者リストにも、否決者リストにも、保留者リストにも自分がいなければ表示
                    const hasVoted = votes.approvers.includes(currentUserId) ||
                        votes.rejecters.includes(currentUserId) ||
                        (votes.passers || []).includes(currentUserId);
                    return !hasVoted;
                });

                if (unvotedStars.length === 0) return null;

                return {
                    userId: userItem.userId,
                    pending: unvotedStars,
                    votes: userItem.votes // 進捗表示用に渡すのはOK
                };
            }).filter(Boolean); // nullを除去

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
// Body: { action: 'apply'|'approve'|'reject'|'pass', starId: string, targetUserId: string }
// ★修正: 楽観的ロックによる排他制御を実装
router.post(
    "/action",
    async (req: Request, res: Response, next: NextFunction) => {
        const { action, starId, targetUserId, feedback } = req.body;
        const r = req as AuthedRequest;

        if (!action || !starId || !targetUserId) {
            res.status(400).json({ ok: false, error: "Missing required fields" });
            return;
        }

        try {
            // バリデーション
            if (action === "reject" && (!feedback || typeof feedback !== "string" || !feedback.trim())) {
                throw new Error("Feedback is required for rejection");
            }
            if (!["apply", "approve", "reject", "pass"].includes(action)) {
                throw new Error("Invalid action");
            }

            // RPC呼び出し (DB側で排他制御とロジック実行)
            const { data, error } = await r.supabase.rpc("vote_star", {
                target_user_id: targetUserId,
                star_id: starId,
                action_type: action,
                feedback: feedback || null
            });

            if (error) {
                console.error("RPC vote_star error:", error);
                throw new Error(`Database error: ${error.message}`);
            }

            res.json(data);

        } catch (err: any) {
            if (err?.message === "Feedback is required for rejection" || err?.message === "Invalid action") {
                res.status(400).json({ ok: false, error: err.message });
                return;
            }
            next(err);
        }
    }
);

export default router;
