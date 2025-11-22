import { postPayrollPreview } from "../lib/api";
import type { PayrollPreviewRequest, PayrollWorker } from "../types/payroll";

export type ComputedPayrollRow = PayrollWorker & {
  combo: number;
  tBoost: number;
  tNorm: number;
  evalScore: number;
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
    const evalScore = clamp(worker.luqoScore, 0, 100);
    const combo = 0.7 * tBoost + 0.3 * evalScore;
    const effort = worker.days * combo;

    return {
      ...worker,
      combo,
      tBoost,
      tNorm,
      evalScore,
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
