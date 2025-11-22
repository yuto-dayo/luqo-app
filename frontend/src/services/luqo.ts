import {
  fetchBanditSuggestion,
  fetchLuqoScore,
  fetchPaymasterCombo,
  fetchPersonalWeights,
  type BanditSuggestResponse,
  type PaymasterComboRequest,
  type PaymasterResponse,
  type PersonalWeightsRequest,
  type PersonalWeightsResponse,
} from "../lib/api";
import type { BanditSuggestion, KpiKey, LuqoScore } from "../types/luqo";

const DEFAULT_SCORE: LuqoScore = { LU: 60, Q: 70, O: 40, total: 170 };

type MonthlyScoreParams = {
  userId: string;
  month: string;
  logText: string;
};

const normalizeBanditSuggestion = (
  response: BanditSuggestResponse,
): BanditSuggestion => {
  const distribution: Record<KpiKey, number> = {
    quality: response.scores?.quality ?? 0,
    growth: response.scores?.growth ?? 0,
    innovation: response.scores?.innovation ?? 0,
  };

  const chosen = response.chosenKpi as KpiKey;
  const base = response.baseKpi as KpiKey;
  const prob = distribution[chosen] ?? 0;

  return {
    baseKpi: base,
    chosenKpi: chosen,
    action: response.suggestion.action,
    prob,
    luqoHint: response.suggestion.luqoHint,
    distribution,
  };
};

export async function updateMonthlyLuqoScore(
  params: MonthlyScoreParams,
): Promise<LuqoScore> {
  const res = await fetchLuqoScore(params);

  if (!res?.ok || !res.score) {
    throw new Error("LUQOスコアの更新に失敗しました");
  }

  const { LU, Q, O, total } = res.score;
  return { LU, Q, O, total };
}

export async function getPersonalWeights(
  params: PersonalWeightsRequest,
): Promise<PersonalWeightsResponse> {
  const res = await fetchPersonalWeights(params);
  if (!res?.ok) {
    throw new Error("個人バンディット重みの取得に失敗しました");
  }
  return res;
}

export async function getBanditSuggestion(params: {
  kpi: KpiKey;
  score?: LuqoScore | null;
  signal?: AbortSignal;
}): Promise<BanditSuggestion> {
  const payload = {
    kpi: params.kpi,
    score: params.score ?? DEFAULT_SCORE,
  };
  const res = await fetchBanditSuggestion(payload, { signal: params.signal });
  if (!res?.ok) {
    throw new Error("Bandit API returned ng");
  }
  return normalizeBanditSuggestion(res);
}

export async function simulatePaymasterCombo(
  body: PaymasterComboRequest,
): Promise<PaymasterResponse> {
  const res = await fetchPaymasterCombo(body);
  if (!res?.ok) {
    throw new Error("Paymaster API returned ng");
  }
  return res;
}
