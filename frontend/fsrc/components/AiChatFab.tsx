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

  // ドラッグ機能 (開いているときは無効、モバイルでも有効)
  const { position, isDocked, dockSide, isAnimating, ref: fabRef, undock, handlers } = useDraggable({
    onClick: () => setIsOpen((prev) => !prev), // デフォルトの動作（後でラップする）
    disabled: isOpen, // モバイルでもドラッグ可能にする
    initialPosition: { x: window.innerWidth - 80, y: window.innerHeight - 136 }, // ボタン1個分（56px）上に移動
    snapMargin: 16,
  });

  // クリックハンドラをラップ：格納状態の時は格納を解除、そうでなければチャットを開く
  const handleFabClick = (e: React.MouseEvent) => {
    if (isDocked) {
      undock();
    } else {
      handlers.onClick(e);
    }
  };

  // FABのクラス名を決定（格納状態を考慮）
  const fabClassName = `${styles.fab} ${isMobile ? styles.fabMobile : styles.fabDesktop} ${isDocked ? styles.docked : ""} ${isDocked && dockSide ? styles[`docked${dockSide.charAt(0).toUpperCase() + dockSide.slice(1)}`] : ""} ${isAnimating ? styles.animating : ""}`;

  // 位置スタイル（ドラッグ位置を反映、モバイルでも適用）
  const positionStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
  };

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
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerCancel}
          onClick={handleFabClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={fabClassName}
          style={positionStyle}
          aria-label={isDocked ? "格納を解除" : "チャットを開く"}
        >
          <Icon name="chat" size={isDocked ? 20 : 28} color={iconColor} />
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
