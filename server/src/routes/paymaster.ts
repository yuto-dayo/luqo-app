import express from "express";
import { computeBanditLuqoWeights } from "../lib/banditPersonal";

const router = express.Router();

router.post("/combo", async (req, res) => {
  try {
    const { userId, lu, q, o, tScore, history = [] } = req.body || {};

    if (typeof lu !== "number" || typeof q !== "number" || typeof o !== "number") {
      return res.status(400).json({ ok: false, error: "Invalid LUQO inputs" });
    }

    const bandit = computeBanditLuqoWeights(history);

    const luqoTotal =
      lu * bandit.weights.lu +
      q * bandit.weights.q +
      o * bandit.weights.o;

    const combo = 0.7 * (tScore ?? 0) + 0.3 * luqoTotal;

    return res.json({
      ok: true,
      userId,
      luqoTotal,
      luqoWeights: bandit.weights,
      combo,
    });
  } catch (err: any) {
    console.error("[Paymaster error]", err);
    res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

export default router;
