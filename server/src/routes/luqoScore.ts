import { Router, Request, Response } from "express";
import { getEventsByUserMonth } from "../lib/dbClient";
import { generateLuqoScore } from "../lib/openaiClient";

const router = Router();

/**
 * POST /api/v1/luqo/score-month
 * 指定ユーザーの指定月ログを集計してLUQOスコアを生成
 */
router.post("/score-month", async (req: Request, res: Response) => {
  try {
    const { userId, month } = req.body;
    if (!userId || !month)
      return res.status(400).json({ ok: false, error: "userId and month required" });

    console.log(`[LUQO] Generating score for ${userId} (${month})...`);

    const logs = await getEventsByUserMonth(userId, month);
    if (!logs.length)
      return res.status(404).json({ ok: false, error: "no logs found" });

    const score = await generateLuqoScore(logs);

    res.status(200).json({ ok: true, score });
  } catch (err) {
    console.error("[LUQO] score error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export { router as luqoScoreRouter };
