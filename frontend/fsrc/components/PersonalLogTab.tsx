import React from "react";
import type { LogHistoryItem } from "../lib/api";
import styles from "./PersonalLogTab.module.css";

type Props = {
  selectedMonth: string;
  logHistory: LogHistoryItem[];
  loading: boolean;
  onMonthChange: (month: string) => void;
};

/**
 * 個人ログタブコンポーネント
 */
export const PersonalLogTab: React.FC<Props> = ({
  selectedMonth,
  logHistory,
  loading,
  onMonthChange,
}) => {
  return (
    <>
      {/* 月選択 */}
      <div className={styles.monthSelector}>
        <label className={styles.label}>月を選択</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className={styles.monthInput}
        />
      </div>

      {/* ログ一覧 */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.typingDot} style={{ animationDelay: "0s" }} />
            <div className={styles.typingDot} style={{ animationDelay: "0.2s" }} />
            <div className={styles.typingDot} style={{ animationDelay: "0.4s" }} />
          </div>
        ) : logHistory.length === 0 ? (
          <div className={styles.empty}>この月のログはありません</div>
        ) : (
          logHistory.map((log) => (
            <div key={log.id} className={styles.logItem}>
              <div className={styles.date}>
                {new Date(log.createdAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className={styles.text}>{log.text}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

