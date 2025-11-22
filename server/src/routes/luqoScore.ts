import { Router, Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { getEventsByUserMonth } from "../lib/dbClient";
import { generateLuqoScore } from "../lib/openaiClient";
import type { EventRow } from "../models/events";

const router = Router();

/**
 * POST /api/v1/luqo/score-month
 * 認証ユーザーの指定月ログを集計して LUQO スコアを生成。
 *
 * body: { month: "2025-11", logText?: string }
 */
router.post(
  "/score-month",
  async (req: Request, res: Response, next: NextFunction) => {
    const r = req as AuthedRequest;

    try {
      if (!r.userId) {
        return res
          .status(401)
          .json({ ok: false, error: "Unauthorized: No user ID found in request" });
      }

      const { month, logText } = (req.body ?? {}) as {
        month?: string;
        logText?: string;
      };

      if (!month) {
        return res
          .status(400)
          .json({ ok: false, error: "Bad Request: 'month' is required (e.g. '2025-11')" });
      }

      const userId = r.userId;
      console.log(`[LUQO] Generating score for ${userId} (${month})...`);

      let logs: Array<{ text: string }> = [];

      // 単発テキスト評価モード
      if (typeof logText === "string" && logText.trim().length > 0) {
        logs = [{ text: logText.trim() }];
      } else {
        // 指定月のログからまとめて評価
        const events = await getEventsByUserMonth(userId, month);

        if (!events || events.length === 0) {
          return res
            .status(404)
            .json({ ok: false, error: "Not Found: No logs found for this month" });
        }

        // ★ EventRow 型に合わせて text だけ読む
        logs = events.map((event: EventRow) => ({
          text: event.text ?? "",
        }));
      }

      const score = await generateLuqoScore(logs);

      return res.status(200).json({ ok: true, score });
    } catch (err) {
      console.error("[LUQO] score error:", err);
      return res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  },
);

export { router as luqoScoreRouter };