import React, { useMemo } from "react";
import { useForceFetchScore, useIsFixed } from "../hooks/useLuqoStore";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import { Icon } from "./ui/Icon";
import type { Score } from "../hooks/useLuqoStore";

type LuqoSummaryProps = {
  score: Score;
  activeDimension?: "LU" | "Q" | "O";
};

const ProgressRing = ({
  value,
  color,
  iconName,
  label,
  isActive,
}: {
  value: number;
  color: string;
  iconName: string;
  label: string;
  isActive?: boolean;
}) => {
  const size = isActive ? 96 : 72;
  const strokeWidth = isActive ? 10 : 6;
  const radius = (size - strokeWidth) / 2;
  const c = radius * 2 * Math.PI;
  const offset = c - (value / 100) * c;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        transform: isActive ? "translateY(-8px)" : "none",
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        opacity: isActive ? 1 : 0.8,
      }}
    >
      {isActive && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "white",
            background: color,
            padding: "4px 10px",
            borderRadius: 99,
            marginBottom: -8,
            zIndex: 2,
            boxShadow: `0 4px 12px ${color}60`,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="fire" size={12} color="white" /> BOOSTING
        </div>
      )}

      <div style={{ position: "relative", width: size, height: size }}>
        {isActive && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: `0 0 24px ${color}30` }} />}

        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={color} strokeWidth={strokeWidth} strokeOpacity={0.1} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Icon name={iconName} size={isActive ? 24 : 18} color={color} />
          <span style={{ fontSize: isActive ? 18 : 14, fontWeight: 800, color, marginTop: 2 }}>{Math.round(value)}</span>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 600, color: isActive ? color : "#94a3b8", letterSpacing: 0.5 }}>
        {label}
      </span>
    </div>
  );
};

export const LuqoSummary: React.FC<LuqoSummaryProps> = ({ score, activeDimension }) => {
  const { LU: lu, Q: q, O: o } = score;
  useIsFixed(); // state consumption to keep in sync; display is fixed badge below
  const forceFetchScore = useForceFetchScore();
  const { confirm } = useConfirm();
  const { showSnackbar } = useSnackbar();

  // 手動更新（強制再計算）
  const handleManualUpdate = async () => {
    if (await confirm("スコアを最新のログに基づいて再計算（更新）しますか？\n※現在の評価結果は上書きされます。")) {
      await forceFetchScore();
      showSnackbar("スコアを更新しました！ 🔄", "success");
    }
  };

  const rings = useMemo(
    () => [
      { key: "LU" as const, value: lu, color: "#0369a1", icon: "learning", label: "学習" },
      { key: "Q" as const, value: q, color: "#15803d", icon: "contribution", label: "貢献" },
      { key: "O" as const, value: o, color: "#b45309", icon: "innovation", label: "革新" },
    ],
    [lu, q, o],
  );

  return (
    <section
      className="card"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "white",
        padding: "24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "0.4px", textTransform: "uppercase", margin: 0 }}>Current Status</p>
          <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>LUQO Score</h2>
        </div>
        <button
          onClick={handleManualUpdate}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: "8px" }}
          title="最新の状態に更新"
        >
          <Icon name="thinking" size={18} />
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            background: "#0f172a",
            color: "white",
            padding: "4px 10px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          <Icon name="lock" size={12} />
          FIXED
        </div>
      </div>

      <div style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-end",
        marginBottom: 24,
        padding: "0 4px",
        minHeight: "140px"
      }}>
        {rings.map((r) => (
          <ProgressRing
            key={r.key}
            value={r.value}
            color={r.color}
            iconName={r.icon}
            label={r.label}
            isActive={activeDimension === r.key}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", height: "10px" }} />
    </section>
  );
};
