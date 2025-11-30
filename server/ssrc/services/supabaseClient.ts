import { createClient } from "@supabase/supabase-js";

// Ensure these are set in your environment (.env)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 環境変数の検証（起動時にクラッシュを防ぐ）
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is not set");
}
if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY environment variable is not set");
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const createAuthenticatedClient = (token: string) => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

/**
 * Retrieve total number of registered users.
 */
export async function getUserCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Failed to count users", error);
    return 0;
  }
  return count ?? 0;
}
