// server/src/routes/luqoLog.ts
import { Router, Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { dbClient } from "../lib/dbClient";
import type { LogEvent } from "../models/events";

const router = Router();

// フロントから来る「userId なし」の log イベント
export type LogEventInput = Omit<LogEvent, "userId">;

const isLogEventInput = (value: any): value is LogEventInput => {
  if (!value || typeof value !== "object") return false;

  if (value.kind !== "log") return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.occurredAt !== "string") return false;
  if (typeof value.recordedAt !== "string") return false;

  if (!value.payload || typeof value.payload !== "object") return false;
  if (typeof value.payload.text !== "string") return false;
  if (!Array.isArray(value.payload.tags)) return false;

  return true;
};

/**
 * POST /api/v1/luqo/logs
 */
router.post(
  "/logs",
  async (req, res: Response, next: NextFunction) => {
    const r = req as AuthedRequest;

    try {
      if (!r.userId) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }

      const body = req.body as { event?: unknown };

      if (!body?.event || !isLogEventInput(body.event)) {
        return res.status(400).json({ ok: false, error: "Invalid log event" });
      }

      const input = body.event;

      const event: LogEvent = {
        ...input,
        userId: r.userId, // ★ token から復元した userId を付与
      };

      const saved = await dbClient.appendEvent(event);

      return res.status(200).json({ ok: true, event: saved });
    } catch (err) {
      console.error("[LUQO] failed to write event:", err);
      return next(err);
    }
  },
);

export default router;