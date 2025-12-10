import React, { useMemo } from "react";
import { useForceFetchScore, useIsFixed } from "../hooks/useLuqoStore";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import { Icon } from "./ui/Icon";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import type { Score } from "../hooks/useLuqoStore";

type LuqoSummaryProps = {
  score: Score;
  activeDimension?: "LU" | "Q" | "O";
};

// レトロゲームモード専用のHPバーコンポーネント
const RetroHPBar = ({
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
  const isRetroGameMode = useRetroGameMode();

  // 手動更新（強制再計算）
  const handleManualUpdate = async () => {
    if (await confirm("スコアを最新のログに基づいて再計算（更新）しますか？\n※現在の評価結果は上書きされます。")) {
      await forceFetchScore();
      showSnackbar("スコアを更新しました！ 🔄", "success");
    }
  };

  const rings = useMemo(
    () => {
      // レトロゲーモードの時は8bitネオンカラーを使用
      if (isRetroGameMode) {
        return [
          { key: "LU" as const, value: lu, color: "#00ffff", icon: "learning", label: "学習" },
          { key: "Q" as const, value: q, color: "#00ff00", icon: "contribution", label: "貢献" },
          { key: "O" as const, value: o, color: "#ff00ff", icon: "innovation", label: "革新" },
        ];
      }
      // 通常モード
      return [
        { key: "LU" as const, value: lu, color: "#0369a1", icon: "learning", label: "学習" },
        { key: "Q" as const, value: q, color: "#15803d", icon: "contribution", label: "貢献" },
        { key: "O" as const, value: o, color: "#b45309", icon: "innovation", label: "革新" },
      ];
    },
    [lu, q, o, isRetroGameMode],
  );

  return (
    <section
      className="card"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: isRetroGameMode ? "#1a1a2e" : "white",
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

      
      {/* 修正後のレイアウト実装 */}
       <div style={{
        display: "flex",
        justifyContent: isRetroGameMode ? "flex-start" : "space-between",
        alignItems: isRetroGameMode ? "stretch" : "flex-end", // レトロモードは幅いっぱいに
        marginBottom: 24,
        padding: "0 4px",
        minHeight: isRetroGameMode ? "auto" : "140px",
        gap: isRetroGameMode ? 24 : 0,
        width: "100%",
        flexDirection: isRetroGameMode ? "column" : "row", // レトロモードは縦並び
      }}>
        {rings.map((r) => (
          isRetroGameMode ? (
            <div key={r.key} style={{ width: "100%" }}>
              <RetroHPBar
                value={r.value}
                color={r.color}
                iconName={r.icon}
                label={r.label}
                isActive={activeDimension === r.key}
              />
            </div>
          ) : (
            <ProgressRing
              key={r.key}
              value={r.value}
              color={r.color}
              iconName={r.icon}
              label={r.label}
              isActive={activeDimension === r.key}
            />
          )
        ))}
      </div>

      <div style={{ marginTop: "auto", height: "10px" }} />
    </section>
  );
};
