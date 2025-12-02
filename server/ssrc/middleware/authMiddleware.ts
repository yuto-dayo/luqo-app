import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin, createAuthenticatedClient } from "../services/supabaseClient";

/**
 * Authorization ヘッダーの Bearer トークンを検証し、
 * 正しい userId をリクエストに付与するミドルウェア
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // 1. ヘッダーからトークン取得
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // 未認証でも通すルートがある場合はここで分岐、今回は厳格に401を返す例
      return res.status(401).json({ ok: false, error: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ ok: false, error: "Invalid Authorization header format" });
    }

    // 2. Supabaseでトークン検証 & ユーザー取得
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      console.warn("Auth failed:", error?.message);
      return res.status(401).json({ ok: false, error: "Invalid or expired token" });
    }

    // 3. リクエストに userId と RLS対応クライアントを付与
    (req as any).userId = data.user.id;
    (req as any).supabase = createAuthenticatedClient(token);

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}