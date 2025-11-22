import OpenAI from "openai";
import { loadPrompt } from "./loadPrompt";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const openai = client;

export type LuqoScoreRaw = {
  LU: number;
  Q: number;
  O: number;
  reasoning: string;
};

export type LuqoScore = LuqoScoreRaw & {
  total: number;
};

export const DEFAULT_LUQO_WEIGHTS = { lu: 0.3, q: 0.5, o: 0.2 };

export function computeLuqoTotal(
  score: { LU: number; Q: number; O: number },
  weights: { lu: number; q: number; o: number } = DEFAULT_LUQO_WEIGHTS,
): number {
  const total = score.LU * weights.lu + score.Q * weights.q + score.O * weights.o;
  return Math.round(total);
}

export async function generateLuqoScore(logs: any[]): Promise<LuqoScore> {
  try {
    const joinedLogs = logs
      .map((row) => {
        if (typeof row?.text === "string" && row.text.trim().length > 0) {
          return row.text.trim();
        }
        if (row?.raw && typeof row.raw.text === "string") {
          return String(row.raw.text).trim();
        }
        return "";
      })
      .filter((text) => text.length > 0)
      .join("\n\n---\n\n");

    if (!joinedLogs) {
      return {
        LU: 0,
        Q: 0,
        O: 0,
        total: 0,
        reasoning: "評価対象となるログ本文がありません。",
      };
    }

    const systemPrompt = await loadPrompt("luqo.prompt");

    const userPrompt = `
以下は、ある職人の1ヶ月分のログ／まとめAです。
この内容だけを根拠に LU / Q / O を採点してください。

【ログ本文ここから】
${joinedLogs}
【ログ本文ここまで】
`;

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = JSON.parse(
      response.choices[0]?.message?.content ?? "{}",
    ) as LuqoScoreRaw;

    const total = computeLuqoTotal(raw);

    return { ...raw, total };
  } catch (err) {
    console.error("[LUQO] generateLuqoScore error:", err);
    return {
      LU: 0,
      Q: 0,
      O: 0,
      total: 0,
      reasoning: "スコアJSONの解析またはAPI呼び出しに失敗しました。",
    };
  }
}
