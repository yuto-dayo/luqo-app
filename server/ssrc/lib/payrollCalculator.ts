export const MAX_STARS = 170;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

export type WorkerSummary = {
    userId: string;
    name: string;
    days: number;
    starsTotal: number;
    peerCount: number;
    combo: number;
    effort: number;
    stars: number;
};

export type PayrollItem = {
    userId: string;
    name: string;
    days: number;
    starsTotal: number;
    peerCount: number;
    combo: number;
    ratio: number;
    basePay: number;
    peerPay: number;
    amount: number;
};

export type PayrollResult = {
    items: PayrollItem[];
    distributable: number;
    payGap: string;
};

export type PayrollWorkerInput = {
    userId: string;
    name: string;
    days: number;
    starsTotal: number;
    peerCount: number;
};

// Google流計算ロジック
export function calculateGooglePayroll(
    profit: number,
    companyRate: number,
    p: number,
    peerUnit: number,
    workers: PayrollWorkerInput[]
): PayrollResult {
    // 1. 原資の確定
    // companyRateが未指定なら0
    const rate = Number.isFinite(companyRate) ? clamp(companyRate, 0, 1) : 0.0;
    const distributable = Math.floor(profit * (1 - rate));

    // 2. 実力係数 (Combo) & 利益配分 (Base Pay)
    const summaries = workers.map((w) => {
        // Tスコア計算
        const stars = clamp(w.starsTotal || 0, 0, MAX_STARS);
        const tNorm = stars / MAX_STARS;
        const exponent = p > 0 ? p : 2.0; // デフォルト2.0

        // 技術ブースト (Google流: 技術には極端に報いる)
        // tBoost = (tNorm)^p * 100
        // ※ 100を掛けるのはスケーリングのため
        const tBoost = Math.pow(tNorm, exponent) * 100;

        // Combo = T_boost (LUQOは含めない)
        const combo = tBoost;

        // Effort = Days * Combo
        const days = w.days || 0;
        const effort = days * combo;

        return { ...w, combo, effort, stars };
    });

    const totalEffort = summaries.reduce((sum, w) => sum + w.effort, 0);

    // 配分計算
    let items = summaries.map((w) => {
        // 利益配分 (Performance Pay)
        const ratio = totalEffort > 0 ? w.effort / totalEffort : 0;
        const basePay = Math.round(distributable * ratio);

        // ピアボーナス (Peer Bonus)
        const peerCount = w.peerCount || 0;
        const peerPay = peerCount * peerUnit;

        // 総支給額
        const totalPay = basePay + peerPay;

        return {
            userId: w.userId,
            name: w.name,
            days: w.days,
            starsTotal: w.stars,
            peerCount,
            combo: w.combo, // 実力係数
            ratio,
            basePay, // 利益配分
            peerPay, // 徳給
            amount: totalPay, // 支給総額
        };
    });

    // 端数調整 (利益配分のみ調整対象とする)
    const totalBasePay = items.reduce((sum, w) => sum + w.basePay, 0);
    const diff = distributable - totalBasePay;

    if (items.length > 0 && diff !== 0) {
        // combo（技術力）が最も高い人に差額を寄せる
        let targetIndex = 0;
        for (let i = 1; i < items.length; i++) {
            if (items[i].combo > items[targetIndex].combo) {
                targetIndex = i;
            }
        }
        items[targetIndex].basePay += diff;
        items[targetIndex].amount += diff;
    }

    // 統計データ: トップとボトムの倍率（0円除外）
    const amounts = items.map((i) => i.amount).filter((a) => a > 0);
    const maxPay = Math.max(...amounts, 0);
    const minPay = Math.min(...amounts, Infinity);
    const payGap =
        minPay > 0 && minPay !== Infinity ? (maxPay / minPay).toFixed(2) : "N/A";

    return { items, distributable, payGap };
}
