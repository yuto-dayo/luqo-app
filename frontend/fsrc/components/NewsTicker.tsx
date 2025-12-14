import React from "react";
import styles from "./NewsTicker.module.css";

type Props = {
  news: string[];
  loading: boolean;
  isMobile: boolean;
};

/**
 * AIニュースチッカーコンポーネント
 * 過去1週間のログ情報を横スクロールアニメーションで表示
 */
export const NewsTicker: React.FC<Props> = ({ news, loading, isMobile }) => {
  if (news.length === 0) return null;

  return (
    <div
      className={styles.ticker}
      style={{
        padding: isMobile ? "10px 12px" : "12px 16px",
      }}
    >
      {/* 点滅するインジケーター */}
      <div className={styles.indicator}>
        <div className={styles.blinkDot} />
        <span className={styles.label}>AI news</span>
      </div>

      {/* チッカーメッセージ部分 */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.typingDot} style={{ animationDelay: "0s" }} />
            <div className={styles.typingDot} style={{ animationDelay: "0.2s" }} />
            <div className={styles.typingDot} style={{ animationDelay: "0.4s" }} />
          </div>
        ) : (
          <div className={styles.tickerContainer}>
            <div className={styles.tickerContent}>
              {news.map((item, index) => (
                <span key={index} className={styles.tickerItem}>
                  {item}
                </span>
              ))}
              {/* シームレスなループのために同じコンテンツを2回繰り返す */}
              {news.map((item, index) => (
                <span key={`duplicate-${index}`} className={styles.tickerItem}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

