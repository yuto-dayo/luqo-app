// server/src/lib/promptIds.ts
import { loadPrompt } from "./loadPrompt";

export type PromptId =
  | "luqo.prompt"
  | "tscore.prompt"
  | "paymaster.prompt"
  | "payroll.prompt"
  | "incident.prompt"
  | "accounting_audit.prompt"
  | "agent.prompt"
  | "bandit_ceo.prompt"
  | "bandit_mission.prompt"
  | "season_report.prompt"
  | "star_audit.prompt"
  | "okr_audit.prompt"
  | "category_audit.prompt"
  | "news.prompt";

/**
 * promptId を型で縛った安全なラッパー
 */
export async function loadPromptById(id: PromptId): Promise<string> {
  return loadPrompt(id);
}
