export type PersonalHistoryRow = {
  lu: number; // 0-100
  q: number; // 0-100
  o: number; // 0-100
  reward: number; // KPI由来の報酬・利益など（利益・売上・納得度など）
};

export type BanditWeightResult = {
  weights: { lu: number; q: number; o: number }; // そのまま LUQO 重みに使う
  probabilities: { lu: number; q: number; o: number }; // = weights と同じだが「確率」として解釈
  values: { lu: number; q: number; o: number }; // corr × room の生値
  correlations: { lu: number; q: number; o: number }; // 各軸と reward の相関（0〜1）
  room: { lu: number; q: number; o: number }; // 伸びしろ（0〜1）
};

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, v) => s + (v - m) * (v - m), 0) / (xs.length - 1);
}

function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let sx2 = 0;
  let sy2 = 0;

  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    sx2 += dx * dx;
    sy2 += dy * dy;
  }

  const den = Math.sqrt(sx2 * sy2);
  if (!den || !isFinite(den)) return 0;

  return num / den;
}

function clamp01(v: number): number {
  if (!isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function softmax(xs: number[], temperature = 1): number[] {
  if (!xs.length) return [];
  if (temperature <= 0) temperature = 1;

  const max = Math.max(...xs);
  const exps = xs.map((v) => Math.exp((v - max) / temperature));
  const sum = exps.reduce((s, v) => s + v, 0) || 1;
  return exps.map((e) => e / sum);
}

export function computeBanditLuqoWeights(
  history: PersonalHistoryRow[],
  temperature = 0.5,
): BanditWeightResult {
  // データが少なすぎる時は均等割り
  if (!Array.isArray(history) || history.length < 3) {
    const w = { lu: 1 / 3, q: 1 / 3, o: 1 / 3 };
    return {
      weights: w,
      probabilities: w,
      values: { lu: 0, q: 0, o: 0 },
      correlations: { lu: 0, q: 0, o: 0 },
      room: { lu: 0, q: 0, o: 0 },
    };
  }

  // 0〜1 に正規化
  const xsLU = history.map((h) => clamp01(h.lu / 100));
  const xsQ = history.map((h) => clamp01(h.q / 100));
  const xsO = history.map((h) => clamp01(h.o / 100));

  // reward はスケールだけ整える（0 〜 1 にざっくり）
  const rewards = history.map((h) => h.reward);
  const maxReward = Math.max(...rewards.map((r) => Math.abs(r)), 1);
  const ys = rewards.map((r) => r / maxReward);

  // 相関（負の相関は 0 扱い）
  const corrLU = clamp01(Math.max(0, pearson(xsLU, ys)));
  const corrQ = clamp01(Math.max(0, pearson(xsQ, ys)));
  const corrO = clamp01(Math.max(0, pearson(xsO, ys)));

  // 伸びしろ：平均スコアが低いほど room が大きい
  const roomLU = clamp01(1 - mean(xsLU)); // LU がまだ低いほど伸びしろ大
  const roomQ = clamp01(1 - mean(xsQ));
  const roomO = clamp01(1 - mean(xsO));

  // “育て得度合い” = 相関 × 伸びしろ
  const vLU = corrLU * roomLU;
  const vQ = corrQ * roomQ;
  const vO = corrO * roomO;

  const valuesArr = [vLU, vQ, vO];

  // 全部 0 のときは均等割り
  if (valuesArr.every((v) => v <= 0)) {
    const w = { lu: 1 / 3, q: 1 / 3, o: 1 / 3 };
    return {
      weights: w,
      probabilities: w,
      values: { lu: vLU, q: vQ, o: vO },
      correlations: { lu: corrLU, q: corrQ, o: corrO },
      room: { lu: roomLU, q: roomQ, o: roomO },
    };
  }

  const probsArr = softmax(valuesArr, temperature);
  const [pLU, pQ, pO] = probsArr;
  const weights = { lu: pLU, q: pQ, o: pO };

  return {
    weights, // = probabilities
    probabilities: weights,
    values: { lu: vLU, q: vQ, o: vO },
    correlations: { lu: corrLU, q: corrQ, o: corrO },
    room: { lu: roomLU, q: roomQ, o: roomO },
  };
}
