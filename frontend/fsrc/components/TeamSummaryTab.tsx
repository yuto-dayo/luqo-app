import React from "react";
import { Icon } from "./ui/Icon";
import { DateRangePicker } from "./DateRangePicker";
import type { LogSummaryResponse } from "../lib/api";
import styles from "./TeamSummaryTab.module.css";

type Props = {
  startDate: string;
  endDate: string;
  summary: LogSummaryResponse["summary"] | null;
  loading: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuickSelect: (days: number) => void;
  onLoadSummary: () => void;
};

/**
 * チーム要約タブコンポーネント
 */
export const TeamSummaryTab: React.FC<Props> = ({
  startDate,
  endDate,
  summary,
  loading,
  onStartDateChange,
  onEndDateChange,
  onQuickSelect,
  onLoadSummary,
}) => {
  return (
    <div className={styles.container}>
      {/* 期間選択 */}
      <div className={styles.dateSelector}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onQuickSelect={onQuickSelect}
          disabled={loading}
        />
        <button
          onClick={onLoadSummary}
          disabled={loading || !startDate || !endDate}
          className={styles.loadButton}
        >
          {loading ? "要約を生成中..." : "要約を生成"}
        </button>
      </div>

      {/* コンテンツエリア */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingDots}>
              <div className={styles.typingDot} style={{ animationDelay: "0s" }} />
              <div className={styles.typingDot} style={{ animationDelay: "0.2s" }} />
              <div className={styles.typingDot} style={{ animationDelay: "0.4s" }} />
            </div>
            <div className={styles.loadingText}>AIが要約を生成しています...</div>
          </div>
        ) : !summary ? (
          <div className={styles.empty}>
            期間を選択して「要約を生成」ボタンをクリックしてください
          </div>
        ) : (
          <>
            {/* 統計情報カード */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>統計情報</div>
              <div className={styles.statsGrid}>
                <div>
                  <div className={styles.statLabel}>総ログ件数</div>
                  <div className={styles.statValue}>{summary.statistics.totalLogs}</div>
                </div>
                <div>
                  <div className={styles.statLabel}>参加人数</div>
                  <div className={styles.statValue}>{summary.statistics.uniqueUsers}</div>
                </div>
                <div>
                  <div className={styles.statLabel}>期間</div>
                  <div className={styles.statValueSmall}>
                    {summary.statistics.dateRange.days}日間
                  </div>
                </div>
                {summary.statistics.mostActiveDay && (
                  <div>
                    <div className={styles.statLabel}>最も活発な日</div>
                    <div className={styles.statValueSmall}>
                      {summary.statistics.mostActiveDay.date}
                      <br />
                      {summary.statistics.mostActiveDay.count}件
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 要約カード */}
            {summary.overview && (
              <div className={styles.overviewCard}>
                <div className={styles.overviewTitle}>期間総括</div>
                <div className={styles.overviewText}>{summary.overview}</div>
              </div>
            )}

            {/* インサイト */}
            {summary.insights && summary.insights.length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardTitleWithIcon}>
                  <Icon name="thinking" size={16} />
                  インサイト
                </div>
                <ul className={styles.list}>
                  {summary.insights.map((insight, idx) => (
                    <li key={idx} className={styles.listItem}>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ハイライト */}
            {summary.highlights && summary.highlights.length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardTitleWithIcon}>
                  <Icon name="fire" size={16} />
                  ハイライト
                </div>
                <ul className={styles.list}>
                  {summary.highlights.map((highlight, idx) => (
                    <li key={idx} className={styles.listItem}>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* アクティブユーザー */}
            {summary.statistics.topUsers && summary.statistics.topUsers.length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardTitle}>アクティブユーザー（上位5名）</div>
                <div className={styles.usersList}>
                  {summary.statistics.topUsers.map((user, idx) => (
                    <div key={user.userId} className={styles.userRow}>
                      <div className={styles.userName}>
                        {idx + 1}. {user.userName || user.userId}
                      </div>
                      <div className={styles.userCount}>{user.count}件</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

