// Bandit Arm IDs (統一された3軸モデル)
export type BanditArmId = "Arm_LU" | "Arm_Q" | "Arm_O";

export type BanditArmState = {
    armId: BanditArmId;
    alpha: number; // Success weight (float, Beta分布のパラメータ)
    beta: number;  // Failure weight (float, Beta分布のパラメータ)
    trials: number; // 選択回数（UCB計算用）
    updatedAt: string;
};

// コンテキスト別のブースト値
export type ContextBoosts = {
    EARN: { LU: number; Q: number; O: number };
    LEARN: { LU: number; Q: number; O: number };
    TEAM: { LU: number; Q: number; O: number };
};

// ユーザーのバンディット状態（永続化用）
export type UserBanditState = {
    arms: Record<BanditArmId, BanditArmState>;
    contextBoosts: ContextBoosts;
    totalTrials: number; // 総試行回数（UCB計算用）
    updatedAt: string;
};

// デフォルトの初期状態を生成
export function createDefaultBanditState(): UserBanditState {
    const now = new Date().toISOString();
    const defaultArmState = (armId: BanditArmId): BanditArmState => ({
        armId,
        alpha: 2,  // 弱い事前分布
        beta: 2,
        trials: 0,
        updatedAt: now,
    });

    return {
        arms: {
            Arm_LU: defaultArmState("Arm_LU"),
            Arm_Q: defaultArmState("Arm_Q"),
            Arm_O: defaultArmState("Arm_O"),
        },
        contextBoosts: {
            EARN: { LU: 0, Q: 0.3, O: 0 },    // EARNモードはQ(品質)重視
            LEARN: { LU: 0.3, Q: 0, O: 0.2 }, // LEARNモードはLU(学習)とO(改善)
            TEAM: { LU: 0.2, Q: 0, O: 0.3 },  // TEAMモードはO(貢献)とLU(共有)
        },
        totalTrials: 0,
        updatedAt: now,
    };
}

// 後方互換性のための旧型定義（移行期間中のみ使用）
export type LegacyUserBanditState = Record<string, {
    armId: string;
    alpha: number;
    beta: number;
    updatedAt: string;
}>;

// 旧形式から新形式への変換
export function migrateBanditState(legacy: LegacyUserBanditState | null): UserBanditState {
    if (!legacy) {
        return createDefaultBanditState();
    }

    // 既に新形式の場合はそのまま返す
    if ('arms' in legacy && 'contextBoosts' in legacy) {
        return legacy as unknown as UserBanditState;
    }

    // 旧形式からの移行
    const newState = createDefaultBanditState();

    // 旧アームのデータを新アームにマッピング
    // 旧: Arm_Speed, Arm_Quality -> 新: Arm_Q
    // 旧: Arm_Share, Arm_Support, Arm_Dialog -> 新: Arm_LU
    // 旧: Arm_Innovate -> 新: Arm_O
    const legacyToNew: Record<string, BanditArmId> = {
        Arm_Speed: "Arm_Q",
        Arm_Quality: "Arm_Q",
        Arm_Share: "Arm_LU",
        Arm_Support: "Arm_LU",
        Arm_Dialog: "Arm_LU",
        Arm_Innovate: "Arm_O",
    };

    for (const [oldArmId, newArmId] of Object.entries(legacyToNew)) {
        const oldState = legacy[oldArmId];
        if (oldState) {
            // 複数の旧アームを平均化して新アームに統合
            const existing = newState.arms[newArmId];
            existing.alpha = (existing.alpha + oldState.alpha) / 2;
            existing.beta = (existing.beta + oldState.beta) / 2;
            existing.updatedAt = oldState.updatedAt;
        }
    }

    return newState;
}
