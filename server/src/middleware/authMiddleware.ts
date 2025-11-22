import type { Request, Response, NextFunction } from "express";

/**
 * 開発用の簡易認証ミドルウェア。
 * - /api 以下のリクエストに userId を付与するだけ。
 * - トークン検証は一切行わない。
 *   ※ 本番では必ず差し替えること。
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  (req as any).userId = (req as any).userId ?? "demo-user";
  next();
}