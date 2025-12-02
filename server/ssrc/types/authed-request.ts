// server/src/types/authed-request.ts
import type { Request } from "express";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthedRequest extends Request {
  userId: string;
  supabase: SupabaseClient;
}
