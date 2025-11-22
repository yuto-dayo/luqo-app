import express from "express";

const payrollRouter = express.Router();

const MAX_STARS = 170;

type WorkerInput = {
  name: string;
  days: number;
  starsTotal: number;
  luqoScore: number;
};

type WorkerResult = WorkerInput & {
  tNorm: number;
  tBoost: number;
  evalScore: number;
  combo: number;
  effort: number;
  ratio: number;
  amount: number;
};

type PayrollRequestBody = {
  profit: number;
  companyRate?: number;
  minPayment?: number;
  maxPayment?: number | null;
  p?: number;
  workers: WorkerInput[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

payrollRouter.post("/preview", (req, res) => {
  try {
    const {
      profit,
      companyRate = 0.3,
      minPayment = undefined,
      maxPayment = null,
      p = 1,
      workers,
    } = req.body as PayrollRequestBody;

    const profitValue = Number(profit);

    if (!Number.isFinite(profitValue)) {
      return res.status(400).json({ ok: false, error: "profit must be a number" });
    }

    if (!Array.isArray(workers) || workers.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "workers must be a non-empty array" });
    }

    const rateInput = Number(companyRate);
    const rate = Number.isFinite(rateInput) ? clamp(rateInput, 0, 1) : 0.3;

    const exponentInput = Number(p);
    const exponent = Number.isFinite(exponentInput) && exponentInput > 0 ? exponentInput : 1;

    const minPaymentValue =
      typeof minPayment === "number" && Number.isFinite(minPayment) ? minPayment : null;
    const maxPaymentValue =
      maxPayment === null
        ? null
        : typeof maxPayment === "number" && Number.isFinite(maxPayment)
          ? maxPayment
          : null;

    const distributable = profitValue * (1 - rate);

    const workerSummaries = workers.map<WorkerResult>((w, index) => {
      const name =
        typeof w.name === "string" && w.name.trim().length > 0
          ? w.name.trim()
          : `worker-${index + 1}`;
      const days = Number.isFinite(w.days) ? Math.max(0, w.days) : 0;
      const starsRaw = Number.isFinite(w.starsTotal) ? w.starsTotal : 0;
      const stars = clamp(starsRaw, 0, MAX_STARS);
      const tNorm = MAX_STARS ? stars / MAX_STARS : 0;
      const tBoost = Math.pow(tNorm, exponent) * 100;
      const luqoRaw = Number.isFinite(w.luqoScore) ? w.luqoScore : 0;
      const evalScore = clamp(luqoRaw, 0, 100);
      const combo = 0.7 * tBoost + 0.3 * evalScore;
      const effort = days * combo;

      return {
        name,
        days,
        starsTotal: stars,
        luqoScore: luqoRaw,
        tNorm,
        tBoost,
        evalScore,
        combo,
        effort,
        ratio: 0,
        amount: 0,
      };
    });

    const totalEffort = workerSummaries.reduce((sum, w) => sum + w.effort, 0);

    const items = workerSummaries.map((w) => {
      const effort = w.effort;
      const ratio =
        totalEffort > 0
          ? effort / totalEffort
          : workerSummaries.length > 0
            ? 1 / workerSummaries.length
            : 0;
      const amount = Math.round(distributable * ratio);

      return {
        ...w,
        ratio,
        amount,
      };
    });

    const totalRounded = items.reduce((sum, w) => sum + w.amount, 0);
    const diff = Math.round(distributable - totalRounded);
    if (items.length > 0 && diff !== 0) {
      let targetIndex = 0;
      for (let i = 1; i < items.length; i += 1) {
        if (items[i].combo > items[targetIndex].combo) {
          targetIndex = i;
        }
      }
      items[targetIndex].amount += diff;
    }

    const responseItems = items.map((w) => ({
      name: w.name,
      days: w.days,
      starsTotal: w.starsTotal,
      luqoScore: w.luqoScore,
      tNorm: w.tNorm,
      tBoost: w.tBoost,
      evalScore: w.evalScore,
      combo: w.combo,
      ratio: w.ratio,
      amount: w.amount,
    }));

    // TODO: Enforce minPayment / maxPayment when business rules are finalized.
    res.json({
      ok: true,
      summary: {
        profit: profitValue,
        distributable,
        companyRate: rate,
        p: exponent,
        minPayment: minPaymentValue,
        maxPayment: maxPaymentValue,
      },
      items: responseItems,
    });
  } catch (err: any) {
    console.error("[Payroll preview error]", err);
    res
      .status(500)
      .json({ ok: false, error: err?.message ?? "unknown payroll error" });
  }
});

export default payrollRouter;
