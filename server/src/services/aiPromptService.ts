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

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  return content;
}
