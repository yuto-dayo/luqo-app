import React from "react";
import { Icon } from "./ui/Icon";
import { PersonalLogTab } from "./PersonalLogTab";
import { TeamSummaryTab } from "./TeamSummaryTab";
import type { LogHistoryItem, LogSummaryResponse } from "../lib/api";
import styles from "./LogHistoryModal.module.css";

type Tab = "personal" | "team";

type Props = {
  isOpen: boolean;
  isMobile: boolean;
  tab: Tab;
  onClose: () => void;
  onTabChange: (tab: Tab) => void;
  // 個人ログ関連
  selectedMonth: string;
  logHistory: LogHistoryItem[];
  logHistoryLoading: boolean;
  onMonthChange: (month: string) => void;
  // チーム要約関連
  summaryStartDate: string;
  summaryEndDate: string;
  logSummary: LogSummaryResponse["summary"] | null;
  logSummaryLoading: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuickSelect: (days: number) => void;
  onLoadSummary: () => void;
};

/**
 * 過去ログ表示モーダルコンポーネント
 */
export const LogHistoryModal: React.FC<Props> = ({
  isOpen,
  isMobile,
  tab,
  onClose,
  onTabChange,
  selectedMonth,
  logHistory,
  logHistoryLoading,
  onMonthChange,
  summaryStartDate,
  summaryEndDate,
  logSummary,
  logSummaryLoading,
  onStartDateChange,
  onEndDateChange,
  onQuickSelect,
  onLoadSummary,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div onClick={onClose} className={styles.overlay} />

      {/* モーダル */}
      <div className={styles.modal}>
        {/* ヘッダー */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Icon name="book" size={24} color="var(--color-seed, #2563eb)" />
            <div className={styles.headerTitle}>過去ログ</div>
          </div>
          <button onClick={onClose} className={styles.closeButton} title="閉じる">
            <Icon name="close" size={24} />
          </button>
        </div>

        {/* タブUI */}
        <div className={styles.tabs}>
          <button
            onClick={() => onTabChange("personal")}
            className={`${styles.tab} ${tab === "personal" ? styles.activeTab : ""}`}
          >
            個人ログ
          </button>
          <button
            onClick={() => onTabChange("team")}
            className={`${styles.tab} ${tab === "team" ? styles.activeTab : ""}`}
          >
            チーム要約
          </button>
        </div>

        {/* コンテンツ */}
        {tab === "personal" ? (
          <PersonalLogTab
            selectedMonth={selectedMonth}
            logHistory={logHistory}
            loading={logHistoryLoading}
            onMonthChange={onMonthChange}
          />
        ) : (
          <TeamSummaryTab
            startDate={summaryStartDate}
            endDate={summaryEndDate}
            summary={logSummary}
            loading={logSummaryLoading}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
            onQuickSelect={onQuickSelect}
            onLoadSummary={onLoadSummary}
          />
        )}
      </div>
    </>
  );
};

