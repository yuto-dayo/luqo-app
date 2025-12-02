import { Router, Response } from "express";
import type { AuthedRequest } from "../types/authed-request";
import { loadPromptById } from "../lib/promptIds";
import { openai } from "../lib/openaiClient";
import { dbClient } from "../lib/dbClient";
import { supabaseAdmin } from "../services/supabaseClient";

const router = Router();

// 基本プロンプト（前回と同じ）
// 基本プロンプトは外部ファイルから読み込むため削除

router.post("/chat", async (req, res: Response) => {
    const r = req as AuthedRequest;
    const userId = r.userId || "demo-user";
    let { message, history } = req.body ?? {};

    // 入力バリデーションと簡易DoS対策
    if (!message || typeof message !== "string") {
        return res.status(400).json({ ok: false, error: "Invalid message" });
    }
    if (message.length > 2000) {
        return res.status(400).json({ ok: false, error: "Message too long" });
    }
    message = message.trim();

    try {
        // --- 1. Reflection Logic (ゲーム理論ベースの頻度制御) ---
        let reflectionContext = "";

        // ユーザーの入力文字数チェック (エンゲージメント判定)
        if (message && message.length >= 20) {
            // クールダウンチェック: 過去3日以内に振り返りログがあるか？
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

            const { data: recentReflections } = await supabaseAdmin
                .from("events")
                .select("id")
                .eq("user_id", userId)
                .eq("kind", "reflection_log") // 振り返り記録
                .gte("created_at", threeDaysAgo)
                .limit(1);

            const isCoolingDown = recentReflections && recentReflections.length > 0;

            if (!isCoolingDown) {
                // ネタ探し: 直近2週間のBandit提案を取得
                const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
                const { data: suggestions } = await supabaseAdmin
                    .from("events")
                    .select("payload")
                    .eq("user_id", userId)
                    .eq("kind", "bandit_suggestion_log")
                    .gte("created_at", twoWeeksAgo)
                    .order("created_at", { ascending: false })
                    .limit(1);

                if (suggestions && suggestions.length > 0) {
                    const lastSuggestion = suggestions[0].payload;
                    // 注入するコンテキスト
                    reflectionContext = `
【システム指示: 振り返りチャンス到来】
以下の条件が揃ったため、今回の会話の中で**自然に**以下の過去ミッションについての振り返りを行ってください。
・ターゲット: ${lastSuggestion.targetDimension} (${lastSuggestion.armId})
・聞き方例: 「ログ保存しました！ そういえば、最近は『${lastSuggestion.targetDimension}』を意識されてましたよね。今日の手応えはどうでした？」
・ユーザーが回答したら、必ず \`record_reflection\` ツールで記録してください。
`;
                }
            }
        }

        // --- 2. ツール定義 (OpenAI形式) ---
        const tools = [
            {
                type: "function" as const,
                function: {
                    name: "save_log",
                    description: "会話の内容が十分に深掘りされ、記録すべき情報（事実・感情・工夫）が揃った段階で呼び出す。",
                    parameters: {
                        type: "object",
                        properties: {
                            text: { 
                                type: "string", 
                                description: "要約されたログ本文（ユーザーの感情や工夫も含めること）" 
                            },
                            tags: {
                                type: "array",
                                items: { type: "string" },
                                description: "タグ（例: #PsychSafetyReport, #Innovation, #Trouble）"
                            }
                        },
                        required: ["text"],
                    },
                },
            },
            {
                type: "function" as const,
                function: {
                    name: "fetch_logs",
                    description: "過去のログを参照する。以下の場合に呼び出す：1) ユーザーが過去のログを見たがっている場合、2) ユーザーが過去の作業や経験について言及している場合、3) 過去のログを参照することでより適切な質問やアドバイスができると判断した場合。月を指定しない場合は現在の月を参照する。",
                    parameters: {
                        type: "object",
                        properties: {
                            month: { 
                                type: "string", 
                                description: "YYYY-MM形式の月。指定しない場合は現在の月を参照する。" 
                            },
                        },
                        required: [],
                    },
                },
            },
            {
                type: "function" as const,
                function: {
                    name: "record_reflection",
                    description: "過去のミッションに対するユーザーの振り返り（手応え）を記録し、AIを学習させる。",
                    parameters: {
                        type: "object",
                        properties: {
                            targetDimension: { 
                                type: "string", 
                                description: "対象のKPI (LU/Q/O)" 
                            },
                            sentiment: { 
                                type: "string", 
                                description: "POSITIVE | NEUTRAL | NEGATIVE" 
                            },
                            feedbackText: { 
                                type: "string", 
                                description: "ユーザーの具体的な発言内容" 
                            }
                        },
                        required: ["targetDimension", "sentiment", "feedbackText"],
                    },
                },
            },
        ];

        // 履歴の整形 (OpenAI形式)
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
        
        // システムプロンプト
        const basePrompt = await loadPromptById("agent.prompt");
        const promptWithTime = basePrompt.replace("{{CURRENT_TIME}}", new Date().toLocaleString("ja-JP"));
        const finalSystemPrompt = promptWithTime + reflectionContext;
        messages.push({ role: "system", content: finalSystemPrompt });

        // チャット履歴
        if (Array.isArray(history)) {
            history.forEach((h: any) => {
                messages.push({
                    role: h.role === "assistant" ? "assistant" : "user",
                    content: h.text
                });
            });
        }

        // 現在のメッセージ
        messages.push({ role: "user", content: message });

        // OpenAI API呼び出し
        const completion = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: messages as any,
            tools: tools,
            tool_choice: "auto",
            temperature: 0.7,
        });

        const responseMessage = completion.choices[0]?.message;
        if (!responseMessage) {
            return res.status(500).json({ ok: false, error: "No response from AI" });
        }

        // ツール呼び出しの処理
        const toolCalls = responseMessage.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            const call = toolCalls[0];
            // OpenAI SDKの型定義に合わせてアクセス
            // tool_callsはChatCompletionMessageToolCall型で、functionプロパティを持つ
            const functionCall = (call as any).function || call;
            const args = JSON.parse(functionCall.arguments || "{}") as any;

            if (functionCall.name === "save_log") {
                const tags = args.tags || [];
                let replyText = "ログを記録しました✅ お疲れ様です！";

                // Guardian報告時のフィードバック
                if (tags.includes("#PsychSafetyReport")) {
                    replyText = "報告ありがとうございます。この件は「保留箱」に厳重に保管し、公正に調査します。あなたの勇気ある行動は、チームを守るために使われます🛡️";
                }
                // 通常ログでも、AIが要約してくれた内容をユーザーにフィードバックすると親切
                else {
                    replyText = `記録しました！\n📝「${args.text}」\n\n他にも気付いたことや、アピールしたい工夫はありますか？`;
                }

                await dbClient.appendEvent({ userId, text: args.text, kind: "log", raw: { tags } }, r.supabase);
                return res.json({ ok: true, reply: replyText });
            }

            if (functionCall.name === "fetch_logs") {
                // 月が指定されていない場合は現在の月を使用
                const now = new Date();
                const targetMonth = args.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                const logs = await dbClient.getEventsByUserMonth(userId, targetMonth, r.supabase);
                const summary = (logs || []).map((l: any) => `・${l.createdAt.slice(5, 10)}: ${l.text}`).join("\n");
                return res.json({ ok: true, reply: summary || "その月のログはありませんでした。" });
            }

            if (functionCall.name === "record_reflection") {
                // 1. イベントとして保存 (クールダウン判定に使用)
                await dbClient.appendEvent({
                    userId,
                    kind: "reflection_log",
                    text: `振り返り: ${args.targetDimension} -> ${args.sentiment}`,
                    createdAt: new Date().toISOString(),
                    payload: args
                }, r.supabase);

                // 2. ★即時学習 (Bandit Update)
                // POSITIVEなら報酬1.0, NEUTRAL 0.5, NEGATIVE 0.0 のような簡易学習
                // 本格的な学習はここでは「フィードバックイベント」を保存するだけに留め、
                // 非同期ジョブや確定処理でまとめて計算するのが安全ですが、
                // ここでは即時性重視で「ありがとう！」と返すだけにします。

                const replyText = args.sentiment === "POSITIVE"
                    ? "素晴らしいですね！その感覚、AIにもしっかり覚えさせておきます🧠✨"
                    : "なるほど、貴重なフィードバックありがとうございます。次の提案に活かします！";

                return res.json({ ok: true, reply: replyText });
            }
        }

        // 通常のテキスト応答
        const replyText = responseMessage.content || "すみません、応答を生成できませんでした。";
        return res.json({ ok: true, reply: replyText });

    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ ok: false, error: "AI Error" });
    }
});

export default router;
