// server/src/lib/promptIds.ts
import { loadPrompt } from "./loadPrompt";

export type PromptId =
  | "luqo.prompt"
  | "tscore.prompt"
  | "paymaster.prompt"
  | "payroll.prompt"
  | "incident.prompt";

/**
 * promptId を型で縛った安全なラッパー
 */
export async function loadPromptById(id: PromptId): Promise<string> {
  return loadPrompt(id);
}
