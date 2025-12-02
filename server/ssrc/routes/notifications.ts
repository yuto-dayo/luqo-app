import { Router, type Response } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { supabaseAdmin } from "../services/supabaseClient";

const router = Router();

/**
 * GET /api/v1/notifications
 * 自分宛ての通知（kind="notification"）を最新順に取得する
 */
router.get("/", async (req, res: Response) => {
  const r = req as AuthedRequest;
  const userId = r.userId;

  if (!userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    // Supabaseのeventsテーブルから検索
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "notification") // 通知のみフィルタ
      .order("created_at", { ascending: false })
      .limit(20); // 最新20件

    if (error) {
      throw error;
    }

    // フロントエンドが期待する形式に整形
    const items = (data || []).map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      kind: row.kind,
    }));

    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[Notifications] fetch error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

export default router;
