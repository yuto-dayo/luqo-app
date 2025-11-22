import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { dbClient } from "../lib/dbClient";

export const logsRouter = Router();

type LogEventRequestBody = {
  userId?: string;
  text: string;
  ts?: number;
};

const ALLOWED_SOURCES = new Set(["daily-log"]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isLogEventRequest = (value: unknown): value is LogEventRequestBody => {
  if (!value || typeof value !== "object") return false;
  const body = value as LogEventRequestBody;

  if (!isNonEmptyString(body.text)) return false;

  if (body.userId !== undefined && !isNonEmptyString(body.userId)) return false;

  if (body.ts !== undefined && !isFiniteNumber(body.ts)) return false;
  return true;
};

const resolveTimestamp = (value: number | undefined): number => {
  if (isFiniteNumber(value) && value > 0) {
    return Math.floor(value);
  }
  return Date.now();
};

logsRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LogEventRequestBody;

      if (!isLogEventRequest(body)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid log event payload",
        });
      }

      const userIdFromReq = (req as any).user?.id as string | undefined;
      const userIdFromBody =
        typeof body.userId === "string" ? body.userId.trim() : undefined;

      const userId = userIdFromReq ?? userIdFromBody;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "Unauthorized (no user id from auth or body)",
        });
      }

      const text = body.text.trim();

      if (!text) {
        return res.status(400).json({
          ok: false,
          error: "text is required",
        });
      }

      const ts = resolveTimestamp(body.ts);
      const createdAt = new Date(ts).toISOString();
      const source = "daily-log";

      const saved = await dbClient.appendEvent({
        userId,
        text,
        createdAt,
        raw: {
          source,
          ts,
        },
      });

      const event = {
        id: saved.id ?? `event-${ts}`,
        userId,
        text,
        source,
        ts,
      };

      return res.status(201).json({
        ok: true,
        event,
      });
    } catch (error) {
      console.error("[logs] failed to append event", error);
      return next(error);
    }
  },
);