import React from "react";
import { Icon } from "./ui/Icon";
import styles from "./MonthSelector.module.css";

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

  // 今月より未来には行けないようにする制御
  const now = new Date();
  const isFuture = date.getFullYear() > now.getFullYear() ||
    (date.getFullYear() === now.getFullYear() && date.getMonth() >= now.getMonth());

  return (
    <div className={styles.container}>
      <button
        onClick={handlePrev}
        className={styles.button}
        aria-label="前の月"
      >
        <Icon name="arrowLeft" size={20} />
      </button>

      <span className={styles.monthText}>
        {date.getFullYear()}年{date.getMonth() + 1}月
      </span>

      <button
        onClick={handleNext}
        disabled={isFuture}
        className={`${styles.button} ${styles.buttonRight}`}
        aria-label="次の月"
      >
        <Icon name="arrowLeft" size={20} />
      </button>
    </div>
  );
};
