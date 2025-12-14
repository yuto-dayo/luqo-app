import React from "react";
import { Icon } from "./ui/Icon";
import type { ChatMode } from "../hooks/useAiChat";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import styles from "./ChatInput.module.css";

type Props = {
  mode: ChatMode;
  input: string;
  loading: boolean;
  isSuccess: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFetchLogs?: () => void;
  isMobile: boolean;
};

/**
 * チャット入力エリアコンポーネント
 */
export const ChatInput: React.FC<Props> = ({
  mode,
  input,
  loading,
  isSuccess,
  inputRef,
  onChange,
  onSubmit,
  onFetchLogs,
  isMobile,
}) => {
  const isRetroGameMode = useRetroGameMode();

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {/* チャットモードのみ履歴ボタンを表示 */}
      {mode === "chat" && onFetchLogs && (
        <button
          type="button"
          onClick={onFetchLogs}
          disabled={loading}
          className={styles.historyButton}
          title="履歴を参照"
        >
          <Icon name="book" size={20} color={isRetroGameMode ? "#00ffff" : "var(--color-text-main, #111827)"} />
        </button>
      )}

      <input
        ref={inputRef}
        value={input}
        onChange={onChange}
        placeholder={mode === "chat" ? "メッセージを入力..." : "作業内容を入力して送信..."}
        className={styles.input}
        style={
          isRetroGameMode
            ? undefined
            : {
                background: isSuccess ? "#dcfce7" : "white",
              }
        }
      />
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className={styles.submitButton}
        style={
          isRetroGameMode
            ? undefined
            : {
                background: mode === "quick-log" && input.trim() ? "var(--color-seed, #2563eb)" : "transparent",
                color: mode === "quick-log" && input.trim() ? "white" : "var(--color-seed, #2563eb)",
              }
        }
      >
        <Icon
          name={mode === "quick-log" ? "check" : "sendPlane"}
          size={24}
          color={isRetroGameMode ? "#00ffff" : undefined}
        />
      </button>
    </form>
  );
};

