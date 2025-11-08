import { Router, Request, Response } from "express";
import { dbClient } from "../lib/dbClient"; // ✅ Google Sheets接続

const router = Router();

/**
 * POST /api/v1/luqo/logs
 * 現場ログイベントを受け取り、Google Sheetsに1行追記する。
 */
router.post("/api/v1/luqo/logs", async (req: Request, res: Response) => {
  try {
    const event = req.body;

    // 形式チェック（最低限）
    if (!event || typeof event !== "object") {
      return res.status(400).json({ ok: false, error: "Invalid event format" });
    }

    console.log("[LUQO] received event:", JSON.stringify(event, null, 2));

    // ★ Google Sheetsへ書き込み
    await dbClient.appendEvent(event);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[LUQO] failed to write event:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
