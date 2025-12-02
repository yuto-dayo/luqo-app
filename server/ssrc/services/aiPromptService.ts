import { openai } from "../lib/openaiClient";
import { loadPromptById, type PromptId } from "../lib/promptIds";

/**
 * 任意の .md プロンプトを system にして GPT を叩く共通関数
 */
export async function runPrompt(
  id: PromptId,
  userContent: string,
): Promise<string> {
  const systemPrompt = await loadPromptById(id);

  // OpenAI API呼び出し
  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content;

  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}
