import React from "react";
import { useRetroGameMode } from "../hooks/useRetroGameMode";

type Props = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuickSelect?: (days: number) => void;
  disabled?: boolean;
};

type QuickOption = {
  label: string;
  days: number;
};

const QUICK_OPTIONS: QuickOption[] = [
  { label: "過去1週間", days: 7 },
  { label: "過去2週間", days: 14 },
  { label: "過去1ヶ月", days: 30 },
  { label: "過去3ヶ月", days: 90 },
];

export const DateRangePicker: React.FC<Props> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onQuickSelect,
  disabled = false,
}) => {
  const isRetroGameMode = useRetroGameMode();

  const handleQuickSelect = (days: number) => {
    if (onQuickSelect) {
      onQuickSelect(days);
    } else {
      // デフォルト実装：過去N日間を選択
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      onEndDateChange(formatDate(end));
      onStartDateChange(formatDate(start));
    }
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 日付の妥当性チェック
  const isDateValid = startDate && endDate && new Date(startDate) <= new Date(endDate);
  const daysDiff = startDate && endDate 
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* クイック選択ボタン */}
      {onQuickSelect && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {QUICK_OPTIONS.map((option) => (
            <button
              key={option.days}
              onClick={() => handleQuickSelect(option.days)}
              disabled={disabled}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                borderRadius: isRetroGameMode ? "0" : "8px",
                border: isRetroGameMode ? "2px solid #00ffff" : "1px solid var(--color-border, #e5e7eb)",
                background: isRetroGameMode ? "#1a1a2e" : "var(--color-surface-container-low, #f9fafb)",
                color: isRetroGameMode ? "#00ffff" : "var(--color-text-main, #111827)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: isRetroGameMode ? "transform 0.1s steps(1, end)" : "all var(--motion-duration, 0.2s) var(--motion-easing, ease)",
                boxShadow: isRetroGameMode ? "0 0 8px rgba(0, 255, 255, 0.5)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  if (isRetroGameMode) {
                    e.currentTarget.style.background = "#00ffff";
                    e.currentTarget.style.color = "#0a0a0f";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(0, 255, 255, 0.8)";
                    e.currentTarget.style.transform = "translate(2px, 2px)";
                  } else {
                    e.currentTarget.style.background = "var(--color-surface-container, #f1f5f9)";
                    e.currentTarget.style.borderColor = "var(--color-primary, #2563eb)";
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  if (isRetroGameMode) {
                    e.currentTarget.style.background = "#1a1a2e";
                    e.currentTarget.style.color = "#00ffff";
                    e.currentTarget.style.boxShadow = "0 0 8px rgba(0, 255, 255, 0.5)";
                    e.currentTarget.style.transform = "translate(0, 0)";
                  } else {
                    e.currentTarget.style.background = "var(--color-surface-container-low, #f9fafb)";
                    e.currentTarget.style.borderColor = "var(--color-border, #e5e7eb)";
                  }
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* カスタム日付選択 */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "140px" }}>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "600",
              color: isRetroGameMode ? "#00ff88" : "var(--color-text-sub, #6b7280)",
              marginBottom: "6px",
            }}
          >
            開始日
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              disabled={disabled}
              max={endDate || undefined}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: isRetroGameMode ? "0" : "8px",
                border: isDateValid || !startDate
                  ? (isRetroGameMode ? "2px solid #00ffff" : "1px solid var(--color-border, #d1d5db)")
                  : "1px solid var(--color-error, #ef4444)",
                fontSize: "14px",
                background: disabled
                  ? (isRetroGameMode ? "#0a0a0f" : "var(--color-surface-container-lowest, #ffffff)")
                  : (isRetroGameMode ? "#0a0a0f" : "white"),
                color: isRetroGameMode ? "#00ffff" : "var(--color-text-main, #111827)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "20px",
            color: isRetroGameMode ? "#00ffff" : "var(--color-text-sub, #6b7280)",
            fontSize: "14px",
            textShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.6)" : "none",
          }}
        >
          →
        </div>

        <div style={{ flex: 1, minWidth: "140px" }}>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "600",
              color: isRetroGameMode ? "#00ff88" : "var(--color-text-sub, #6b7280)",
              marginBottom: "6px",
            }}
          >
            終了日
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              disabled={disabled}
              min={startDate || undefined}
              max={formatDate(new Date())}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: isRetroGameMode ? "0" : "8px",
                border: isDateValid || !endDate
                  ? (isRetroGameMode ? "2px solid #00ffff" : "1px solid var(--color-border, #d1d5db)")
                  : "1px solid var(--color-error, #ef4444)",
                fontSize: "14px",
                background: disabled
                  ? (isRetroGameMode ? "#0a0a0f" : "var(--color-surface-container-lowest, #ffffff)")
                  : (isRetroGameMode ? "#0a0a0f" : "white"),
                color: isRetroGameMode ? "#00ffff" : "var(--color-text-main, #111827)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                boxShadow: isRetroGameMode ? "0 0 5px rgba(0, 255, 255, 0.3)" : "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* 期間表示 */}
      {isDateValid && daysDiff > 0 && (
        <div
          style={{
            fontSize: "11px",
            color: isRetroGameMode ? "#00ff88" : "var(--color-text-sub, #6b7280)",
            textAlign: "right",
          }}
        >
          {daysDiff}日間
        </div>
      )}

      {/* エラーメッセージ */}
      {startDate && endDate && !isDateValid && (
        <div
          style={{
            fontSize: "11px",
            color: isRetroGameMode ? "#ff00ff" : "var(--color-error, #ef4444)",
            textAlign: "center",
            textShadow: isRetroGameMode ? "0 0 5px rgba(255, 0, 255, 0.6)" : "none",
          }}
        >
          開始日は終了日より前である必要があります
        </div>
      )}
    </div>
  );
};



























