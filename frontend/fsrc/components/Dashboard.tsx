import React, { useState } from "react";
import { useMonth, useSetMonth } from "../hooks/useLuqoStore";
import { useDynamicTheme } from "../hooks/useDynamicTheme";
import { useDashboardData } from "../hooks/useDashboardData";
import { AiChatFab } from "./AiChatFab";
import { FocusCard } from "./FocusCard";
import { LuqoSummary } from "./LuqoSummary";
import { TScoreSummary } from "./TScoreSummary";
import { KpiPanel } from "./KpiPanel";
import { PaymasterCard } from "./PaymasterCard";
import { StarApprovalModal } from "./StarApprovalModal";
import { OkrApprovalModal } from "./OkrApprovalModal";
import { MonthSelector } from "./MonthSelector";
import { GuardianBadge } from "./ui/GuardianBadge";
import styles from "./Dashboard.module.css";

export const Dashboard: React.FC = () => {
  const month = useMonth();
  const setMonth = useSetMonth();

  // ロジックはこれ一行で完結
  const { score, fetchScore, banditData, banditLoading, rawScore, pendingStars, greeting, headlineColor, historyBumpId, refreshBanditData } = useDashboardData();

  // テーマ適用などの副作用
  useDynamicTheme(score);

  // 報酬シミュレーターの表示切り替え
  const [showTools, setShowTools] = useState(false);

  // 初回マウント時や月変更時にスコアを取得 (useDashboardData内ではなくここで呼ぶか、hookに任せるか。
  // 元のコードでは useEffect(() => { void fetchScore(); }, [month, fetchScore]); があった。
  // useDashboardDataにはfetchScoreが含まれているが、呼び出しはしていない。
  // ここで呼び出す必要がある。
  React.useEffect(() => {
    void fetchScore();
  }, [month, fetchScore]);

  return (
    <div className={styles.container}>
      {/* 承認待ちがある場合は操作をブロックするモーダルを表示 */}
      <StarApprovalModal />
      <OkrApprovalModal />

      <AiChatFab />

      {/* ★刷新されたコンパクトヘッダー */}
      <header className={styles.compactHeader}>
        {/* 月選択を中央に配置 */}
        <div className={styles.monthSelectorWrapper}>
          <MonthSelector currentMonth={month} onChange={setMonth} />
        </div>
      </header>

      {/* 1. Hero Section: Focus (Actionable) */}
      {/* FocusCardは最も重要なので、単独で目立たせる */}
      <div className={styles.heroSection}>
        <FocusCard 
          scoreReady={true} 
          banditData={banditData} 
          loading={banditLoading}
          onMissionUpdated={refreshBanditData}
        />
      </div>

      {/* 2. Stats Section: Metrics (Glanceable) */}
      {/* スコア系は並列に並べて比較しやすくする */}
      <h2 className={styles.sectionTitle}>Your Progress</h2>
      <div className={styles.statsGrid}>
        <div className={styles.cardWrapper}>
          <LuqoSummary score={score} activeDimension={banditData?.focusDimension as "LU" | "Q" | "O" | undefined} />

          {/* ★ここにバッジを追加 */}
          {score.adjustments && (
            <div className={styles.guardianBadgeWrapper}>
              <GuardianBadge delta={score.adjustments.delta} />
            </div>
          )}
        </div>
        <div className={styles.cardWrapper}>
          <TScoreSummary currentStars={rawScore} pendingStars={pendingStars} />
        </div>
      </div>

      {/* 3. Context Section: KPI */}
      <h2 className={styles.sectionTitle}>Team Goal (Quality First)</h2>
      <KpiPanel banditData={banditData} loading={banditLoading} />

      {/* 4. Tools Section: Simulator (Collapsible) */}
      {/* 頻度の低いツールは隠す */}
      <div className={styles.toolsContainer}>
        <button
          onClick={() => setShowTools(!showTools)}
          className={styles.toolToggle}
        >
          {showTools ? "ツールを隠す" : "報酬シミュレーターを使う"}
          <span style={{ transform: showTools ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }}>▼</span>
        </button>

        {showTools && (
          <div className={styles.fadeIn}>
            <PaymasterCard


              currentStars={rawScore}
            />
          </div>
        )}
      </div>
    </div>
  );
};

