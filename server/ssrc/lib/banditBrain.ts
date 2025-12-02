import type { UserBanditState, BanditArmState } from "../types/banditState";

type ArmType = "T_SCORE" | "Q_SCORE" | "LU_SCORE" | "O_SCORE" | "PSYCH_SAFETY";

interface Arm {
    id: string;
    type: ArmType;
    focus: string;
    desc: string;
}

// Default weak prior
const DEFAULT_ALPHA = 2;
const DEFAULT_BETA = 2;

export class LuqoBanditBrain {
    private arms: Arm[] = [
        {
            id: "Arm_Speed",
            type: "T_SCORE",
            focus: "作業速度",
            desc: "300㎡/日などのスピード項目",
        },
        {
            id: "Arm_Quality",
            type: "T_SCORE",
            focus: "品質精度",
            desc: "仕上がり・クレームゼロ",
        },
        {
            id: "Arm_Support",
            type: "Q_SCORE",
            focus: "他者支援",
            desc: "後輩への指導・ヘルプ",
        },
        {
            id: "Arm_Share",
            type: "LU_SCORE",
            focus: "ナレッジ共有",
            desc: "気づきの言語化・ログ共有",
        },
        {
            id: "Arm_Innovate",
            type: "O_SCORE",
            focus: "改善提案",
            desc: "新しいツールの導入・工程短縮",
        },
        {
            id: "Arm_Dialog",
            type: "PSYCH_SAFETY",
            focus: "対話・関係性",
            desc: "360度フィードバック・傾聴",
        },
    ];

    constructor() { }

    /**
     * ログ数に応じたポテンシャル範囲（不確実性）を計算
     */
    public calculatePotential(
        currentScore: number,
        logsCount: number,
    ): { lower: number; upper: number } {
        // Logic: Fewer logs = Higher uncertainty
        const uncertainty = Math.max(5, 30 - logsCount * 2);
        const lower = Math.max(0, currentScore - Math.floor(uncertainty * 0.4));
        const upper = Math.min(100, currentScore + Math.floor(uncertainty * 0.6));
        return { lower, upper };
    }

    /**
     * ユーザーモードに応じたアーム選択（トンプソンサンプリング）
     * @param mode ユーザーの現在のモード
     * @param state ユーザーの永続化されたBandit状態 (Optional)
     */
    public selectArms(mode: "EARN" | "LEARN" | "TEAM", state?: UserBanditState): Arm[] {
        const boosts: Record<string, number> = {};
        for (const arm of this.arms) {
            boosts[arm.id] = 0;
        }

        // Mapping Logic
        if (mode === "EARN") {
            // quality / speed
            boosts["Arm_Speed"] += 0.5;
            boosts["Arm_Quality"] += 0.3;
        } else if (mode === "TEAM") {
            // innovation -> mapped to TEAM/Contribution logic for safety
            boosts["Arm_Support"] += 0.5;
            boosts["Arm_Dialog"] += 0.4;
        } else if (mode === "LEARN") {
            // growth
            boosts["Arm_Innovate"] += 0.5;
            boosts["Arm_Share"] += 0.3;
        }

        const sampled: Array<{ arm: Arm; val: number }> = [];

        for (const arm of this.arms) {
            // Get alpha/beta from state or default
            let alpha = DEFAULT_ALPHA;
            let beta = DEFAULT_BETA;

            if (state && state[arm.id]) {
                alpha = state[arm.id].alpha;
                beta = state[arm.id].beta;
            }

            // sample = beta(alpha, beta) + boost
            const baseVal = this.sampleBeta(alpha, beta);
            const val = baseVal + (boosts[arm.id] ?? 0);
            sampled.push({ arm, val });
        }

        // Return top 3
        sampled.sort((a, b) => b.val - a.val);
        return sampled.slice(0, 3).map((s) => s.arm);
    }

    /**
     * 報酬に基づいて状態を更新し、新しい状態オブジェクトを返す
     * @param currentState 現在の状態
     * @param armId 選択されたアームID
     * @param reward 報酬 (0.0 - 1.0)
     */
    public updateState(
        currentState: UserBanditState,
        armId: string,
        reward: number
    ): UserBanditState {
        const newState = { ...currentState };
        const currentArmState = newState[armId] || {
            armId,
            alpha: DEFAULT_ALPHA,
            beta: DEFAULT_BETA,
            updatedAt: "",
        };

        // Update Logic:
        // newAlpha = oldAlpha + reward
        // newBeta = oldBeta + (1 - reward)
        const newAlpha = currentArmState.alpha + reward;
        const newBeta = currentArmState.beta + (1 - reward);

        newState[armId] = {
            ...currentArmState,
            alpha: newAlpha,
            beta: newBeta,
            updatedAt: new Date().toISOString(),
        };

        return newState;
    }

    /**
     * 選択されたアームに基づいてシステムプロンプトを生成
     */
    public generateSystemPrompt(selectedArm: Arm): string {
        return `
あなたは建設現場の職人評価AI「LUQO」です。
ユーザーの最近の活動ログを分析し、以下の「注力テーマ」に基づいたフィードバックを行ってください。

【注力テーマ】
・項目: ${selectedArm.focus} (${selectedArm.type})
・内容: ${selectedArm.desc}

ユーザーがこのテーマに沿った行動を増やせるよう、具体的かつ前向きなアドバイスを短く（100文字以内）提示してください。
`.trim();
    }

    /**
     * Beta分布からのサンプリング
     * X ~ Gamma(alpha, 1), Y ~ Gamma(beta, 1) => X / (X + Y) ~ Beta(alpha, beta)
     */
    private sampleBeta(alpha: number, beta: number): number {
        const x = this.sampleGamma(alpha);
        const y = this.sampleGamma(beta);
        if (x + y === 0) return 0.5; // Edge case
        return x / (x + y);
    }

    /**
     * Gamma分布からのサンプリング (Marsaglia-Tsang method)
     * Supports non-integer k.
     */
    private sampleGamma(k: number): number {
        if (k < 1) {
            // Johnk's generator or boosting with U^(1/k)
            // Here we use the property: Gamma(k) = Gamma(k+1) * U^(1/k)
            return this.sampleGamma(k + 1) * Math.pow(Math.random(), 1.0 / k);
        }

        const d = k - 1.0 / 3.0;
        const c = 1.0 / Math.sqrt(9.0 * d);

        while (true) {
            let x, v;
            do {
                x = this.generateNormal();
                v = 1.0 + c * x;
            } while (v <= 0);

            v = v * v * v;
            const u = Math.random();

            if (u < 1.0 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1.0 - v + Math.log(v))) return d * v;
        }
    }

    /**
     * Box-Muller transform for standard normal distribution
     */
    private generateNormal(): number {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

// ------------------------------------------------------------------
// Personal Bandit Logic (Merged from banditPersonal.ts)
// ------------------------------------------------------------------

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
