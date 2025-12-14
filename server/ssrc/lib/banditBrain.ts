import type {
    UserBanditState,
    BanditArmId,
    BanditArmState,
    ContextBoosts,
    createDefaultBanditState,
    migrateBanditState
} from "../types/banditState";

// ユーザーモード
export type UserMode = "EARN" | "LEARN" | "TEAM";

// アーム情報（UI表示用）
interface ArmInfo {
    id: BanditArmId;
    dimension: "LU" | "Q" | "O";
    focus: string;
    desc: string;
}

// 選択結果
export interface ArmSelectionResult {
    armId: BanditArmId;
    armInfo: ArmInfo;
    sampleValue: number;      // Beta分布からのサンプル値
    ucbBonus: number;         // 不確実性ボーナス
    contextBoost: number;     // コンテキストブースト
    finalScore: number;       // 最終スコア
}

// 探索重み (0 = 活用のみ, 1 = 高い探索)
const EXPLORATION_WEIGHT = 0.5;

// Default weak prior
const DEFAULT_ALPHA = 2;
const DEFAULT_BETA = 2;

export class LuqoBanditBrain {
    private armInfos: ArmInfo[] = [
        {
            id: "Arm_LU",
            dimension: "LU",
            focus: "学習・共有",
            desc: "ナレッジ共有、他者支援、対話・関係性構築",
        },
        {
            id: "Arm_Q",
            dimension: "Q",
            focus: "品質・効率",
            desc: "作業速度、品質精度、仕上がり向上",
        },
        {
            id: "Arm_O",
            dimension: "O",
            focus: "改善・革新",
            desc: "改善提案、新しいツール導入、工程短縮",
        },
    ];

    constructor() { }

    /**
     * アームIDから対応する次元を取得
     */
    public getDimensionForArm(armId: BanditArmId): "LU" | "Q" | "O" {
        const info = this.armInfos.find(a => a.id === armId);
        return info?.dimension ?? "Q";
    }

    /**
     * 次元からアームIDを取得
     */
    public getArmForDimension(dimension: "LU" | "Q" | "O"): BanditArmId {
        return `Arm_${dimension}` as BanditArmId;
    }

    /**
     * UCB-Adjusted Thompson Sampling でアームを選択
     * @param mode ユーザーの現在のモード（コンテキスト）
     * @param state ユーザーの永続化されたBandit状態
     * @param seasonTargetDimension シーズンのターゲット次元（追加ブースト用）
     */
    public selectArm(
        mode: UserMode,
        state: UserBanditState,
        seasonTargetDimension?: "LU" | "Q" | "O"
    ): ArmSelectionResult {
        const results: ArmSelectionResult[] = [];

        for (const armInfo of this.armInfos) {
            const armState = state.arms[armInfo.id] || {
                alpha: DEFAULT_ALPHA,
                beta: DEFAULT_BETA,
                trials: 0,
            };

            // 1. Thompson Sampling: Beta分布からサンプル
            const sampleValue = this.sampleBeta(armState.alpha, armState.beta);

            // 2. UCB bonus: 不確実性に基づく探索ボーナス
            // UCB1公式: sqrt(2 * ln(n) / n_i)
            const totalTrials = state.totalTrials || 1;
            const armTrials = armState.trials || 1;
            const ucbBonus = EXPLORATION_WEIGHT * Math.sqrt(
                2 * Math.log(totalTrials + 1) / (armTrials + 1)
            );

            // 3. コンテキストブースト
            let contextBoost = 0;
            const modeBoosts = state.contextBoosts?.[mode];
            if (modeBoosts) {
                contextBoost = modeBoosts[armInfo.dimension] || 0;
            }

            // 4. シーズンターゲットブースト（組織目標との整合性）
            let seasonBoost = 0;
            if (seasonTargetDimension === armInfo.dimension) {
                seasonBoost = 0.2;
            }

            // 最終スコア
            const finalScore = sampleValue + ucbBonus + contextBoost + seasonBoost;

            results.push({
                armId: armInfo.id,
                armInfo,
                sampleValue,
                ucbBonus,
                contextBoost: contextBoost + seasonBoost,
                finalScore,
            });
        }

        // 最高スコアのアームを選択
        results.sort((a, b) => b.finalScore - a.finalScore);
        return results[0];
    }

    /**
     * 複数アームを選択（上位N件）
     */
    public selectArms(
        mode: UserMode,
        state: UserBanditState,
        count: number = 3,
        seasonTargetDimension?: "LU" | "Q" | "O"
    ): ArmSelectionResult[] {
        const results: ArmSelectionResult[] = [];

        for (const armInfo of this.armInfos) {
            const armState = state.arms[armInfo.id] || {
                alpha: DEFAULT_ALPHA,
                beta: DEFAULT_BETA,
                trials: 0,
            };

            const sampleValue = this.sampleBeta(armState.alpha, armState.beta);
            const totalTrials = state.totalTrials || 1;
            const armTrials = armState.trials || 1;
            const ucbBonus = EXPLORATION_WEIGHT * Math.sqrt(
                2 * Math.log(totalTrials + 1) / (armTrials + 1)
            );

            let contextBoost = 0;
            const modeBoosts = state.contextBoosts?.[mode];
            if (modeBoosts) {
                contextBoost = modeBoosts[armInfo.dimension] || 0;
            }

            let seasonBoost = 0;
            if (seasonTargetDimension === armInfo.dimension) {
                seasonBoost = 0.2;
            }

            const finalScore = sampleValue + ucbBonus + contextBoost + seasonBoost;

            results.push({
                armId: armInfo.id,
                armInfo,
                sampleValue,
                ucbBonus,
                contextBoost: contextBoost + seasonBoost,
                finalScore,
            });
        }

        results.sort((a, b) => b.finalScore - a.finalScore);
        return results.slice(0, count);
    }

    /**
     * 報酬に基づいて状態を更新し、新しい状態オブジェクトを返す
     * @param currentState 現在の状態
     * @param armId 選択されたアームID
     * @param rawScore 生スコア (0-100)
     */
    public updateState(
        currentState: UserBanditState,
        armId: BanditArmId,
        rawScore: number
    ): UserBanditState {
        // シグモイド変換で報酬を計算（中央付近の差を強調）
        const reward = this.sigmoidReward(rawScore);

        const newState: UserBanditState = {
            ...currentState,
            arms: { ...currentState.arms },
            totalTrials: (currentState.totalTrials || 0) + 1,
            updatedAt: new Date().toISOString(),
        };

        const currentArmState = newState.arms[armId] || {
            armId,
            alpha: DEFAULT_ALPHA,
            beta: DEFAULT_BETA,
            trials: 0,
            updatedAt: "",
        };

        // Bayesian Update:
        // newAlpha = oldAlpha + reward
        // newBeta = oldBeta + (1 - reward)
        newState.arms[armId] = {
            ...currentArmState,
            alpha: currentArmState.alpha + reward,
            beta: currentArmState.beta + (1 - reward),
            trials: (currentArmState.trials || 0) + 1,
            updatedAt: new Date().toISOString(),
        };

        return newState;
    }

    /**
     * コンテキストブーストを学習・更新
     * 成功したアーム×モードの組み合わせのブーストを強化
     */
    public updateContextBoost(
        currentState: UserBanditState,
        mode: UserMode,
        armId: BanditArmId,
        success: boolean
    ): UserBanditState {
        const dimension = this.getDimensionForArm(armId);
        const learningRate = 0.1;

        const newState: UserBanditState = {
            ...currentState,
            contextBoosts: { ...currentState.contextBoosts },
        };

        const currentBoost = newState.contextBoosts[mode]?.[dimension] || 0;
        const delta = success ? learningRate : -learningRate * 0.5;
        const newBoost = Math.max(-0.3, Math.min(0.5, currentBoost + delta));

        newState.contextBoosts[mode] = {
            ...newState.contextBoosts[mode],
            [dimension]: newBoost,
        };

        return newState;
    }

    /**
     * シグモイド報酬変換
     * スコア(0-100)を報酬(0-1)に変換し、中央付近の差を強調
     * @param score 生スコア (0-100)
     */
    public sigmoidReward(score: number): number {
        // σ(0.1 * (score - 50)) で50を中心に変換
        // score=0 -> ~0.007, score=50 -> 0.5, score=100 -> ~0.993
        const normalized = 1 / (1 + Math.exp(-0.1 * (score - 50)));
        return Math.max(0, Math.min(1, normalized));
    }

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
     * 選択されたアームに基づいてシステムプロンプトを生成
     */
    public generateSystemPrompt(selectedArm: ArmSelectionResult): string {
        return `
あなたは建設現場の職人評価AI「LUQO」です。
ユーザーの最近の活動ログを分析し、以下の「注力テーマ」に基づいたフィードバックを行ってください。

【注力テーマ】
・項目: ${selectedArm.armInfo.focus} (${selectedArm.armInfo.dimension})
・内容: ${selectedArm.armInfo.desc}

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
// LU/Q/O の重み計算（別用途、残存）
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

    // "育て得度合い" = 相関 × 伸びしろ
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
