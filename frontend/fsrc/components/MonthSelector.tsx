import React from "react";

type Props = {
  currentMonth: string;
  onChange: (month: string) => void;
};

export const MonthSelector: React.FC<Props> = ({ currentMonth, onChange }) => {
  // "2025-10" -> date obj
  const date = new Date(`${currentMonth}-01`);

  const handlePrev = () => {
    const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    onChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNext = () => {
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  // 今月より未来には行けないようにする制御（お好みで）
  const now = new Date();
  const isFuture = date.getFullYear() > now.getFullYear() ||
    (date.getFullYear() === now.getFullYear() && date.getMonth() >= now.getMonth());

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f1f5f9", padding: "4px 12px", borderRadius: "99px" }}>
      <button
        onClick={handlePrev}
        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px", padding: "4px 8px", transition: "opacity var(--motion-duration) var(--motion-easing)" }}
      >
        ←
      </button>

      <span style={{ fontSize: "14px", fontWeight: "600", color: "#334155", minWidth: "80px", textAlign: "center" }}>
        {date.getFullYear()}年{date.getMonth() + 1}月
      </span>

      <button
        onClick={handleNext}
        disabled={isFuture}
        style={{
          border: "none",
          background: "transparent",
          cursor: isFuture ? "default" : "pointer",
          fontSize: "16px",
          padding: "4px 8px",
          opacity: isFuture ? 0.3 : 1,
          transition: "opacity var(--motion-duration) var(--motion-easing)"
        }}
      >
        →
      </button>
    </div>
  );
};
