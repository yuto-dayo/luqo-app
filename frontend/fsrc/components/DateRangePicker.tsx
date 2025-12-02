import React from "react";

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
                borderRadius: "8px",
                border: "1px solid var(--color-border, #e5e7eb)",
                background: "var(--color-surface-container-low, #f9fafb)",
                color: "var(--color-text-main, #111827)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: "all var(--motion-duration, 0.2s) var(--motion-easing, ease)",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = "var(--color-surface-container, #f1f5f9)";
                  e.currentTarget.style.borderColor = "var(--color-primary, #2563eb)";
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = "var(--color-surface-container-low, #f9fafb)";
                  e.currentTarget.style.borderColor = "var(--color-border, #e5e7eb)";
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
              color: "var(--color-text-sub, #6b7280)",
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
                borderRadius: "8px",
                border: isDateValid || !startDate
                  ? "1px solid var(--color-border, #d1d5db)"
                  : "1px solid var(--color-error, #ef4444)",
                fontSize: "14px",
                background: disabled
                  ? "var(--color-surface-container-lowest, #ffffff)"
                  : "white",
                color: "var(--color-text-main, #111827)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "20px",
            color: "var(--color-text-sub, #6b7280)",
            fontSize: "14px",
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
              color: "var(--color-text-sub, #6b7280)",
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
                borderRadius: "8px",
                border: isDateValid || !endDate
                  ? "1px solid var(--color-border, #d1d5db)"
                  : "1px solid var(--color-error, #ef4444)",
                fontSize: "14px",
                background: disabled
                  ? "var(--color-surface-container-lowest, #ffffff)"
                  : "white",
                color: "var(--color-text-main, #111827)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
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
            color: "var(--color-text-sub, #6b7280)",
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
            color: "var(--color-error, #ef4444)",
            textAlign: "center",
          }}
        >
          開始日は終了日より前である必要があります
        </div>
      )}
    </div>
  );
};
