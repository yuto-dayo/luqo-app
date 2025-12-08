import type { KpiKey, LuqoScore as BaseLuqoScore } from "../types/luqo";
import type { PayrollPreviewRequest, PayrollWorker } from "../types/payroll";
import type { LogEvent, LogEventRequest, LogEventSource } from "../types/events";
import { apiClient } from "./apiClient";

// AIが生成する動的OKR情報
export type OkrData = {
  objective: string;
  keyResult: string;
  strategy: string;
  iconChar: string;
  themeColor: string;
  endAt?: string;
};

export type LuqoScore = BaseLuqoScore & { reasoning: string };

export type LogItem = {
  id: string;
  ts: number;
  text: string;
};

export type LuqoScoreResponse = {
  ok: boolean;
  score: LuqoScore;
  isFixed?: boolean;
};

export type PersonalWeightsResponse = {
  ok: boolean;
  weights: { lu: number; q: number; o: number };
  probabilities: { lu: number; q: number; o: number };
  values: { lu: number; q: number; o: number };
  correlations: { lu: number; q: number; o: number };
  room: { lu: number; q: number; o: number };
  meta?: { n: number; note?: string };
};

export type BanditSuggestResponse = {
  ok: boolean;
  baseKpi: KpiKey;
  chosenKpi: KpiKey;
  scores?: Record<"quality" | "growth" | "innovation", number>;
  suggestion: { action: string; luqoHint: string; systemPrompt?: string; missionEndAt?: string };
  potential?: { lower: number; upper: number };
  focusDimension?: "LU" | "Q" | "O";
  context?: {
    reason?: string;
    strategyType?: string;
    orgStats?: { LU: number; Q: number; O: number; count?: number };
    okr?: OkrData;
  };
};

export type PaymasterComboRequest = {
  lu: number;
  q: number;
  o: number;
  tScore: number;
  history: ReadonlyArray<LogItem>;
};

export type PersonalWeightsRequest = {
  history: ReadonlyArray<LogItem>;
  temperature?: number;
};

export type PaymasterResponse = {
  ok: boolean;
  userId: string;
  luqoTotal: number;
  luqoWeights: { lu: number; q: number; o: number };
  combo: number;
};

// -------------------------------
// Logs
// -------------------------------
// 例: userId を外から渡す版
export async function postLogEventWithUser(
  text: string,
  userId: string,
): Promise<LogEvent> {
  const body: LogEventRequest = {
    userId,
    text,
    ts: Date.now(),
    source: "daily-log",
  };
  const data = await apiClient.post<{ event: LogEvent }>(
    "/api/v1/logs",
    body,
  );
  return data.event;
}

// -------------------------------
//  LUQO Score
// -------------------------------
export async function fetchLuqoScore(params: {
  month: string;
  focus?: string;
  finalize?: boolean;
  force?: boolean;
}): Promise<LuqoScoreResponse> {
  return apiClient.post<LuqoScoreResponse>(
    "/api/v1/luqo/score-month",
    params,
  );
}

// -------------------------------
//  Personal Bandit Weights
// -------------------------------
export async function fetchPersonalWeights(
  params: PersonalWeightsRequest,
): Promise<PersonalWeightsResponse> {
  return apiClient.post<PersonalWeightsResponse>(
    "/api/v1/bandit/personal-weights",
    params,
  );
}

// -------------------------------
//  Bandit Suggest
// -------------------------------
type BanditScorePayload = BaseLuqoScore | { lu: number; q: number; o: number; total: number; ui?: any };

export async function fetchBanditSuggestion(
  params: { kpi?: KpiKey; score: BanditScorePayload; history?: readonly LogItem[] },
  options?: { signal?: AbortSignal },
): Promise<BanditSuggestResponse> {
  return apiClient.post<BanditSuggestResponse>(
    "/api/v1/bandit/suggest",
    params,
    { signal: options?.signal },
  );
}

// ミッション更新API
export type UpdateMissionRequest = {
  action: string;
  hint: string;
  changeReason: string;
};

export type UpdateMissionResponse = {
  ok: boolean;
  error?: string;
};

export async function updateMission(
  params: UpdateMissionRequest,
): Promise<UpdateMissionResponse> {
  return apiClient.post<UpdateMissionResponse>(
    "/api/v1/bandit/update-mission",
    params,
  );
}

// -------------------------------
//  Paymaster Combo
// -------------------------------
export async function fetchPaymasterCombo(
  body: PaymasterComboRequest,
): Promise<PaymasterResponse> {
  return apiClient.post<PaymasterResponse>(
    "/api/v1/paymaster/combo",
    body,
  );
}

// -------------------------------
// Payroll Preview
// -------------------------------
export async function postPayrollPreview(
  payload: PayrollPreviewRequest,
): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>(
    "/api/v1/payroll/preview",
    payload,
  );
}

// -------------------------------
// T-Score State & Action
// -------------------------------
export type UserStarState = {
  acquired: string[];
  pending: string[];
};

export type TScoreStateResponse = {
  ok: boolean;
  state: UserStarState;
};

export async function fetchTScoreState(
  targetUserId: string,
  options?: { skipCache?: boolean }
): Promise<TScoreStateResponse> {
  // キャッシュをスキップする場合は、タイムスタンプをクエリパラメータに追加
  const url = options?.skipCache 
    ? `/api/v1/tscore/state/${targetUserId}?t=${Date.now()}`
    : `/api/v1/tscore/state/${targetUserId}`;
  
  return apiClient.get<TScoreStateResponse>(url);
}

export async function postTScoreAction(
  action: "apply" | "approve" | "reject",
  starId: string,
  targetUserId: string,
  evidence?: string,
): Promise<TScoreStateResponse> {
  return apiClient.post<TScoreStateResponse>("/api/v1/tscore/action", {
    action,
    starId,
    targetUserId,
    evidence: evidence || undefined,
  });
}

// -------------------------------
// OKR Proposal
// -------------------------------
export type OkrProposalRequest = {
  okr: {
    objective: string;
    keyResult: string;
    strategy: string;
    iconChar?: string;
    themeColor?: string;
    targetDimension?: "LU" | "Q" | "O";
    aiMessage?: string;
  };
  reason: string;
};

export type OkrProposalResponse = {
  ok: boolean;
  proposal?: any;
  aiReview?: any;
  error?: string;
};

export async function proposeOkrChange(
  params: OkrProposalRequest,
): Promise<OkrProposalResponse> {
  return apiClient.post<OkrProposalResponse>("/api/v1/master/okr/propose", {
    okr: params.okr,
    reason: params.reason,
  });
}

// OKR提案一覧取得
export type OkrProposal = {
  id: string;
  proposer_id: string;
  change_type: string;
  new_definition: {
    objective: string;
    keyResult: string;
    strategy: string;
    iconChar?: string;
    themeColor?: string;
    targetDimension?: "LU" | "Q" | "O";
    aiMessage?: string;
  };
  reason: string;
  ai_review_comment: string;
  ai_approval: boolean | null;
  status: string;
  created_at: string;
  votes_approvers: string[];
  votes_rejecters: string[];
  votes_total: number;
};

export type OkrProposalsResponse = {
  ok: boolean;
  proposals: OkrProposal[];
};

export async function fetchOkrProposals(): Promise<OkrProposalsResponse> {
  const res = await apiClient.get<{ ok: boolean; proposals: any[] }>("/api/v1/master/stars/proposals");
  // OKR提案のみをフィルタリング
  const okrProposals = (res.proposals || []).filter((p: any) => p.change_type === "OKR");
  return {
    ok: res.ok,
    proposals: okrProposals,
  };
}

// OKR提案への投票
export type OkrVoteRequest = {
  proposalId: string;
  vote: "approve" | "reject";
};

export type OkrVoteResponse = {
  ok: boolean;
  votes: {
    approvals: number;
    rejections: number;
    total: number;
  };
  autoApplied: boolean;
};

export async function voteOkrProposal(
  params: OkrVoteRequest,
): Promise<OkrVoteResponse> {
  return apiClient.post<OkrVoteResponse>("/api/v1/master/stars/vote", {
    proposalId: params.proposalId,
    vote: params.vote,
  });
}

// -------------------------------
//  Logs Service (Merged)
// -------------------------------

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_SOURCE: LogEventSource = "daily-log";

export type CreateLogEventInput = {
  text: string;
  userId?: string;
  source?: LogEventSource;
  ts?: number;
};

export function createLogEventRequest(
  input: CreateLogEventInput,
): LogEventRequest {
  const ts = typeof input.ts === "number" ? input.ts : Date.now();

  return {
    userId: input.userId ?? DEFAULT_USER_ID,
    text: input.text.trim(),
    source: input.source ?? DEFAULT_SOURCE,
    ts,
  };
}

export async function postLog(body: LogEventRequest): Promise<LogEvent> {
  const data = await apiClient.post<{ event: LogEvent }>(
    "/api/v1/logs",
    body,
  );
  return data.event;
}

// 過去ログ取得
export type LogHistoryItem = {
  id: string;
  text: string;
  createdAt: string;
  month: string;
};

export type LogHistoryResponse = {
  ok: boolean;
  logs: LogHistoryItem[];
  month: string;
};

export async function fetchLogHistory(month?: string): Promise<LogHistoryResponse> {
  const params = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiClient.get<LogHistoryResponse>(`/api/v1/logs/history${params}`);
}

// 全員のログを期間で取得（ニュース表示用）
export type AllLogsHistoryItem = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  month: string;
};

export type AllLogsHistoryResponse = {
  ok: boolean;
  logs: AllLogsHistoryItem[];
  startDate: string;
  endDate: string;
  days: number;
};

export async function fetchAllLogsHistory(days: number = 7): Promise<AllLogsHistoryResponse> {
  const params = `?days=${days}`;
  return apiClient.get<AllLogsHistoryResponse>(`/api/v1/logs/history/all${params}`);
}

// AIニュース生成API（プロンプトベース）
export type NewsResponse = {
  ok: boolean;
  newsItems: string[];
};

export async function fetchNews(days: number = 7): Promise<NewsResponse> {
  const params = `?days=${days}`;
  return apiClient.get<NewsResponse>(`/api/v1/logs/news${params}`);
}

// 期間指定で全ユーザーログを要約生成するAPI
export type LogSummaryStatistics = {
  totalLogs: number;
  uniqueUsers: number;
  topUsers: Array<{ userId: string; userName?: string; count: number }>;
  mostActiveDay: { date: string; count: number } | null;
  dailyCounts: Array<{ date: string; count: number }>;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
};

export type LogSummaryResponse = {
  ok: boolean;
  summary: {
    overview: string;
    insights: string[];
    highlights: string[];
    statistics: LogSummaryStatistics;
  };
};

export async function fetchLogSummary(
  startDate: string,
  endDate: string
): Promise<LogSummaryResponse> {
  const params = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  return apiClient.get<LogSummaryResponse>(`/api/v1/logs/summary${params}`);
}

// -------------------------------
//  Evaluations Service (Merged)
// -------------------------------
export type EvaluationPayload = {
  logs: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
};

async function postEvaluation<T>(path: string, payload: EvaluationPayload) {
  if (!Array.isArray(payload.logs) || payload.logs.length === 0) {
    throw new Error("logs must be a non-empty string array");
  }

  return apiClient.post<T>(path, payload);
}

export function evaluateLuqo(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/luqo/evaluate",
    payload,
  );
}

export function evaluateTScore(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/tscore/evaluate",
    payload,
  );
}

export function evaluatePaymaster(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/paymaster/evaluate",
    payload,
  );
}

export function evaluateIncident(payload: EvaluationPayload) {
  return postEvaluation<{ ok: boolean; result: unknown }>(
    "/api/v1/incidents/evaluate",
    payload,
  );
}

// -------------------------------
//  Payroll Service (Merged)
// -------------------------------

export type ComputedPayrollRow = PayrollWorker & {
  combo: number;
  tBoost: number;
  tNorm: number;

  ratio: number;
  amount: number;
};

const MAX_STARS = 170;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const computePayrollDistribution = ({
  profit,
  companyRate,
  p,
  workers,
}: PayrollPreviewRequest): { rows: ComputedPayrollRow[]; distributable: number } => {
  const safeWorkers = workers.length ? workers : [];
  const distributableAmount = profit * (1 - companyRate);

  const enriched = safeWorkers.map<ComputedPayrollRow>((worker) => {
    const stars = clamp(worker.starsTotal, 0, MAX_STARS);
    const tNorm = MAX_STARS ? stars / MAX_STARS : 0;
    const exponent = Math.max(p, 0.1);
    const tBoost = Math.pow(tNorm, exponent) * 100;
    const combo = tBoost;
    const effort = worker.days * combo;

    return {
      ...worker,
      combo,
      tBoost,
      tNorm,

      ratio: 0,
      amount: effort,
    };
  });

  const totalEffort = enriched.reduce((sum, worker) => sum + worker.amount, 0);

  const rowsWithRatios = enriched.map((worker) => {
    const ratio =
      totalEffort > 0 ? worker.amount / totalEffort : 1 / (enriched.length || 1);
    const amount = Math.round(distributableAmount * ratio);
    return {
      ...worker,
      ratio,
      amount,
    };
  });

  return {
    rows: rowsWithRatios,
    distributable: distributableAmount,
  };
};

export const previewPayroll = async (
  payload: PayrollPreviewRequest,
): Promise<void> => {
  try {
    await postPayrollPreview(payload);
  } catch (error) {
    console.warn("[payroll] preview request failed – falling back to local simulation", error);
  }
};

// -------------------------------
// User Profiles
// -------------------------------
export type UserProfilesResponse = {
  ok: boolean;
  profiles: Record<string, string>; // userId -> name のマップ
};

/**
 * 複数のユーザーIDからユーザー名を取得
 * @param userIds ユーザーIDの配列
 * @returns userIdをキーとした名前のマップ（名前がない場合はuserIdをそのまま返す）
 */
export async function fetchUserProfiles(
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  
  try {
    const res = await apiClient.post<UserProfilesResponse>(
      "/api/v1/user/profiles",
      { userIds },
    );
    return res.ok ? res.profiles : {};
  } catch (error) {
    console.error("Failed to fetch user profiles:", error);
    // エラー時はuserIdをそのまま返す
    const fallback: Record<string, string> = {};
    userIds.forEach((id) => {
      fallback[id] = id;
    });
    return fallback;
  }
}
