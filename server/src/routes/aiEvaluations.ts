import { Router } from "express";
import type { Request, Response } from "express";
import { loadPromptById, type PromptId } from "../lib/promptIds";
import { openai } from "../lib/openaiClient";

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

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.1";

async function callPrompt(promptId: PromptId, userContent: string) {
  const systemMessage = await loadPromptById(promptId);

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`[${promptId}] Empty response from OpenAI`);
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[${promptId}] Failed to parse JSON response`, err);
    return { raw: content };
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

// POST /api/v1/incidents/evaluate -> prompts/incident.md
incidentEvaluationRouter.post(
  "/evaluate",
  createEvaluationHandler({ promptId: "incident.prompt", kind: "INCIDENT" }),
);
