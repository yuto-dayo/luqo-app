export type BanditArmState = {
    armId: string;
    alpha: number; // Success weight (float)
    beta: number;  // Failure weight (float)
    updatedAt: string;
};

export type UserBanditState = Record<string, BanditArmState>;
