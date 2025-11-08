import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type LuqoScore = {
  LU: number;
  Q: number;
  O: number;
  total: number;
  reasoning: string;
};

const LUQO_SYSTEM_PROMPT = `
あなたは「LUQO スコア評価官 GPT」です。

目的:
職人の日次ログ／まとめAを読み取り、
以下4つの数値と説明だけを JSON 形式で返すことです。

- LU (Learning & Growth / 学習・成長) : 0〜100
- Q  (Contribution & Behavior / 貢献・行動・心理的安全性) : 0〜100
- O  (Ownership & Innovation / 主体性・革新) : 0〜100
- total (LUQO合成スコア) : 0〜100

評価の哲学（要約）:
- 心理的安全性 > 公平性 > 一貫性 > 簡潔性 を最優先とする。
- ログに書かれていないことを推測しない。
- 主語があいまいな行動は評価対象外とする。
- 記述が抽象的な場合は 60点未満に抑える。
- 80点以上は「チームや複数現場に波及する影響」がある時のみ。

心理的安全性インシデント（怒鳴る・威圧・無視・情報共有拒否など）が
明確に記録されている場合は Q から減点する。

スコア計算ルール（簡略版）:
1. LU, Q, O をそれぞれ 0〜100で採点する。
2. LU:Q:O = 30:50:20 の重みで total を計算する:
   total = round(LU * 0.30 + Q * 0.50 + O * 0.20)

出力フォーマット:
日本語での説明を含むが、返すメッセージ全体は
次の JSON オブジェクト1つだけにすること:

{
  "LU": number,
  "Q": number,
  "O": number,
  "total": number,
  "reasoning": string
}

※ reasoning には、なぜその点数になったかを、
  具体的な行動やログの傾向に触れながら簡潔に書くこと。
`;

export async function generateLuqoScore(logs: any[]): Promise<LuqoScore> {
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

  const userPrompt = `
以下は、ある職人の1ヶ月分のログ／まとめAです。
この内容だけを根拠に LU / Q / O / total を採点してください。

【ログ本文ここから】
${joinedLogs}
【ログ本文ここまで】
`;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LUQO_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const score: LuqoScore = {
      LU: Number(parsed.LU) || 0,
      Q: Number(parsed.Q) || 0,
      O: Number(parsed.O) || 0,
      total: Number(parsed.total) || 0,
      reasoning:
        typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : "reasoning が空だったため、デフォルトメッセージです。",
    };

    return score;
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
