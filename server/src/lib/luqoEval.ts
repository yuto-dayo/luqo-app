import {
  computeBanditLuqoWeights,
  type PersonalHistoryRow,
} from "./banditPersonal";

export type LuqoScores = {
  lu: number;
  q: number;
  o: number;
};

export async function getUserLuqoTotalWithBandit(
  userId: string,
  scores: LuqoScores,
  history: PersonalHistoryRow[],
): Promise<{
  luqoTotal: number;
  weights: { lu: number; q: number; o: number };
}> {
  // TODO: replace with cached/batch-computed weights lookup by userId
  const result = computeBanditLuqoWeights(history);

  const { lu, q, o } = scores;
  const w = result.weights;

  const luqoTotal = lu * w.lu + q * w.q + o * w.o;

  return { luqoTotal, weights: w };
}
