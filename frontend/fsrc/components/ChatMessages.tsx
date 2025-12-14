import React from "react";
import { Icon } from "./ui/Icon";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import styles from "./ChatMessages.module.css";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type Props = {
  messages: Message[];
  loading: boolean;
  onSaveAndEnd: (text: string) => void;
  isMobile: boolean;
};

/**
 * チャットメッセージ表示コンポーネント
 */
export const ChatMessages: React.FC<Props> = ({ messages, loading, onSaveAndEnd, isMobile }) => {
  const isRetroGameMode = useRetroGameMode();

  return (
    <div className={styles.messagesArea}>
      {messages.map((m, i) => (
        <div
          key={i}
          className={`${styles.messageWrapper} ${m.role === "user" ? styles.userMessage : styles.assistantMessage}`}
        >
          <div className={styles.messageRow}>
            {m.role === "assistant" && (
              <div className={styles.avatar}>
                <Icon name="robot" size={16} color={isRetroGameMode ? "#00ffff" : "var(--color-text-sub, #6b7280)"} />
              </div>
            )}
            <div className={`${styles.bubble} ${m.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
              {m.text}
            </div>
          </div>
          {/* AIの返答に「ログに追加して終了」ボタンを表示 */}
          {m.role === "assistant" && i > 0 && (
            <button
              onClick={() => onSaveAndEnd(m.text)}
              disabled={loading}
              className={styles.saveButton}
            >
              <Icon name="check" size={16} color={isRetroGameMode ? "#0a0a0f" : "white"} />
              <span>ログに追加して終了</span>
            </button>
          )}
        </div>
      ))}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.typingDot} style={{ animationDelay: "0s" }} />
          <div className={styles.typingDot} style={{ animationDelay: "0.2s" }} />
          <div className={styles.typingDot} style={{ animationDelay: "0.4s" }} />
        </div>
      )}
    </div>
  );
};

