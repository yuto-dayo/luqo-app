import React from "react";
import { Icon } from "./Icon";

type RetroHPBarProps = {
    value: number;
    color: string;
    iconName: string;
    label: string;
    isActive?: boolean;
};

// レトロゲームモード専用のHPバーコンポーネント
export const RetroHPBar: React.FC<RetroHPBarProps> = ({
    value,
    color,
    iconName,
    label,
    isActive,
}) => {
    const borderWidth = 3;
    // バーの塗りつぶし幅 (%)
    const fillPercent = Math.min(100, Math.max(0, value));

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                width: "100%", // 親要素に合わせて幅いっぱい
                opacity: isActive ? 1 : 0.8,
                transform: isActive ? "translateY(-2px)" : "none",
                transition: "all 0.2s ease-out",
                position: "relative",
            }}
        >
            {/* BOOSTING バッジ */}
            {isActive && (
                <div
                    style={{
                        position: "absolute",
                        top: -20,
                        left: 0,
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#0a0a0f",
                        background: color,
                        padding: "2px 6px",
                        border: "2px solid #0a0a0f",
                        zIndex: 10,
                        boxShadow: "2px 2px 0px #0a0a0f",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        textTransform: "uppercase",
                        fontFamily: "'DotGothic16', 'Press Start 2P', monospace",
                        whiteSpace: "nowrap",
                    }}
                >
                    <Icon name="fire" size={10} color="#0a0a0f" /> BOOST
                </div>
            )}

            {/* ヘッダー: アイコンと数値 */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                        style={{
                            width: 24,
                            height: 24,
                            background: "#0a0a0f",
                            border: `2px solid ${color}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "2px 2px 0px #0a0a0f",
                        }}
                    >
                        <Icon name={iconName} size={14} color={color} />
                    </div>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: color,
                            fontFamily: "'DotGothic16', 'Press Start 2P', monospace",
                            textTransform: "uppercase",
                        }}
                    >
                        {label}
                    </span>
                </div>
                <span
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: color,
                        fontFamily: "'DotGothic16', 'Press Start 2P', monospace",
                        textShadow: `2px 2px 0px #000`,
                        lineHeight: 1,
                    }}
                >
                    {Math.round(value)}
                </span>
            </div>

            {/* HPバー本体 - グローバルCSSの影響を避けるため span タグを使用 */}
            <span
                style={{
                    display: "block",
                    position: "relative",
                    width: "100%",
                    height: 16,
                    background: "#0a0a0f",
                    border: `${borderWidth}px solid #0a0a0f`,
                    boxShadow: "2px 2px 0px #0a0a0f",
                }}
            >
                {/* 背景（暗い部分） */}
                <span
                    style={{
                        display: "block",
                        position: "absolute",
                        inset: 0,
                        background: "#1a1a2e",
                        zIndex: 0,
                    }}
                />

                {/* ゲージ（明るい部分） */}
                <span
                    style={{
                        display: "block",
                        position: "absolute",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${fillPercent}%`,
                        background: color,
                        transition: "width 0.5s steps(10, end)",
                        zIndex: 1,
                    }}
                >
                    {/* 光沢ハイライト */}
                    <span
                        style={{
                            display: "block",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "40%",
                            background: "rgba(255,255,255,0.3)",
                        }}
                    />
                </span>

                {/* グリッド線（目盛り） - linear-gradient を含むため div だと消される */}
                <span
                    style={{
                        display: "block",
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "linear-gradient(90deg, transparent 19px, rgba(0,0,0,0.5) 20px)",
                        backgroundSize: "20px 100%",
                        pointerEvents: "none",
                        zIndex: 2,
                    }}
                />
            </span>
        </div>
    );
};
