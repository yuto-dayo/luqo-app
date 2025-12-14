import { Router } from "express";
import type { Request, Response } from "express";
import { loadPromptById, type PromptId } from "../lib/promptIds";
import { openai } from "../lib/openaiClient";
import { dbClient } from "../lib/dbClient";
import type { AuthedRequest } from "../types/authed-request";

// --- 型定義: Just Culture Audit Result ---

type AuditResult = {
  audit_result: {
    is_incident: boolean;
    severity_level: 0 | 1 | 2 | 3;
    confidence_score: number;
    requires_corroboration: boolean;
    accused: {
      user_id: string | null;
      action_type: "SHADOW_WATCH" | "WARNING" | "PENALTY" | "VERIFY_ONLY";
      reason: string;
    } | null;
    reporter: {
      credibility_check: "PASS" | "SUSPICIOUS";
      guardian_bonus: number;
    } | null;
  };
  log_tag: string;
};

// ----------------------------------------
type LogInput =
  | string
  | {
    text?: string;
    occurredAt?: string;
  };

type BaseEvaluationRequest = {
  logs: LogInput[];
  summary?: string;
  metadata?: Record<string, unknown>;
};

type AnyEvaluationRequest = BaseEvaluationRequest & Record<string, unknown>;

async function callPrompt(promptId: PromptId, userContent: string) {
  const systemMessage = await loadPromptById(promptId);

  // OpenAI呼び出し (JSONモード)
  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userContent }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content;

  if (!text) {
    throw new Error(`[${promptId}] Empty response from OpenAI`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[${promptId}] Failed to parse JSON response`, err);
    return { raw: text };
  }
}

function normalizeLogs(logs: LogInput[] = []) {
  return logs
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      if (entry && typeof entry.text === "string") {
        return entry.text.trim();
      }
      return "";
    })
    .filter((text) => text.length > 0);
}

function buildUserMessage(
  kind: string,
  options: AnyEvaluationRequest & { normalizedLogs: string[] },
) {
  const { logs, summary, metadata, normalizedLogs, ...rest } = options;

  const parts: string[] = [`# Evaluation Kind\n${kind}`];

  if (summary) {
    parts.push(`# Summary\n${summary}`);
  }

  const mergedMetadata = {
    ...(metadata ?? {}),
    ...rest,
  };

  if (Object.keys(mergedMetadata).length > 0) {
    parts.push(`# Context\n${JSON.stringify(mergedMetadata, null, 2)}`);
  }

  parts.push(
    `# Logs (${normalizedLogs.length} entries)\n${normalizedLogs.join(
      "\n\n---\n\n",
    )}`,
  );

  return {
    normalizedLogs,
    prompt: parts.join("\n\n"),
  };
}

function createEvaluationHandler(options: { promptId: PromptId; kind: string }) {
  const { promptId, kind } = options;
  return async (
    req: Request<any, any, AnyEvaluationRequest>,
    res: Response,
  ) => {
    try {
      const body = (req.body ?? {}) as AnyEvaluationRequest;
      const normalizedLogs = normalizeLogs(body.logs);
      if (!normalizedLogs.length) {
        return res
          .status(400)
          .json({ ok: false, error: "logs must be a non-empty array" });
      }

      const { prompt } = buildUserMessage(kind, {
        ...body,
        normalizedLogs,
      });
      const result = await callPrompt(promptId, prompt);

      return res.status(200).json({ ok: true, result });
    } catch (err: any) {
      console.error(`[${kind}] evaluation error`, err);
      return res
        .status(500)
        .json({ ok: false, error: err?.message ?? "evaluation_failed" });
    }
  };
}

export const luqoEvaluationRouter = Router();
export const tScoreEvaluationRouter = Router();
export const paymasterEvaluationRouter = Router();
export const incidentEvaluationRouter = Router();

// POST /api/v1/luqo/evaluate -> prompts/luqo.md
luqoEvaluationRouter.post(
  "/evaluate",
  createEvaluationHandler({ promptId: "luqo.prompt", kind: "LUQO" }),
);

// POST /api/v1/tscore/evaluate -> prompts/tscore.md
tScoreEvaluationRouter.post(
  "/evaluate",
  createEvaluationHandler({ promptId: "tscore.prompt", kind: "TSCORE" }),
);

// POST /api/v1/paymaster/evaluate -> prompts/payroll.md
paymasterEvaluationRouter.post(
  "/evaluate",
  createEvaluationHandler({ promptId: "payroll.prompt", kind: "PAYMASTER" }),
);

// ★ Just Culture 実装: インシデント監査ハンドラ
incidentEvaluationRouter.post("/evaluate", async (req: Request, res: Response) => {
  const kind = "INCIDENT_AUDIT";
  const r = req as AuthedRequest;
  try {
    const body = (req.body ?? {}) as AnyEvaluationRequest;
    const normalizedLogs = normalizeLogs(body.logs);
    if (!normalizedLogs.length) {
      return res.status(400).json({ ok: false, error: "No logs to audit" });
    }

    // 1. OpenAIで監査実行
    const { prompt } = buildUserMessage(kind, { ...body, normalizedLogs });
    const rawResult = await callPrompt("incident.prompt", prompt);
    const auditData = rawResult as AuditResult;

    // 2. 執行ロジック (Execution Logic)
    const result = auditData.audit_result;

    // 監査ログ自体の保存（証拠保全）
    // ※ targetUserなどが特定できる場合は metadata に入れると良い
    await dbClient.appendEvent({
      userId: "system_auditor", // システムによる自動記録
      kind: "incident_audit_log",
      text: `【監査完了】判定結果: Level ${result.severity_level}`,
      payload: auditData
    }, r.supabase);

    if (result) {
      // A. 加害者への処置 (Accused Actions)
      if (result.accused && result.accused.user_id) {
        const { user_id, action_type, reason } = result.accused;

        if (action_type === "SHADOW_WATCH") {
          // 保留リスト入り: 本人には通知せず、システム内部でフラグを立てる
          await dbClient.appendEvent({
            userId: user_id,
            kind: "system_flag",
            text: "Shadow Watch List Entry",
            payload: { type: "shadow_watch", reason, expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 } // 2週間監視
          }, r.supabase);
        } else if (action_type === "PENALTY" || action_type === "WARNING") {
          // 減点処分: 確定済みスコア調整イベントとして記録
          // ※これは月末の給与計算やスコア表示時にマイナスとして合算される
          await dbClient.appendEvent({
            userId: user_id,
            kind: "q_score_adjustment", // スコア調整イベント
            text: `【Qスコア減点】規律違反によるペナルティ: Level ${result.severity_level}`,
            payload: {
              delta: result.severity_level === 3 ? -30 : -10,
              reason,
              visibility: "delayed" // 即時表示せず、月末に開示するフラグ
            }
          }, r.supabase);
        }
      }

      // B. 報告者への処置 (Reporter Actions)
      if (result.reporter && result.reporter.credibility_check === "PASS") {
        // コンテキストから報告者のIDが取れると仮定（req.body.metadata.reporterId 等で渡ってくる想定）
        // ここでは簡易的に metadata から取得
        const reporterId = (body.metadata as any)?.reporterId;

        if (reporterId && result.reporter.guardian_bonus > 0) {
          // 貢献ボーナス付与
          await dbClient.appendEvent({
            userId: reporterId,
            kind: "q_score_adjustment",
            text: "【Guardian Bonus】組織の健全性を守る貢献",
            payload: {
              delta: result.reporter.guardian_bonus,
              reason: "Just Culture Protocolによる正当な報告評価",
              badge: "🛡️"
            }
          }, r.supabase);

          // 報告者への通知（NotificationBell等で拾う）
          await dbClient.appendEvent({
            userId: reporterId,
            kind: "notification",
            text: `あなたの報告が受理され、Guardian Bonus (+${result.reporter.guardian_bonus}pt) が付与されました。`,
            payload: { type: "guardian_reward" }
          }, r.supabase);
        }
      }
    }

    return res.status(200).json({ ok: true, result: auditData });

  } catch (err: any) {
    console.error(`[INCIDENT] evaluation error`, err);
    return res.status(500).json({ ok: false, error: err?.message ?? "audit_failed" });
  }
});
