import express from "express";
import type { LogEvent } from "../models/events";
import { dbClient } from "../lib/dbClient";

export const logsRouter = express.Router();

// POST /api/v1/luqo/log
logsRouter.post("/", async (req, res, next) => {
  try {
    const body = req.body as { event?: LogEvent };

    if (!body?.event) {
      return res.status(400).json({ error: "Missing 'event' in request body" });
    }

    const event = body.event;

    if (event.kind !== "log") {
      return res.status(400).json({ error: "event.kind must be 'log'" });
    }

    if (!event.userId || !event.payload) {
      return res.status(400).json({ error: "Invalid event: missing userId or payload" });
    }

    const saved = await dbClient.appendEvent(event);

    return res.json({ event: saved });
  } catch (err) {
    next(err);
  }
});
