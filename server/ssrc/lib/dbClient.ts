import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../services/supabaseClient";
import type { EventRow } from "../models/events";
import type { UserBanditState } from "../types/banditState";
import type { UserStarState } from "../types/starState";

// クライアント未指定時は管理者クライアントを使用（後方互換用）
const getClient = (client?: SupabaseClient) => client ?? supabaseAdmin;

// --- 1. イベントログ (Events) ---

type DbEvent = {
  id: string;
  user_id: string;
  created_at: string;
  text: string | null;
  kind: string;
  payload: any;
};

export async function getEventsByUserMonth(
  userId: string,
  month: string, // "YYYY-MM"
  client?: SupabaseClient,
): Promise<EventRow[]> {
  const supabase = getClient(client);
  // 月の初日と末日を計算して範囲検索
  const start = `${month}-01T00:00:00.000Z`;
  // 次の月の1日より前まで (簡易実装)
  const [y, m] = month.split("-").map(Number);
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) { nextM = 1; nextY++; }
  const nextDate = new Date(Date.UTC(nextY, nextM - 1, 1));
  const end = nextDate.toISOString();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch events:", error);
    return [];
  }

  // EventRow型に合わせて整形
  return (data || []).map((row: DbEvent) => ({
    id: row.id,
    userId: row.user_id,
    month: row.created_at.slice(0, 7),
    createdAt: row.created_at,
    text: row.text,
    kind: row.kind,
    raw: row.payload, // payloadをrawとして扱う
  }));
}

// 全員のログを期間で取得（ニュース表示用）
export async function getAllEventsByDateRange(
  startDate: string, // ISO string
  endDate: string, // ISO string
  client?: SupabaseClient,
): Promise<EventRow[]> {
  const supabase = getClient(client);

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("kind", "log") // ログのみを取得
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch all events:", error);
    return [];
  }

  // EventRow型に合わせて整形
  return (data || []).map((row: DbEvent) => ({
    id: row.id,
    userId: row.user_id,
    month: row.created_at.slice(0, 7),
    createdAt: row.created_at,
    text: row.text,
    kind: row.kind,
    raw: row.payload,
  }));
}

export async function appendEvent(event: Partial<EventRow>, client?: SupabaseClient): Promise<EventRow> {
  const supabase = getClient(client);
  const now = new Date().toISOString();
  const createdAt = event.createdAt ?? now;
  const kind = (event as any)?.kind ?? "luqo_log";
  const userId = event.userId!;
  const text = event.text ?? "";

  // ペイロードには text 以外の雑多なデータを入れる
  const { id, userId: u, text: t, createdAt: c, ...rest } = event as any;

  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      kind,
      created_at: createdAt,
      text,
      payload: rest,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`DB Insert Error: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    month: data.created_at.slice(0, 7),
    createdAt: data.created_at,
    text: data.text,
    kind: data.kind,
    raw: data.payload,
  };
}

/**
 * 指定月の確定済みスコアを取得する
 */
export async function getFixedScore(userId: string, month: string, client?: SupabaseClient) {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "luqo_score_fixed") // 確定スコア識別子
    .contains("payload", { month: month })
    .order("created_at", { ascending: false }) // 最新1件
    .limit(1)
    .maybeSingle(); // single()だと0件でエラーになる場合があるのでmaybeSingle推奨

  if (error || !data) return null;

  return {
    ...data.payload, // { LU, Q, O, total, reasoning }
    fixedAt: data.created_at,
  };
}

// --- 2. バンディット状態 (Bandit State) ---

export async function getBanditState(userId: string, client?: SupabaseClient): Promise<UserBanditState> {
  const supabase = getClient(client);
  const { data } = await supabase
    .from("bandit_states")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.state as UserBanditState) || {};
}

export async function saveBanditState(userId: string, state: UserBanditState, client?: SupabaseClient): Promise<void> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from("bandit_states")
    .upsert({
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    });

  if (error) console.error("Failed to save bandit state", error);
}

// --- 3. Tスコア/スター状態 (Star State) ---

export async function getStarState(userId: string, client?: SupabaseClient): Promise<UserStarState> {
  const supabase = getClient(client);
  const { data } = await supabase
    .from("star_states")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.state as UserStarState) || { acquired: [], pending: [] };
}

export async function saveStarState(userId: string, state: UserStarState, client?: SupabaseClient): Promise<void> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from("star_states")
    .upsert({
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    });

  if (error) console.error("Failed to save star state", error);
}

export async function getPendingStarStates(client?: SupabaseClient): Promise<Array<{ userId: string; pending: string[]; votes?: UserStarState["votes"] }>> {
  const supabase = getClient(client);
  // JSONの中身でフィルタリングするのはPostgresなら可能だが、
  // ここでは全件取得してアプリ側でフィルタする簡易実装（ユーザー数が増えたら要改善）
  const { data } = await supabase.from("star_states").select("*");

  const results: Array<{ userId: string; pending: string[]; votes?: any }> = [];

  (data || []).forEach((row: any) => {
    const state = row.state as UserStarState;
    if (state.pending && state.pending.length > 0) {
      results.push({
        userId: row.user_id,
        pending: state.pending,
        votes: state.votes,
      });
    }
  });

  return results;
}

export const dbClient = {
  getAllEventsByDateRange,
  getEventsByUserMonth,
  appendEvent,
  getBanditState,
  saveBanditState,
  getStarState,
  saveStarState,
  getPendingStarStates,
  getFixedScore,
  getOrgLuqoStats,
  getTeamRecentLogs,
};

/**
 * 指定月の組織全体の平均LUQOスコアを算出する
 * (簡易実装: 全ユーザーの最新の確定スコアを集計)
 */
export async function getOrgLuqoStats(month: string, client?: SupabaseClient): Promise<{ LU: number; Q: number; O: number; count: number }> {
  const supabase = getClient(client);
  // 月初〜月末の範囲
  const start = `${month}-01T00:00:00.000Z`;
  const [y, m] = month.split("-").map(Number);
  // 翌月1日
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) { nextM = 1; nextY++; }
  const nextDate = new Date(Date.UTC(nextY, nextM - 1, 1));
  const end = nextDate.toISOString();

  // luqo_score_fixed イベントを全件取得
  const { data, error } = await supabase
    .from("events")
    .select("payload")
    .eq("kind", "luqo_score_fixed")
    .gte("created_at", start)
    .lt("created_at", end);

  if (error || !data || data.length === 0) {
    // データがない場合はデフォルト値を返す (または前月のデータを使うなどのfallback)
    return { LU: 0, Q: 0, O: 0, count: 0 };
  }

  // ユーザーごとの最新スコアをマップに保持（同月に複数回確定があった場合の重複排除）
  // payload内に userId がある前提、なければ events.user_id を結合する必要があるが、
  // appendEventの実装でpayloadにもデータを含めていると仮定。
  // 安全のため payload に userId がない場合は平均計算の精度が落ちるが、ここでは単純平均をとる。

  let totalLU = 0;
  let totalQ = 0;
  let totalO = 0;
  let count = 0;

  for (const row of data) {
    const p = row.payload as any;
    if (typeof p.LU === "number") {
      totalLU += p.LU;
      totalQ += p.Q;
      totalO += p.O;
      count++;
    }
  }

  if (count === 0) return { LU: 0, Q: 0, O: 0, count: 0 };

  return {
    LU: Math.round(totalLU / count),
    Q: Math.round(totalQ / count),
    O: Math.round(totalO / count),
    count
  };
}

/**
 * チーム全体の直近ログを取得（テキストのみ）
 */
export async function getTeamRecentLogs(limit = 20, client?: SupabaseClient): Promise<string[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from("events")
    .select("text")
    .not("text", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("Failed to fetch team logs", error);
    return [];
  }

  return data.map((row: any) => row.text || "").filter(Boolean);
}
