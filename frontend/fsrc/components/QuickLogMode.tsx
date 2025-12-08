import React from "react";
import { Icon } from "./ui/Icon";
import styles from "./QuickLogMode.module.css";

/**
 * クイックログモードの表示コンポーネント
 */
export const QuickLogMode: React.FC = () => {
  return (
    <div className={styles.container}>
      <Icon name="edit" size={48} color="var(--color-text-sub, #6b7280)" />
      <div className={styles.message}>
        作業内容を入力して送信すると、<br />
        すぐにログとして保存されます。
      </div>
    </div>
  );
};

