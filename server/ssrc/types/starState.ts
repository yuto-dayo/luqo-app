export type VoteRecord = {
    approvers: string[]; // 承認した人のIDリスト
    rejecters: string[]; // 否決した人のIDリスト
    passers?: string[];   // 保留した人のIDリスト
};

export type UserStarState = {
    acquired: string[];
    pending: string[];
    // 申請中のスターごとの投票状況
    votes?: Record<string, VoteRecord>;
};
