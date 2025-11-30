import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadPromptById } from "./promptIds"; // ★変更: 型安全なローダーを使用

// 環境変数からキーを読み込み
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is not set");
}
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// ★ここで最新モデルを指定します
const MODEL_NAME = "gemini-3-pro-preview";

export const gemini = genAI;

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

// LUQOスコア生成関数 (Gemini版)
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

        // ★変更点: プロンプトファイルだけで完結させる
        const systemInstruction = await loadPromptById("luqo.prompt");

        let userPrompt = `
以下は、ある職人の1ヶ月分のログ／まとめAです。
この内容だけを根拠に LU / Q / O を採点してください。
`;
        if (focus) userPrompt += `\n【今月の注力テーマ (Focus)】\n${focus}\n`;
        userPrompt += `\n【ログ本文】\n${joinedLogs}\n`;

        // モデル初期化 (JSONモード有効化)
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: systemInstruction,
            generationConfig: {
                responseMimeType: "application/json", // ★これでJSON出力を強制
            },
        });

        // 生成実行
        const result = await model.generateContent(userPrompt);
        const responseText = result.response.text();

        // パース (安全に)
        const raw = safeJsonParse<LuqoScoreRaw>(responseText);

        if (!raw) {
            throw new Error("Failed to parse AI response");
        }

        const total = computeLuqoTotal(raw);

        return { ...raw, total };

    } catch (err) {
        console.error("[LUQO] generateLuqoScore error (Gemini):", err);
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
