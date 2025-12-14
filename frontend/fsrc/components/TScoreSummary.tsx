import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./ui/Icon";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import styles from "./TScoreSummary.module.css";

type TScoreSummaryProps = {
  currentStars: number;
  pendingStars?: string[]; // useDashboardDataから取得したpending情報を受け取る
};

export const TScoreSummary: React.FC<TScoreSummaryProps> = ({ currentStars, pendingStars = [] }) => {
  const isRetroGameMode = useRetroGameMode();
  const navigate = useNavigate();

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.labelGroup}>
          <p className={styles.label}>Technical Score</p>
          <h2 className={styles.title}>技術スター数</h2>
        </div>
        <div className={styles.levelBadge}>
          Lv. {Math.floor(currentStars / 10)}
        </div>
      </header>

      <div className={styles.scoreSection}>
        <span className={styles.currentScore}>{currentStars}</span>
        <span className={styles.maxScore}>/ 170 pt</span>
      </div>

      <div className={styles.statusSection}>
        {pendingStars && pendingStars.length > 0 ? (
          <div className={styles.pendingList}>
            {pendingStars.map((starId: string) => (
              <div key={starId} className={styles.pendingItem}>
                <Icon name="star" size={14} color={isRetroGameMode ? "#ff00ff" : "#f59e0b"} />
                <span>{starId.replace("star-", "").toUpperCase()} 審査中</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Icon name="check" size={14} color={isRetroGameMode ? "#00ff88" : undefined} />
            <span>現在申請中のスキルはありません</span>
          </div>
        )}

        <button
          onClick={() => navigate("/tscore")}
          className={styles.detailButton}
        >
          詳細・スター申請 <Icon name="pen" size={12} color={isRetroGameMode ? "#00ffff" : undefined} />
        </button>
      </div>
    </section>
  );
};
