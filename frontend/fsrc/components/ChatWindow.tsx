import React, { useEffect, useState } from "react";
import { NewsTicker } from "./NewsTicker";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { QuickLogMode } from "./QuickLogMode";
import { MentionList } from "./MentionList";
import { useNewsTicker } from "../hooks/useNewsTicker";
import type { ChatMode } from "../hooks/useAiChat";
import styles from "./ChatWindow.module.css";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type User = {
  id: string;
  name: string;
};

type Props = {
  isOpen: boolean;
  mode: ChatMode;
  messages: Message[];
  input: string;
  loading: boolean;
  isSuccess: boolean;
  mentionQuery: string | null;
  filteredUsers: User[];
  position: { x: number; y: number };
  isMobile: boolean;
  isTablet: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  onModeChange: (mode: ChatMode) => void;
  onClose: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInsertMention: (userId: string) => void;
  onSend: (e: React.FormEvent) => void;
  onFetchLogs?: () => void;
  onSaveAndEnd: (text: string) => void;
};

/**
 * チャットウィンドウコンポーネント
 * チャット機能全体を統合するコンテナ
 */
export const ChatWindow: React.FC<Props> = ({
  isOpen,
  mode,
  messages,
  input,
  loading,
  isSuccess,
  mentionQuery,
  filteredUsers,
  position,
  isMobile,
  isTablet,
  scrollRef,
  inputRef,
  onModeChange,
  onClose,
  onInputChange,
  onInsertMention,
  onSend,
  onFetchLogs,
  onSaveAndEnd,
}) => {
  const { weeklyLogNews, weeklyLogLoading } = useNewsTicker(isOpen);
  // キーボードの高さを管理するステート
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // モバイルでキーボードの高さを検出
  useEffect(() => {
    if (!isMobile || !isOpen) {
      setKeyboardHeight(0);
      return;
    }

    // visualViewport APIが利用可能な場合
    if (window.visualViewport) {
      const updateKeyboardHeight = () => {
        const viewport = window.visualViewport;
        if (viewport) {
          // キーボードの高さ = 画面の高さ - ビューポートの高さ
          const height = window.innerHeight - viewport.height;
          setKeyboardHeight(Math.max(0, height));

          // キーボードが開いた時にメッセージエリアをスクロール
          if (height > 0 && scrollRef.current) {
            setTimeout(() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }, 100);
          }
        }
      };

      // 初回計算
      updateKeyboardHeight();

      // リサイズイベントを監視
      window.visualViewport.addEventListener("resize", updateKeyboardHeight);
      window.visualViewport.addEventListener("scroll", updateKeyboardHeight);

      return () => {
        window.visualViewport?.removeEventListener("resize", updateKeyboardHeight);
        window.visualViewport?.removeEventListener("scroll", updateKeyboardHeight);
      };
    } else {
      // visualViewport APIが利用できない場合のフォールバック
      // 入力フィールドにフォーカスが当たった時にキーボードが開いたと仮定
      const handleFocus = () => {
        // 少し遅延させてキーボードが開くのを待つ
        setTimeout(() => {
          const height = window.innerHeight * 0.4; // 推定値（画面の40%）
          setKeyboardHeight(height);

          // メッセージエリアをスクロール
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 300);
      };

      const handleBlur = () => {
        setTimeout(() => {
          setKeyboardHeight(0);
        }, 100);
      };

      const inputElement = inputRef.current;
      if (inputElement) {
        inputElement.addEventListener("focus", handleFocus);
        inputElement.addEventListener("blur", handleBlur);
      }

      return () => {
        if (inputElement) {
          inputElement.removeEventListener("focus", handleFocus);
          inputElement.removeEventListener("blur", handleBlur);
        }
      };
    }
  }, [isMobile, isOpen, inputRef, scrollRef]);

  if (!isOpen) return null;

  // レスポンシブスタイルの決定
  const containerClassName = isMobile
    ? `${styles.container} ${styles.mobileWindow}`
    : isTablet
    ? `${styles.container} ${styles.tabletWindow}`
    : `${styles.container} ${styles.desktopWindow}`;

  // 位置調整用のインラインスタイル
  const positionStyle =
    !isMobile
      ? {
          left: isTablet
            ? Math.min(position.x - 280, window.innerWidth - 340)
            : Math.min(position.x - 300, window.innerWidth - 370),
          top: isTablet
            ? Math.min(position.y - 450, window.innerHeight - 480)
            : Math.min(position.y - 500, window.innerHeight - 520),
        }
      : {
          // モバイルの場合、キーボードの高さに応じてbottomを調整
          bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : "0",
          height: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px)` : "85vh",
        };

  return (
    <div className={containerClassName} style={positionStyle}>
      {/* AI News Ticker */}
      {weeklyLogNews.length > 0 && (
        <NewsTicker news={weeklyLogNews} loading={weeklyLogLoading} isMobile={isMobile} />
      )}

      {/* Header */}
      <ChatHeader
        mode={mode}
        onModeChange={onModeChange}
        onClose={onClose}
        isMobile={isMobile}
      />

      {/* Messages Area */}
      <div ref={scrollRef} className={styles.messagesContainer}>
        {mode === "quick-log" ? (
          <QuickLogMode />
        ) : (
          <ChatMessages
            messages={messages}
            loading={loading}
            onSaveAndEnd={onSaveAndEnd}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Suggestion / Mention List */}
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <MentionList users={filteredUsers} onSelect={onInsertMention} />
      )}

      {/* Input Area */}
      <ChatInput
        mode={mode}
        input={input}
        loading={loading}
        isSuccess={isSuccess}
        inputRef={inputRef}
        onChange={onInputChange}
        onSubmit={onSend}
        onFetchLogs={onFetchLogs}
        isMobile={isMobile}
      />
    </div>
  );
};
