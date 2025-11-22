type ArmType = "T_SCORE" | "Q_SCORE" | "LU_SCORE" | "O_SCORE" | "PSYCH_SAFETY";

interface Arm {
    id: string;
    type: ArmType;
    focus: string;
    desc: string;
}

interface ArmWeight {
    alpha: number;
    beta: number;
}

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

    private armWeights: Record<string, ArmWeight>;

    constructor() {
        this.armWeights = {};
        for (const arm of this.arms) {
            this.armWeights[arm.id] = { alpha: 2, beta: 2 };
        }
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
     * ユーザーモードに応じたアーム選択（トンプソンサンプリング）
     */
    public selectArms(mode: "EARN" | "LEARN" | "TEAM"): Arm[] {
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
            // sample = beta(alpha, beta) + boost
            // Python prototype used hardcoded (2, 2) but we use class state for future extensibility
            // (initialized to 2, 2)
            const weight = this.armWeights[arm.id];
            const baseVal = this.sampleBeta(weight.alpha, weight.beta);
            const val = baseVal + (boosts[arm.id] ?? 0);
            sampled.push({ arm, val });
        }

        // Return top 3
        sampled.sort((a, b) => b.val - a.val);
        return sampled.slice(0, 3).map((s) => s.arm);
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
     * Beta分布からのサンプリング (Gamma分布を利用した近似なしの実装)
     * X ~ Gamma(alpha, 1), Y ~ Gamma(beta, 1) => X / (X + Y) ~ Beta(alpha, beta)
     */
    private sampleBeta(alpha: number, beta: number): number {
        const x = this.sampleGamma(alpha);
        const y = this.sampleGamma(beta);
        return x / (x + y);
    }

    /**
     * Gamma分布からのサンプリング (Marsaglia and Tsang's method for alpha > 1)
     * 簡易実装として、整数alphaの場合は指数分布の和を利用
     */
    private sampleGamma(k: number): number {
        // 今回は alpha=2, beta=2 なので整数前提の簡易実装を採用
        // Gamma(k, 1) is sum of k exponential variables with lambda=1
        // Exp(1) = -ln(U)
        let sum = 0;
        for (let i = 0; i < k; i++) {
            sum += -Math.log(Math.random());
        }
        return sum;
    }
}
