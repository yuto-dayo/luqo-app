// server/src/types/authed-request.ts
import type { Request } from "express";

export interface AuthedRequest extends Request {
  userId: string;
}
