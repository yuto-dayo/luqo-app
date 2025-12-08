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
      // 接続タイムアウトエラーの場合は詳細をログに記録
      if (error?.message?.includes("timeout") || error?.message?.includes("fetch failed")) {
        console.error("Auth failed: Supabase connection timeout", {
          error: error?.message,
          url: process.env.SUPABASE_URL,
        });
        return res.status(503).json({
          ok: false,
          error: "Service temporarily unavailable. Please try again later.",
        });
      }
      
      // トークン期限切れの場合は詳細をログに記録
      const isExpired = error?.message?.includes("expir") || error?.message?.includes("expired");
      if (isExpired) {
        console.warn("Auth failed: Token expired", {
          error: error?.message,
          path: req.path,
        });
        return res.status(401).json({ 
          ok: false, 
          error: "Token expired. Please log in again.",
          code: "TOKEN_EXPIRED"
        });
      }
      
      console.warn("Auth failed:", error?.message);
      return res.status(401).json({ 
        ok: false, 
        error: "Invalid or expired token",
        code: "INVALID_TOKEN"
      });
    }

    // 3. リクエストに userId と RLS対応クライアントを付与
    (req as any).userId = data.user.id;
    (req as any).supabase = createAuthenticatedClient(token);

    next();
  } catch (err: any) {
    // 接続タイムアウトエラーの詳細なハンドリング
    if (err?.message?.includes("timeout") || err?.code === "UND_ERR_CONNECT_TIMEOUT") {
      console.error("Auth middleware: Supabase connection timeout", {
        message: err.message,
        code: err.code,
        url: process.env.SUPABASE_URL,
      });
      return res.status(503).json({
        ok: false,
        error: "Service temporarily unavailable. Please try again later.",
      });
    }
    console.error("Auth middleware error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}