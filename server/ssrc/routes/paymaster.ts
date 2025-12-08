import express from "express";
import { calculateGooglePayroll } from "../lib/payrollCalculator";
import { STAR_CATALOG } from "../data/starCatalog";
import { supabaseAdmin } from "../services/supabaseClient";

const router = express.Router();

router.get("/team-stats", async (req, res) => {
  try {
    const [profilesRes, starStatesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, name"),
      supabaseAdmin.from("star_states").select("user_id, state"),
    ]);

    const profiles = profilesRes.data || [];
    const starStates = starStatesRes.data || [];

    const scoreMap = new Map<string, number>();
    starStates.forEach((row: any) => {
      const acquired = new Set(row.state.acquired || []);
      const totalPoints = STAR_CATALOG.filter((item) => acquired.has(item.id)).reduce(
        (sum, item) => sum + item.points,
        0,
      );
      scoreMap.set(row.user_id, totalPoints);
    });

    // ユーザーID、名前、スコアを含むオブジェクト配列を作成
    const members = profiles.map((profile: any) => ({
      userId: profile.id,
      name: profile.name || "Unknown",
      score: scoreMap.get(profile.id) || 0,
    }));

    // スコアで降順ソート
    members.sort((a, b) => b.score - a.score);

    // 統計データを作成
    const teamSize = members.length;
    const totalScore = members.reduce((sum, m) => sum + m.score, 0);
    const averageTScore = teamSize > 0 ? Math.round(totalScore / teamSize) : 0;

    // 後方互換性のため、scores配列も残す
    const scores = members.map((m) => m.score);

    res.json({
      ok: true,
      stats: {
        teamSize,
        averageTScore,
        scores, // 後方互換性のため
        members, // 名前付きメンバーリスト（新規）
      }
    });

  } catch (err: any) {
    console.error("[Team Stats Error]", err);
    res.status(500).json({ ok: false, error: "Failed to fetch team stats" });
  }
});

router.post("/preview", async (req, res) => {
  try {
    const { tScore, peerCount, days, profit, totalWorkers, p } = req.body;

    // Validate inputs
    if (
      typeof tScore !== "number" ||
      typeof peerCount !== "number" ||
      typeof days !== "number" ||
      typeof profit !== "number" ||
      typeof totalWorkers !== "number" ||
      typeof p !== "number"
    ) {
      return res.status(400).json({ ok: false, error: "Invalid inputs" });
    }

    // 共通関数に合わせるため、workers配列を擬似的に作成
    const me = { userId: "me", name: "Me", days, starsTotal: tScore, peerCount };
    const rivals = [];
    for (let i = 0; i < totalWorkers - 1; i++) {
      // 元のロジックでは rivalStars を 85 として扱っていた
      rivals.push({ userId: `rival_${i}`, name: "Rival", days, starsTotal: 85, peerCount: 0 });
    }

    const workers = [me, ...rivals];

    const result = calculateGooglePayroll(
      profit,
      0.0, // companyRate (シミュレーターでは 0 想定)
      p,
      500, // peerUnit (固定500)
      workers
    );

    const myResult = result.items.find((i) => i.userId === "me");
    if (!myResult) {
      throw new Error("Calculation failed");
    }

    res.json({
      ok: true,
      result: {
        myCombo: myResult.combo,
        ratio: myResult.ratio,
        basePay: myResult.basePay,
        peerPay: myResult.peerPay,
        totalPay: myResult.amount,
      },
    });
  } catch (err: any) {
    console.error("[Paymaster Preview Error]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Comboスコア計算エンドポイント
 * 
 * **重要**: 報酬計算には技術スコア（Tスコア）のみを使用します。
 * LUQOスコアは診断・成長のための指標であり、報酬には連動しません。
 * 
 * @deprecated このエンドポイントは将来の機能拡張用に予約されていますが、
 * 現在の報酬計算システムでは使用されていません。
 * 報酬計算は `calculateGooglePayroll` 関数を使用してください。
 */
router.post("/combo", async (req, res) => {
  try {
    const { userId, tScore, p = 2.0 } = req.body || {};

    if (typeof tScore !== "number") {
      return res.status(400).json({ ok: false, error: "Invalid tScore input" });
    }

    // Tスコアの正規化とブースト計算（payrollCalculator.tsと同じロジック）
    const MAX_STARS = 170;
    const stars = Math.min(Math.max(tScore || 0, 0), MAX_STARS);
    const tNorm = stars / MAX_STARS;
    const exponent = p > 0 ? p : 2.0;
    const tBoost = Math.pow(tNorm, exponent) * 100;

    // Combo = T_boost（LUQOスコアは一切考慮しない）
    const combo = tBoost;

    return res.json({
      ok: true,
      userId,
      tScore: stars,
      tNorm,
      tBoost,
      combo,
      note: "報酬計算には技術スコア（Tスコア）のみを使用。LUQOスコアは診断用であり、報酬には連動しません。",
    });
  } catch (err: any) {
    console.error("[Paymaster error]", err);
    res.status(500).json({ ok: false, error: err?.message ?? "unknown error" });
  }
});

export default router;
