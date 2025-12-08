import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { dbClient } from "../lib/dbClient";
import type { AuthedRequest } from "../types/authed-request";
import { loadPromptById } from "../lib/promptIds";
import { openai } from "../lib/openaiClient";
import { supabaseAdmin } from "../services/supabaseClient";

export const logsRouter = Router();

type LogEventRequestBody = {
  userId?: string;
  text: string;
  ts?: number;
};

const ALLOWED_SOURCES = new Set(["daily-log"]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isLogEventRequest = (value: unknown): value is LogEventRequestBody => {
  if (!value || typeof value !== "object") return false;
  const body = value as LogEventRequestBody;

  if (!isNonEmptyString(body.text)) return false;

  if (body.userId !== undefined && !isNonEmptyString(body.userId)) return false;

  if (body.ts !== undefined && !isFiniteNumber(body.ts)) return false;
  return true;
};

const resolveTimestamp = (value: number | undefined): number => {
  if (isFiniteNumber(value) && value > 0) {
    return Math.floor(value);
  }
  return Date.now();
};

logsRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthedRequest;
      const body = req.body as LogEventRequestBody;

      if (!isLogEventRequest(body)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid log event payload",
        });
      }

      // Middlewareで付与された認証済みユーザーIDを使用し、body指定は無視する
      const userId = r.userId;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "Unauthorized (no user id)",
        });
      }

      const text = body.text.trim();

      if (!text) {
        return res.status(400).json({
          ok: false,
          error: "text is required",
        });
      }

      const ts = resolveTimestamp(body.ts);
      const createdAt = new Date(ts).toISOString();
      const source = "daily-log";

      // メンション抽出 (簡易: @user_id を拾う)
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      const mentionSet = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(text)) !== null) {
        const user = match[1];
        if (user && user !== userId) {
          mentionSet.add(user);
        }
      }
      const mentions = Array.from(mentionSet);

      const saved = await dbClient.appendEvent({
        userId,
        text,
        createdAt,
        kind: "log",
        raw: {
          source,
          ts,
          mentions,
        },
      }, r.supabase);

      if (mentions.length > 0) {
        for (const targetUser of mentions) {
          await dbClient.appendEvent({
            userId: targetUser,
            text: `【通知】${userId} さんが日報であなたにメンションしました: "${text}"`,
            kind: "notification",
            createdAt,
            raw: {
              source: "mention-notification",
              ts,
              from: userId,
              mentions,
              // Qスコア加点などの拡張用メタデータ
              qscore: { reason: "mention", value: 1 },
            },
          }, r.supabase);
        }
      }

      const event = {
        id: saved.id ?? `event-${ts}`,
        userId,
        text,
        source,
        ts,
        mentions,
      };

      return res.status(201).json({
        ok: true,
        event,
      });
    } catch (error) {
      console.error("[logs] failed to append event", error);
      return next(error);
    }
  },
);

// 過去ログ取得API
logsRouter.get(
  "/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthedRequest;
      const userId = r.userId;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "Unauthorized (no user id)",
        });
      }

      const { month } = req.query;
      const targetMonth = typeof month === "string" ? month : undefined;

      // 月が指定されていない場合は現在の月を使用
      const now = new Date();
      const currentMonth = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const logs = await dbClient.getEventsByUserMonth(userId, currentMonth, r.supabase);

      // kindが"log"のもののみを返す（通知などは除外）
      const logEvents = logs
        .filter((log) => log.kind === "log" && log.text)
        .map((log) => ({
          id: log.id,
          text: log.text || "",
          createdAt: log.createdAt,
          month: log.month,
        }));

      return res.json({
        ok: true,
        logs: logEvents,
        month: currentMonth,
      });
    } catch (error) {
      console.error("[logs] failed to fetch history", error);
      return next(error);
    }
  },
);

// 全員のログを期間で取得（ニュース表示用）
logsRouter.get(
  "/history/all",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthedRequest;
      const userId = r.userId;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "Unauthorized (no user id)",
        });
      }

      // クエリパラメータから期間を取得（デフォルトは過去1週間）
      const { days = "7" } = req.query;
      const daysNum = parseInt(String(days), 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
        return res.status(400).json({
          ok: false,
          error: "days must be between 1 and 30",
        });
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - daysNum * 24 * 60 * 60 * 1000);
      const endDate = now;

      // 全ユーザーのログを取得するため、管理者クライアントを使用
      const allLogs = await dbClient.getAllEventsByDateRange(
        startDate.toISOString(),
        endDate.toISOString(),
        undefined, // 管理者クライアントを使用（RLSをバイパスして全ユーザーのログを取得）
      );

      // ログのみを返す（通知などは除外）
      const logEvents = allLogs
        .filter((log) => log.kind === "log" && log.text)
        .map((log) => ({
          id: log.id,
          userId: log.userId,
          text: log.text || "",
          createdAt: log.createdAt,
          month: log.month,
        }));

      return res.json({
        ok: true,
        logs: logEvents,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: daysNum,
      });
    } catch (error) {
      console.error("[logs] failed to fetch all history", error);
      return next(error);
    }
  },
);

// AIニュース生成API（プロンプトベース）
logsRouter.get(
  "/news",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthedRequest;
      const userId = r.userId;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "Unauthorized (no user id)",
        });
      }

      // クエリパラメータから期間を取得（デフォルトは過去1週間）
      const { days = "7" } = req.query;
      const daysNum = parseInt(String(days), 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
        return res.status(400).json({
          ok: false,
          error: "days must be between 1 and 30",
        });
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - daysNum * 24 * 60 * 60 * 1000);
      const endDate = now;

      // ログデータを取得（全ユーザーのログを取得するため、管理者クライアントを使用）
      const allLogs = await dbClient.getAllEventsByDateRange(
        startDate.toISOString(),
        endDate.toISOString(),
        undefined, // 管理者クライアントを使用（RLSをバイパスして全ユーザーのログを取得）
      );

      // ログのみを抽出
      const logEvents = allLogs
        .filter((log) => log.kind === "log" && log.text)
        .map((log) => ({
          id: log.id,
          userId: log.userId,
          text: log.text || "",
          createdAt: log.createdAt,
        }));

      // ログが空の場合はデフォルトメッセージを返す
      if (logEvents.length === 0) {
        return res.json({
          ok: true,
          newsItems: ["過去1週間のログはありません"],
        });
      }

      // ユーザー名を取得（ユーザーIDからユーザー名へのマッピング）
      const uniqueUserIds = Array.from(new Set(logEvents.map((log) => log.userId).filter((id): id is string => Boolean(id))));
      const userNameMap: Record<string, string> = {};
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, name")
          .in("id", uniqueUserIds);

        if (!profileError && profiles) {
          profiles.forEach((profile) => {
            userNameMap[profile.id] = profile.name || profile.id; // 名前がない場合はuserIdをそのまま使用
          });
        }
      }

      // ユーザー名が取得できなかったユーザーIDは、そのままuserIdを使用
      uniqueUserIds.forEach((userId) => {
        if (!userNameMap[userId]) {
          userNameMap[userId] = userId;
        }
      });

      // プロンプトを読み込み
      const systemPrompt = await loadPromptById("news.prompt");

      // ログデータを整形してプロンプトに含める（ユーザーIDをユーザー名に置き換え）
      const logsText = logEvents
        .map((log, index) => {
          if (!log.createdAt) return "";
          const logDate = new Date(log.createdAt);
          const daysAgo = Math.floor((now.getTime() - logDate.getTime()) / (24 * 60 * 60 * 1000));
          let timeLabel = "";
          if (daysAgo === 0) {
            timeLabel = "今日";
          } else if (daysAgo === 1) {
            timeLabel = "昨日";
          } else {
            timeLabel = `${daysAgo}日前`;
          }
          const userName = log.userId ? userNameMap[log.userId] || log.userId : "不明";
          return `[${index + 1}] ${timeLabel} ${userName}: ${log.text || ""}`;
        })
        .filter((text) => text.length > 0)
        .join("\n");

      // 統計情報を追加
      const logCount = logEvents.length;
      const uniqueUsers = new Set(logEvents.map((log) => log.userId));
      const userCount = uniqueUsers.size;

      // ユーザー別のログ数
      const userLogCounts = new Map<string, number>();
      logEvents.forEach((log) => {
        const userId = log.userId;
        if (!userId) return;
        userLogCounts.set(userId, (userLogCounts.get(userId) || 0) + 1);
      });
      const topUsers = Array.from(userLogCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([userId, count]) => {
          const userName = userNameMap[userId] || userId;
          return `${userName}(${count}件)`;
        })
        .join(", ");

      // 日別のログ数
      const dailyCounts = new Map<string, number>();
      logEvents.forEach((log) => {
        if (!log.createdAt) return;
        const date = new Date(log.createdAt).toLocaleDateString("ja-JP", {
          month: "short",
          day: "numeric",
        });
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      });
      const mostActiveDay = Array.from(dailyCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];

      const userPrompt = `過去${daysNum}日間のログデータを分析して、ニュース項目を生成してください。

【統計情報】
- 総ログ件数: ${logCount}件
- 参加人数: ${userCount}名
- アクティブユーザー（上位3名）: ${topUsers || "なし"}
- 最もアクティブな日: ${mostActiveDay ? `${mostActiveDay[0]}（${mostActiveDay[1]}件）` : "なし"}

【ログ一覧】
${logsText}

上記のデータを基に、ニュース項目を生成してください。`;

      // OpenAI API呼び出し
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("Empty response from OpenAI");
      }

      const json = JSON.parse(responseText);
      const newsItems = json.newsItems || ["ニュースの生成に失敗しました"];

      return res.json({
        ok: true,
        newsItems,
      });
    } catch (error) {
      console.error("[logs] failed to generate news", error);
      // エラー時はフォールバックとしてデフォルトメッセージを返す
      return res.json({
        ok: true,
        newsItems: ["ニュースの取得に失敗しました"],
      });
    }
  },
);

// 期間指定で全ユーザーログを要約生成するAPI（新機能）
logsRouter.get(
  "/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthedRequest;
      const userId = r.userId;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: "Unauthorized (no user id)",
        });
      }

      // クエリパラメータから期間を取得（開始日・終了日）
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate || typeof startDate !== "string" || typeof endDate !== "string") {
        return res.status(400).json({
          ok: false,
          error: "startDate and endDate are required (ISO 8601 format)",
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // バリデーション
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          ok: false,
          error: "Invalid date format. Use ISO 8601 format (e.g., 2025-01-01T00:00:00Z)",
        });
      }

      if (start >= end) {
        return res.status(400).json({
          ok: false,
          error: "startDate must be before endDate",
        });
      }

      // 期間が長すぎる場合の制限（最大90日）
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        return res.status(400).json({
          ok: false,
          error: "Date range cannot exceed 90 days",
        });
      }

      // ログデータを取得（チーム要約のため、管理者クライアントを使用して全ユーザーのログを取得）
      // undefinedを渡すことで、getClient関数が自動的にsupabaseAdminを使用する
      const allLogs = await dbClient.getAllEventsByDateRange(
        start.toISOString(),
        end.toISOString(),
        undefined, // 管理者クライアントを使用（RLSをバイパスして全ユーザーのログを取得）
      );

      // ログのみを抽出
      const logEvents = allLogs
        .filter((log) => log.kind === "log" && log.text)
        .map((log) => ({
          id: log.id,
          userId: log.userId,
          text: log.text || "",
          createdAt: log.createdAt,
        }));

      // ログが空の場合はデフォルトメッセージを返す
      if (logEvents.length === 0) {
        return res.json({
          ok: true,
          summary: {
            overview: "指定期間内のログはありません",
            insights: [],
            highlights: [],
            statistics: {
              totalLogs: 0,
              uniqueUsers: 0,
              dateRange: {
                start: start.toISOString(),
                end: end.toISOString(),
                days: Math.ceil(daysDiff),
              },
            },
          },
        });
      }

      // ユーザー名を取得（ユーザーIDからユーザー名へのマッピング）
      const uniqueUserIds = Array.from(new Set(logEvents.map((log) => log.userId).filter((id): id is string => Boolean(id))));
      const userNameMap: Record<string, string> = {};
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, name")
          .in("id", uniqueUserIds);

        if (!profileError && profiles) {
          profiles.forEach((profile) => {
            userNameMap[profile.id] = profile.name || profile.id; // 名前がない場合はuserIdをそのまま使用
          });
        }
      }

      // ユーザー名が取得できなかったユーザーIDは、そのままuserIdを使用
      uniqueUserIds.forEach((userId) => {
        if (!userNameMap[userId]) {
          userNameMap[userId] = userId;
        }
      });

      // 統計情報を計算
      const logCount = logEvents.length;
      const uniqueUsers = new Set(logEvents.map((log) => log.userId));
      const userCount = uniqueUsers.size;

      // ユーザー別のログ数
      const userLogCounts = new Map<string, number>();
      logEvents.forEach((log) => {
        const uid = log.userId;
        if (!uid) return;
        userLogCounts.set(uid, (userLogCounts.get(uid) || 0) + 1);
      });
      const topUsers = Array.from(userLogCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // 日別のログ数
      const dailyCounts = new Map<string, number>();
      logEvents.forEach((log) => {
        if (!log.createdAt) return;
        const date = new Date(log.createdAt).toLocaleDateString("ja-JP", {
          month: "short",
          day: "numeric",
        });
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      });
      const mostActiveDay = Array.from(dailyCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];

      // プロンプトを読み込み（既存のnews.promptを拡張利用）
      const systemPrompt = await loadPromptById("news.prompt");

      // ログデータを整形してプロンプトに含める（ユーザーIDをユーザー名に置き換え）
      const logsText = logEvents
        .map((log, index) => {
          if (!log.createdAt) return "";
          const logDate = new Date(log.createdAt);
          const dateStr = logDate.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const userName = log.userId ? userNameMap[log.userId] || log.userId : "不明";
          return `[${index + 1}] ${dateStr} ${userName}: ${log.text || ""}`;
        })
        .filter((text) => text.length > 0)
        .join("\n");

      const userPrompt = `${start.toLocaleDateString("ja-JP")} から ${end.toLocaleDateString("ja-JP")} までの期間（${Math.ceil(daysDiff)}日間）のログデータを分析して、チーム全体の活動を要約してください。

【統計情報】
- 総ログ件数: ${logCount}件
- 参加人数: ${userCount}名
- アクティブユーザー（上位5名）: ${topUsers.map(([uid, count]) => {
          const userName = userNameMap[uid] || uid;
          return `${userName}(${count}件)`;
        }).join(", ") || "なし"}
- 最もアクティブな日: ${mostActiveDay ? `${mostActiveDay[0]}（${mostActiveDay[1]}件）` : "なし"}

【ログ一覧】
${logsText}

上記のデータを基に、以下の形式でJSON形式で出力してください：
{
  "overview": "期間全体の総括（100文字程度）",
  "insights": [
    "洞察1（重要な発見やパターン）",
    "洞察2",
    "洞察3"
  ],
  "highlights": [
    "ハイライト1（特に注目すべき活動）",
    "ハイライト2"
  ]
}`;

      // OpenAI API呼び出し
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("Empty response from OpenAI");
      }

      const json = JSON.parse(responseText);
      const summary = {
        overview: json.overview || "期間内の活動を分析しました",
        insights: json.insights || [],
        highlights: json.highlights || [],
      };

      return res.json({
        ok: true,
        summary: {
          ...summary,
          statistics: {
            totalLogs: logCount,
            uniqueUsers: userCount,
            topUsers: topUsers.map(([uid, count]) => ({ 
              userId: uid, 
              userName: userNameMap[uid] || uid,
              count 
            })),
            mostActiveDay: mostActiveDay ? { date: mostActiveDay[0], count: mostActiveDay[1] } : null,
            dailyCounts: Array.from(dailyCounts.entries()).map(([date, count]) => ({ date, count })),
            dateRange: {
              start: start.toISOString(),
              end: end.toISOString(),
              days: Math.ceil(daysDiff),
            },
          },
        },
      });
    } catch (error) {
      console.error("[logs] failed to generate summary", error);
      return next(error);
    }
  },
);

export default logsRouter;
