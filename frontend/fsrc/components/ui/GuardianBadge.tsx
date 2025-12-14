import React from "react";
import { Icon } from "./Icon";

interface GuardianBadgeProps {
    delta: number;
}

export const GuardianBadge: React.FC<GuardianBadgeProps> = ({ delta }) => {
    if (delta <= 0) return null; // ボーナスがない場合は表示しない

    return (
        <div style={{
            marginTop: "12px",
            padding: "12px 16px",
            background: "var(--color-q-bg, #f0fdf4)",
            border: "1px solid var(--color-q-surface, #dcfce7)",
            borderRadius: "var(--radius-lg, 16px)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            animation: "fadeIn 0.5s ease-out",
            color: "var(--color-q-base, #16a34a)"
        }}>
            <div style={{
                background: "var(--color-surface, #ffffff)",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-sm)",
                flexShrink: 0
            }}>
                <Icon name="guardian" size={24} color="var(--color-q-base, #16a34a)" />
            </div>
            <div>
                <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.02em" }}>
                    GUARDIAN BONUS
                </div>
                <div style={{ fontSize: "11px", opacity: 0.9, lineHeight: "1.4", marginTop: "2px" }}>
                    組織を守る行動への評価<br />
                    貢献スコア(Q) <b>+{delta}pt</b>
                </div>
            </div>
        </div>
    );
};
