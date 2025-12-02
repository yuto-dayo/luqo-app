import OpenAI from "openai";
import { loadPromptById } from "./promptIds";

// 環境変数からキーを読み込み
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// GPT-5.1モデル名（https://platform.openai.com/docs/models/gpt-5.1）
const MODEL_NAME = "gpt-5.1";

export { openai };

export type LuqoScoreRaw = {
    LU: number;
    Q: number;
    O: number;
    reasoning: string;
    // ★ UI用フィールドを追加
    ui: {
        headline: string;
        greeting: string;
        color: string;
        icon: string;
        // ★ここを拡張: M3Eパラメータ
        theme: {
            color: string;           // ベースカラー (Seed Color)
            shape: "rounded" | "cut" | "sharp"; // 形状ファミリー
            radiusLevel: number;     // 0(四角) ~ 100(完全な丸)
            vibe: "calm" | "energetic" | "professional"; // アニメーション用
        };
    };
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

/**
 * Helper to safely parse JSON from AI response, handling Markdown code blocks.
 */
export function safeJsonParse<T>(text: string): T | null {
    try {
        // 1. Strip markdown code blocks if present
        let cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
        // 2. Parse
        return JSON.parse(cleanText) as T;
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return null;
    }
}

// LUQOスコア生成関数 (OpenAI版)
export async function generateLuqoScore(logs: any[], focus?: string): Promise<LuqoScore> {
    try {
        const joinedLogs = logs
            .map((row) => {
                if (typeof row?.text === "string" && row.text.trim().length > 0) return row.text.trim();
                if (row?.raw && typeof row.raw.text === "string") return String(row.raw.text).trim();
                return "";
            })
            .filter((text) => text.length > 0)
            .join("\n\n---\n\n");

        if (!joinedLogs) {
            return {
                LU: 0, Q: 0, O: 0, total: 0,
                reasoning: "評価対象となるログ本文がありません。",
                ui: {
                    headline: "データ待ち",
                    greeting: "ログを入力してスコアを算出しましょう",
                    color: "#64748b",
                    icon: "document",
                    theme: {
                        color: "#64748b",
                        shape: "rounded",
                        radiusLevel: 16,
                        vibe: "calm"
                    }
                }
            };
        }

        // プロンプトファイルから読み込み
        const systemInstruction = await loadPromptById("luqo.prompt");

        let userPrompt = `
以下は、ある職人の1ヶ月分のログ／まとめAです。
この内容だけを根拠に LU / Q / O を採点してください。
`;
        if (focus) userPrompt += `\n【今月の注力テーマ (Focus)】\n${focus}\n`;
        userPrompt += `\n【ログ本文】\n${joinedLogs}\n`;

        // OpenAI API呼び出し (JSONモード)
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error("Empty response from OpenAI");
        }

        // パース (安全に)
        const raw = safeJsonParse<LuqoScoreRaw>(responseText);

        if (!raw) {
            throw new Error("Failed to parse AI response");
        }

        const total = computeLuqoTotal(raw);

        return { ...raw, total };

    } catch (err) {
        console.error("[LUQO] generateLuqoScore error (OpenAI):", err);
        return {
            LU: 0, Q: 0, O: 0, total: 0,
            reasoning: "AI処理中にエラーが発生しました。",
            ui: {
                headline: "エラー発生",
                greeting: "スコアの算出に失敗しました",
                color: "#ef4444",
                icon: "alert",
                theme: {
                    color: "#ef4444",
                    shape: "sharp",
                    radiusLevel: 4,
                    vibe: "professional"
                }
            }
        };
    }
}
