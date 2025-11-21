import { Router, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { LuqoBanditBrain } from "../lib/banditBrain";

const router = Router();
const brain = new LuqoBanditBrain();

/**
 * POST /api/v1/bandit/suggest
 * ユーザーの状態（KPI, スコア, ログ）に基づいて、次に取り組むべきアクションを提案する。
 */
router.post(
    "/suggest",
    async (req, res: Response, next: NextFunction) => {
        const r = req as AuthedRequest;

        try {
            if (!r.userId) {
                return res
                    .status(401)
                    .json({ ok: false, error: "Unauthorized: No user ID found" });
            }

            const { kpi, score, history } = req.body as {
                kpi: "quality" | "growth" | "innovation";
                score: { lu: number; q: number; o: number; total: number };
                history: any[];
            };

            if (!kpi || !score) {
                return res.status(400).json({
                    ok: false,
                    error: "Bad Request: 'kpi' and 'score' are required",
                });
            }

            // 1. モードのマッピング (Frontend KPI -> Backend Mode)
            let mode: "EARN" | "LEARN" | "TEAM" = "EARN";
            if (kpi === "quality") mode = "EARN";
            else if (kpi === "growth") mode = "LEARN";
            else if (kpi === "innovation") mode = "TEAM";

            // 2. アームの選択 (Thompson Sampling)
            const selectedArms = brain.selectArms(mode);
            const bestArm = selectedArms[0];

            // 3. ポテンシャル（不確実性）の計算
            const logsCount = Array.isArray(history) ? history.length : 0;
            const potential = brain.calculatePotential(score.total, logsCount);

            // 4. システムプロンプトの生成（将来的にLLMに渡す用）
            const systemPrompt = brain.generateSystemPrompt(bestArm);

            // レスポンス生成
            // Frontendの期待する形式に合わせて返す
            // type BanditSuggestResponse = {
            //   suggestion: { action: string; luqoHint: string };
            //   scores: { quality: number; growth: number; innovation: number }; // 分布（今回はダミー）
            //   baseKpi: string;
            //   chosenKpi: string;
            // }

            return res.status(200).json({
                ok: true,
                suggestion: {
                    action: bestArm.focus,
                    luqoHint: bestArm.desc,
                    systemPrompt, // デバッグ用または将来用
                },
                potential,
                // 分布データは今回は簡易的に返す（本来は全アームの確率分布などを返す）
                scores: {
                    quality: mode === "EARN" ? 0.6 : 0.2,
                    growth: mode === "LEARN" ? 0.6 : 0.2,
                    innovation: mode === "TEAM" ? 0.6 : 0.2,
                },
                baseKpi: kpi,
                chosenKpi: kpi, // 今回はリクエストされたKPIをそのまま採用（BanditでKPI自体を変えるロジックは未実装）
            });

        } catch (err) {
            console.error("[Bandit] suggest error:", err);
            return res.status(500).json({ ok: false, error: "Internal Server Error" });
        }
    }
);

export default router;
