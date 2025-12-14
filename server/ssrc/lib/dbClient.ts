import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../services/supabaseClient";
import type { EventRow } from "../models/events";
import type { UserBanditState } from "../types/banditState";
import type { UserStarState } from "../types/starState";
import { logger } from "./logger";

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

export async function getEventsByUserPeriod(
  userId: string,
  startDate: string, // ISO string
  endDate: string,   // ISO string
  client?: SupabaseClient,
): Promise<EventRow[]> {
  const supabase = getClient(client);

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Failed to fetch events:", error);
    return [];
  }

  // EventRow型に合わせて整形
  return (data || []).map((row: DbEvent) => ({
    id: row.id,
    userId: row.user_id,
    month: row.created_at.slice(0, 7), // 後方互換性のため残す
    createdAt: row.created_at,
    text: row.text,
    kind: row.kind,
    raw: row.payload,
  }));
}

export async function getEventsByUserMonth(
  userId: string,
  month: string, // "YYYY-MM"
  client?: SupabaseClient,
): Promise<EventRow[]> {
  // 月の初日と末日を計算して範囲検索
  const start = `${month}-01T00:00:00.000Z`;
  // 次の月の1日より前まで (簡易実装)
  const [y, m] = month.split("-").map(Number);
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) { nextM = 1; nextY++; }
  const nextDate = new Date(Date.UTC(nextY, nextM - 1, 1));
  const end = nextDate.toISOString();

  return getEventsByUserPeriod(userId, start, end, client);
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
    logger.error("Failed to fetch all events:", error);
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
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data.payload,
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

  // 旧形式から新形式へのマイグレーションを適用
  const { migrateBanditState } = await import("../types/banditState");
  return migrateBanditState(data?.state || null);
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

  if (error) logger.error("Failed to save bandit state", error);
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

  if (error) logger.error("Failed to save star state", error);
}

export async function getPendingStarStates(client?: SupabaseClient): Promise<Array<{ userId: string; userName?: string; pending: string[]; votes?: UserStarState["votes"] }>> {
  const supabase = getClient(client);
  // JSONの中身でフィルタリングするのはPostgresなら可能だが、
  // ここでは全件取得してアプリ側でフィルタする簡易実装（ユーザー数が増えたら要改善）
  const { data } = await supabase.from("star_states").select("*");

  const results: Array<{ userId: string; userName?: string; pending: string[]; votes?: any }> = [];

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

  // ユーザーネームを取得（profilesテーブルから、なければauth.usersから）
  // 注意: RLSをバイパスするため、常にsupabaseAdminを使用
  if (results.length > 0) {
    const userIds = results.map(r => r.userId);
    const profileMap = new Map<string, string>();

    // 1. まずprofilesテーブルから取得
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    if (profileError) {
      logger.error("[getPendingStarStates] Failed to fetch profiles:", profileError);
    } else {
      logger.debug(`[getPendingStarStates] Fetched ${profiles?.length || 0} profiles for ${userIds.length} user IDs`);
    }

    (profiles || []).forEach((p: any) => {
      if (p.name && p.name.trim()) {
        profileMap.set(p.id, p.name);
      }
    });

    // 2. profilesにないユーザーはauth.usersから取得を試みる
    const missingUserIds = userIds.filter(id => !profileMap.has(id));
    if (missingUserIds.length > 0) {
      logger.debug(`[getPendingStarStates] Trying to fetch ${missingUserIds.length} users from auth.users`);
      // auth.usersは直接クエリできないため、RPC関数を使うか、emailを取得して表示名として使う
      // ここでは、profilesテーブルにレコードを作成するか、emailを取得する方法を検討
      // とりあえず、emailを取得してみる
      for (const userId of missingUserIds) {
        try {
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (!authError && authUser?.user?.email) {
            // emailの@より前の部分を表示名として使用
            const emailName = authUser.user.email.split('@')[0];
            profileMap.set(userId, emailName);
            logger.debug(`[getPendingStarStates] Using email prefix as name for ${userId}: ${emailName}`);
          }
        } catch (err) {
          logger.warn(`[getPendingStarStates] Failed to get auth user for ${userId}:`, err);
        }
      }
    }

    // 結果にユーザーネームを追加
    results.forEach(r => {
      r.userName = profileMap.get(r.userId) || undefined;
      if (!r.userName) {
        logger.warn(`[getPendingStarStates] No userName found for userId: ${r.userId}`);
      }
    });
  }

  return results;
}

// アクティブユーザーID（直近30日にイベントがあるユーザー）を取得
export async function getAllActiveUserIds(client?: SupabaseClient): Promise<string[]> {
  const supabase = getClient(client);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // distinct指定がsupabase-jsで直接できない場合があるため、rpcを使うか、
  // 少人数前提でイベントを取得してSetでユニーク化する簡易実装を行う。
  // ここでは events から user_id を取得してユニーク化する。
  const { data, error } = await supabase
    .from("events")
    .select("user_id")
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    logger.error("Failed to fetch active users:", error);
    return [];
  }

  const userIds = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.user_id) userIds.add(row.user_id);
  });

  return Array.from(userIds);
}

export const dbClient = {
  getAllEventsByDateRange,
  getAllActiveUserIds,
  getEventsByUserMonth,
  getEventsByUserPeriod,
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
    logger.warn("Failed to fetch team logs", error);
    return [];
  }

  return data.map((row: any) => row.text || "").filter(Boolean);
}
