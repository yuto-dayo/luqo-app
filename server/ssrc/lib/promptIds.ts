// server/src/lib/promptIds.ts
import { loadPrompt } from "./loadPrompt";

export type PromptId =
  | "luqo.prompt"
  | "tscore.prompt"
  | "paymaster.prompt"
  | "payroll.prompt"
  | "incident.prompt"
  | "sales_audit.prompt"
  | "expense_audit.prompt"
  | "agent.prompt"
  | "bandit_ceo.prompt"
  | "bandit_mission.prompt"
  | "season_report.prompt"
  | "incident_v2.prompt"
  | "luqo_v2.prompt"
  | "tscore_v2.prompt"
  | "payroll_v2.prompt"
  | "star_audit.prompt"
  | "news.prompt";

/**
 * promptId を型で縛った安全なラッパー
 */
export async function loadPromptById(id: PromptId): Promise<string> {
  return loadPrompt(id);
}
