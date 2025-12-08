import React, { useState, useEffect } from "react";
import { useDraggable } from "../hooks/useDraggable";
import { useAiChat } from "../hooks/useAiChat";
import { useResponsive } from "../hooks/useResponsive";
import { useModal } from "../contexts/ModalContext";
import { ChatWindow } from "./ChatWindow";
import { LogHistoryModal } from "./LogHistoryModal";
import { Icon } from "./ui/Icon";
import styles from "./AiChatFab.module.css";

/**
 * AIチャットFABコンポーネント
 * FABボタンとチャットウィンドウの統合コンポーネント
 */
export const AiChatFab: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    mode,
    setMode,
    input,
    loading,
    messages,
    isSuccess,
    scrollRef,
    inputRef,
    mentionQuery,
    filteredUsers,
    handleInputChange,
    insertMention,
    handleSend,
    handleFetchLogs,
    isLogHistoryOpen,
    setIsLogHistoryOpen,
    logHistory,
    logHistoryLoading,
    selectedMonth,
    handleMonthChange,
    logSummaryTab,
    setLogSummaryTab,
    summaryStartDate,
    setSummaryStartDate,
    summaryEndDate,
    setSummaryEndDate,
    logSummary,
    logSummaryLoading,
    loadLogSummary,
    handleQuickSelectDays,
    handleSaveAndEnd,
  } = useAiChat();

  const { isMobile, isTablet } = useResponsive();
  const { isAnyModalOpen } = useModal();
  
  // レトロゲームモードの検出
  const [isRetroGameMode, setIsRetroGameMode] = useState(false);
  
  useEffect(() => {
    const checkRetroMode = () => {
      setIsRetroGameMode(document.body.classList.contains("retro-game"));
    };
    
    // 初回チェック
    checkRetroMode();
    
    // MutationObserverでbodyクラスの変更を監視
    const observer = new MutationObserver(checkRetroMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    
    return () => observer.disconnect();
  }, []);

  // ドラッグ機能 (PCのみ有効、開いているときは無効)
  const { position, ref: fabRef, handlers } = useDraggable({
    onClick: () => setIsOpen((prev) => !prev),
    disabled: isOpen || isMobile,
    initialPosition: { x: window.innerWidth - 80, y: window.innerHeight - 80 },
  });

  // FABのクラス名を決定
  const fabClassName = `${styles.fab} ${isMobile ? styles.fabMobile : styles.fabDesktop}`;

  // PC用の位置スタイル（ドラッグ位置を反映）
  const desktopPositionStyle = !isMobile
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : undefined;

  // レトロゲームモードではアイコンをシアンに（ホバー時はダーク）
  const [isHovered, setIsHovered] = useState(false);
  const iconColor = isRetroGameMode 
    ? (isHovered ? "#0a0a0f" : "#00ffff")
    : "var(--color-on-seed, #ffffff)";

  return (
    <>
      {/* FAB Button - モーダルが開いている時は非表示 */}
      {(!isOpen || !isMobile) && !isAnyModalOpen && (
        <button
          ref={fabRef}
          onPointerDown={!isMobile ? handlers.onPointerDown : undefined}
          onPointerMove={!isMobile ? handlers.onPointerMove : undefined}
          onPointerUp={!isMobile ? handlers.onPointerUp : undefined}
          onClick={isMobile ? () => setIsOpen(true) : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={fabClassName}
          style={desktopPositionStyle}
        >
          <Icon name="chat" size={28} color={iconColor} />
        </button>
      )}

      {/* Mobile Overlay */}
      {isOpen && isMobile && (
        <div onClick={() => setIsOpen(false)} className={styles.overlay} />
      )}

      {/* Chat Window */}
      <ChatWindow
        isOpen={isOpen}
        mode={mode}
        messages={messages}
        input={input}
        loading={loading}
        isSuccess={isSuccess}
        mentionQuery={mentionQuery}
        filteredUsers={filteredUsers}
        position={position}
        isMobile={isMobile}
        isTablet={isTablet}
        scrollRef={scrollRef}
        inputRef={inputRef}
        onModeChange={setMode}
        onClose={() => setIsOpen(false)}
        onInputChange={handleInputChange}
        onInsertMention={insertMention}
        onSend={handleSend}
        onFetchLogs={handleFetchLogs}
        onSaveAndEnd={handleSaveAndEnd}
      />

      {/* Log History Modal */}
      <LogHistoryModal
        isOpen={isLogHistoryOpen}
        isMobile={isMobile}
        tab={logSummaryTab}
        onClose={() => setIsLogHistoryOpen(false)}
        onTabChange={setLogSummaryTab}
        selectedMonth={selectedMonth}
        logHistory={logHistory}
        logHistoryLoading={logHistoryLoading}
        onMonthChange={handleMonthChange}
        summaryStartDate={summaryStartDate}
        summaryEndDate={summaryEndDate}
        logSummary={logSummary}
        logSummaryLoading={logSummaryLoading}
        onStartDateChange={setSummaryStartDate}
        onEndDateChange={setSummaryEndDate}
        onQuickSelect={handleQuickSelectDays}
        onLoadSummary={() => loadLogSummary(summaryStartDate, summaryEndDate)}
      />
    </>
  );
};
