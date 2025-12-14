import React from "react";

type VoteProgressProps = {
    approvers: string[];
    rejecters: string[];
    passers?: string[];
    totalUsers: number;
};

export const VoteProgress: React.FC<VoteProgressProps> = ({ approvers, rejecters, passers = [], totalUsers }) => {
    const passCount = passers.length;
    // 有効投票母数 = 全ユーザー - 保留者
    // ただし、全員保留だと0になってしまうので、最低1は確保
    const effectiveTotalUsers = Math.max(1, totalUsers - passCount);

    const voteCount = approvers.length + rejecters.length;
    const threshold = Math.ceil(effectiveTotalUsers * 0.75); // 3/4

    const percentage = threshold > 0 ? Math.min(100, (voteCount / threshold) * 100) : 0;

    return (
        <div style={{ marginTop: "8px", padding: "8px 12px", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "#5e5e5e" }}>決裁状況 ({threshold}票で確定)</span>
                <span style={{ fontWeight: "bold" }}>{voteCount} / {threshold} 票</span>
            </div>

            {/* プログレスバー */}
            <div style={{ width: "100%", height: "6px", background: "#e0e0e0", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${percentage}%`, height: "100%", background: "#00639b", transition: "width 0.3s ease" }} />
            </div>

            <div style={{ fontSize: "11px", color: "#757575", marginTop: "4px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span>👍 承認: {approvers.length}</span>
                <span>👎 否決: {rejecters.length}</span>
                {passCount > 0 && <span>🤔 保留: {passCount}</span>}
            </div>
        </div>
    );
};
