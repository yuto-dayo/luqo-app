import React from "react";
import { Icon } from "./ui/Icon";
import type { ChatMode } from "../hooks/useAiChat";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import styles from "./ChatHeader.module.css";

type Props = {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onClose: () => void;
  isMobile: boolean;
};

/**
 * チャットウィンドウのヘッダーコンポーネント
 * モード切り替えと閉じるボタンを含む
 */
export const ChatHeader: React.FC<Props> = ({ mode, onModeChange, onClose, isMobile }) => {
  const isRetroGameMode = useRetroGameMode();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.iconWrapper}>
          <Icon
            name={mode === "chat" ? "robot" : "edit"}
            size={24}
            color={isRetroGameMode ? "#00ffff" : "var(--color-seed, #2563eb)"}
          />
        </div>
        <div>
          <div className={styles.title}>
            {mode === "chat" ? "LUQO AI Coach" : "クイックログ"}
          </div>
          <div className={styles.subtitle}>
            {mode === "chat" ? "Consultant Agent" : "即座にログを記録"}
          </div>
        </div>
      </div>
      <div className={styles.right}>
        {/* モード切り替えトグル */}
        <div className={styles.modeToggle}>
          <button
            onClick={() => onModeChange("chat")}
            title="チャット"
            className={`${styles.modeButton} ${mode === "chat" ? styles.modeButtonActive : ""}`}
          >
            <Icon
              name="chat"
              size={isMobile ? 18 : 20}
              color={
                isRetroGameMode
                  ? mode === "chat"
                    ? "#0a0a0f"
                    : "#00ffff"
                  : mode === "chat"
                  ? "white"
                  : "var(--color-text-sub, #6b7280)"
              }
            />
          </button>
          <button
            onClick={() => onModeChange("quick-log")}
            title="即ログ"
            className={`${styles.modeButton} ${mode === "quick-log" ? styles.modeButtonActive : ""}`}
          >
            <Icon
              name="edit"
              size={isMobile ? 18 : 20}
              color={
                isRetroGameMode
                  ? mode === "quick-log"
                    ? "#0a0a0f"
                    : "#00ffff"
                  : mode === "quick-log"
                  ? "white"
                  : "var(--color-text-sub, #6b7280)"
              }
            />
          </button>
        </div>
        <button onClick={onClose} className={styles.closeButton} title="閉じる">
          <Icon name="close" size={24} color={isRetroGameMode ? "#00ffff" : undefined} />
        </button>
      </div>
    </div>
  );
};

