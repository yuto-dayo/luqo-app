import React, { useState, useEffect } from "react";
import { useDraggable } from "../hooks/useDraggable";
import { useAiChat } from "../hooks/useAiChat";
import { useDashboardData } from "../hooks/useDashboardData";
import { Icon } from "./ui/Icon"; // Iconコンポーネントがあれば活用
import { fetchNews } from "../lib/api";
import { DateRangePicker } from "./DateRangePicker";

export const AiChatFab: React.FC = () => {
  // AI Statusメッセージを取得
  const { greeting } = useDashboardData();
  
  // 過去1週間の全員のログを取得してニュース表示用に要約
  const [weeklyLogNews, setWeeklyLogNews] = useState<string[]>([]);
  const [weeklyLogLoading, setWeeklyLogLoading] = useState(false);
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
    // 過去ログ関連
    isLogHistoryOpen,
    setIsLogHistoryOpen,
    logHistory,
    logHistoryLoading,
    selectedMonth,
    handleMonthChange,
    // チーム要約関連
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
    // ログ保存して終了
    handleSaveAndEnd,
  } = useAiChat();

  // 画面幅チェック (レスポンシブ判定)
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkResponsive = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 640);
      setIsTablet(width > 640 && width <= 1024);
    };
    checkResponsive();
    window.addEventListener("resize", checkResponsive);
    return () => window.removeEventListener("resize", checkResponsive);
  }, []);

  // 過去1週間の全員のログを取得してニュース表示用に要約（2日に1回更新）
  useEffect(() => {
    const loadWeeklyLogs = async () => {
      // 最後の更新日時をチェック（2日に1回更新）
      const lastUpdateKey = "ai_news_last_update";
      const lastUpdate = localStorage.getItem(lastUpdateKey);
      const now = Date.now();
      const twoDaysInMs = 2 * 24 * 60 * 60 * 1000; // 2日をミリ秒に変換
      
      // キャッシュされたデータがあるかチェック
      const cachedNewsKey = "ai_news_cached";
      const cachedNews = localStorage.getItem(cachedNewsKey);
      
      // 2日以内に更新済みで、キャッシュがある場合はそれを使用
      if (lastUpdate && cachedNews) {
        const lastUpdateTime = parseInt(lastUpdate, 10);
        if (now - lastUpdateTime < twoDaysInMs) {
          try {
            const parsed = JSON.parse(cachedNews);
            setWeeklyLogNews(parsed);
            return; // キャッシュを使用して終了
          } catch (e) {
            console.warn("Failed to parse cached news", e);
          }
        }
      }
      
      // データを取得（プロンプトベースのAI生成）
      setWeeklyLogLoading(true);
      try {
        const res = await fetchNews(7);
        
        if (!res.ok || !res.newsItems || res.newsItems.length === 0) {
          const fallbackNews = ["過去1週間のログはありません"];
          setWeeklyLogNews(fallbackNews);
          localStorage.setItem(cachedNewsKey, JSON.stringify(fallbackNews));
          localStorage.setItem(lastUpdateKey, now.toString());
          return;
        }
        
        const finalNews = res.newsItems;
        setWeeklyLogNews(finalNews);
        
        // キャッシュに保存
        localStorage.setItem(cachedNewsKey, JSON.stringify(finalNews));
        localStorage.setItem(lastUpdateKey, now.toString());
      } catch (err) {
        console.error("Failed to load news", err);
        const errorNews = ["ニュースの取得に失敗しました"];
        setWeeklyLogNews(errorNews);
        // エラー時もキャッシュに保存（次回のリトライを防ぐ）
        localStorage.setItem(cachedNewsKey, JSON.stringify(errorNews));
        localStorage.setItem(lastUpdateKey, now.toString());
      } finally {
        setWeeklyLogLoading(false);
      }
    };
    
    // チャットが開いている時のみログを取得
    if (isOpen) {
      void loadWeeklyLogs();
    }
  }, [isOpen]);

  // ドラッグ機能 (PCのみ有効、開いているときは無効)
  // スマホでは常にドラッグ無効
  const { position, ref: fabRef, handlers } = useDraggable({
    onClick: () => setIsOpen((prev) => !prev),
    disabled: isOpen || isMobile,
    initialPosition: { x: window.innerWidth - 80, y: window.innerHeight - 80 }
  });

  return (
    <>
      {/* FAB Button (PC/Mobile共通、ただしMobileでOpen時は隠す) */}
      {(!isOpen || !isMobile) && (
        <button
          ref={fabRef}
          // スマホならドラッグイベントをアタッチしない
          onPointerDown={!isMobile ? handlers.onPointerDown : undefined}
          onPointerMove={!isMobile ? handlers.onPointerMove : undefined}
          onPointerUp={!isMobile ? handlers.onPointerUp : undefined}
          onClick={isMobile ? () => setIsOpen(true) : undefined} // スマホ用クリックハンドラ
          style={{
            position: "fixed",
            left: isMobile ? "auto" : position.x,
            top: isMobile ? "auto" : position.y,
            right: isMobile ? "24px" : "auto",
            bottom: isMobile ? "24px" : "auto",
            width: "56px",
            height: "56px",
            borderRadius: "16px", // M3 Shape
            background: "var(--color-seed, #2563eb)",
            color: "var(--color-on-seed, white)",
            border: "none",
            boxShadow: "var(--shadow-lg, 0 4px 8px 3px rgba(0,0,0,0.15))",
            cursor: "pointer",
            zIndex: 9990,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
            userSelect: "none",
            transition: isMobile ? "transform 0.2s cubic-bezier(0.2, 0, 0, 1)" : "none",
          }}
        >
          <Icon name="chat" size={28} color="var(--color-on-seed, white)" />
        </button>
      )}

      {/* Mobile Overlay (スマホで開いている時のみ背景を暗くする) */}
      {isOpen && isMobile && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", zIndex: 9998,
            animation: "fadeIn 0.3s ease"
          }}
        />
      )}

      {/* Chat Window / Bottom Sheet */}
      {isOpen && (
        <div
          className="chat-container"
          style={{
            position: "fixed",
            zIndex: 9999,
            background: "var(--color-surface, white)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "var(--shadow-xl, 0 8px 30px rgba(0,0,0,0.15))",
            // スタイルは動的に切り替え
            ...(isMobile ? mobileStyle : isTablet ? {
              ...tabletStyle,
              left: Math.min(position.x - 280, window.innerWidth - 340),
              top: Math.min(position.y - 450, window.innerHeight - 480),
            } : {
              ...desktopStyle,
              left: Math.min(position.x - 300, window.innerWidth - 370), // 画面外にはみ出さない補正
              top: Math.min(position.y - 500, window.innerHeight - 520),
            })
          }}
        >
          {/* AI News Ticker (チッカーUI) - 過去1週間の全員のログ情報を表示 */}
          {weeklyLogNews.length > 0 && (
            <div
              style={{
                background: "linear-gradient(90deg, #b3261e 0%, #d32f2f 100%)",
                color: "white",
                padding: isMobile ? "10px 12px" : "12px 16px",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
                borderBottom: "2px solid #8b1a1a",
                display: "flex",
                alignItems: "center",
                gap: isMobile ? "8px" : "12px",
              }}
            >
              {/* 点滅するインジケーター */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: isMobile ? "5px" : "6px",
                    height: isMobile ? "5px" : "6px",
                    borderRadius: "50%",
                    background: "#ffeb3b",
                    animation: "blink 1s infinite",
                    boxShadow: "0 0 4px rgba(255, 235, 59, 0.8)",
                  }}
                />
                <span
                  style={{
                    fontSize: isMobile ? "10px" : "11px",
                    fontWeight: "700",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  AI news
                </span>
              </div>
              {/* チッカーメッセージ部分（横スクロールアニメーション） */}
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  height: isMobile ? "20px" : "22px",
                }}
              >
                {weeklyLogLoading ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div className="typing-dot" style={{ animationDelay: "0s", width: "4px", height: "4px" }} />
                    <div className="typing-dot" style={{ animationDelay: "0.2s", width: "4px", height: "4px" }} />
                    <div className="typing-dot" style={{ animationDelay: "0.4s", width: "4px", height: "4px" }} />
                  </div>
                ) : (
                  <div className="ticker-container">
                    <div className="ticker-content">
                      {weeklyLogNews.map((news, index) => (
                        <span key={index} className="ticker-item">
                          {news}
                        </span>
                      ))}
                      {/* シームレスなループのために同じコンテンツを2回繰り返す */}
                      {weeklyLogNews.map((news, index) => (
                        <span key={`duplicate-${index}`} className="ticker-item">
                          {news}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Header */}
          <div
            style={{
              padding: isMobile ? "12px 16px" : "16px",
              background: "var(--color-surface-container, #f1f5f9)",
              borderBottom: "1px solid var(--color-border, #e5e7eb)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                background: "var(--color-seed-bg, #e0f2fe)",
                padding: "8px",
                borderRadius: "12px",
                color: "var(--color-seed, #2563eb)"
              }}>
                <Icon name={mode === "chat" ? "robot" : "edit"} size={24} color="var(--color-seed, #2563eb)" />
              </div>
              <div>
                <div style={{ fontWeight: "700", fontSize: isMobile ? "13px" : "14px", color: "var(--color-text-main, #111827)" }}>
                  {mode === "chat" ? "LUQO AI Coach" : "クイックログ"}
                </div>
                <div style={{ fontSize: isMobile ? "10px" : "11px", color: "var(--color-text-sub, #6b7280)" }}>
                  {mode === "chat" ? "Consultant Agent" : "即座にログを記録"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* モード切り替えトグル（アイコンのみ） */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 4, 
                padding: "4px", 
                background: "var(--color-surface-container-high, #e5e7eb)", 
                borderRadius: "12px" 
              }}>
                <button
                  onClick={() => setMode("chat")}
                  title="チャット"
                  style={{
                    padding: isMobile ? "8px" : "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: mode === "chat" ? "var(--color-seed, #2563eb)" : "transparent",
                    color: mode === "chat" ? "white" : "var(--color-text-sub, #6b7280)",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.2, 0, 0, 1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon 
                    name="chat" 
                    size={isMobile ? 18 : 20} 
                    color={mode === "chat" ? "white" : "var(--color-text-sub, #6b7280)"} 
                  />
                </button>
                <button
                  onClick={() => setMode("quick-log")}
                  title="即ログ"
                  style={{
                    padding: isMobile ? "8px" : "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: mode === "quick-log" ? "var(--color-seed, #2563eb)" : "transparent",
                    color: mode === "quick-log" ? "white" : "var(--color-text-sub, #6b7280)",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.2, 0, 0, 1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon 
                    name="edit" 
                    size={isMobile ? 18 : 20} 
                    color={mode === "quick-log" ? "white" : "var(--color-text-sub, #6b7280)"} 
                  />
                </button>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "8px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-muted, #9ca3af)"
                }}
              >
                <Icon name="close" size={24} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobile ? "12px" : "16px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "12px" : "16px",
              background: "var(--color-surface-container-lowest, white)",
            }}
          >
            {/* クイックログモードではメッセージ履歴を非表示 */}
            {mode === "quick-log" ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: "12px",
                color: "var(--color-text-sub, #6b7280)",
                textAlign: "center",
                padding: "32px 16px",
              }}>
                <Icon name="edit" size={48} color="var(--color-text-sub, #6b7280)" />
                <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
                  作業内容を入力して送信すると、<br />
                  すぐにログとして保存されます。
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: m.role === "user" ? "flex-end" : "flex-start",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                        alignItems: "flex-end",
                        gap: "8px",
                        width: "100%",
                      }}
                    >
                      {m.role === "assistant" && (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "var(--color-surface-container-high, #eef2ff)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <Icon name="robot" size={16} color="var(--color-text-sub, #6b7280)" />
                        </div>
                      )}
                      <div
                        style={{
                          maxWidth: "85%",
                          padding: "12px 16px",
                          borderRadius: "16px",
                          fontSize: "14px",
                          lineHeight: "1.6",
                          whiteSpace: "pre-wrap",
                          // 吹き出しの形状調整 (Chat Bubble)
                          borderBottomRightRadius: m.role === "user" ? "4px" : "16px",
                          borderBottomLeftRadius: m.role === "assistant" ? "4px" : "16px",
                          background: m.role === "user" ? "var(--color-seed, #2563eb)" : "var(--color-surface-container-high, #f3f4f6)",
                          color: m.role === "user" ? "white" : "var(--color-text-main, #1f2937)",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                    {/* AIの返答に「ログに追加して終了」ボタンを表示 */}
                    {m.role === "assistant" && i > 0 && (
                      <button
                        onClick={() => handleSaveAndEnd(m.text)}
                        disabled={loading}
                        style={{
                          marginLeft: "36px", // アイコン分のオフセット
                          padding: isMobile ? "6px 12px" : "8px 16px",
                          borderRadius: "12px",
                          border: "none",
                          background: "var(--color-seed, #2563eb)",
                          color: "white",
                          fontSize: isMobile ? "12px" : "13px",
                          fontWeight: "600",
                          cursor: loading ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.2s cubic-bezier(0.2, 0, 0, 1)",
                          opacity: loading ? 0.6 : 1,
                          boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                        }}
                        onMouseEnter={(e) => {
                          if (!loading) {
                            e.currentTarget.style.background = "color-mix(in srgb, var(--color-seed, #2563eb), black 10%)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 8px rgba(37, 99, 235, 0.3)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!loading) {
                            e.currentTarget.style.background = "var(--color-seed, #2563eb)";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 4px rgba(37, 99, 235, 0.2)";
                          }
                        }}
                      >
                        <Icon name="check" size={16} color="white" />
                        <span>ログに追加して終了</span>
                      </button>
                    )}
                  </div>
                ))}
                {loading && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 4 }}>
                    <div className="typing-dot" style={{ animationDelay: "0s" }} />
                    <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
                    <div className="typing-dot" style={{ animationDelay: "0.4s" }} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Suggestion / Mention List */}
          {mentionQuery !== null && filteredUsers.length > 0 && (
            <div style={{ borderTop: "1px solid #e5e7eb", maxHeight: "120px", overflowY: "auto" }}>
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => insertMention(u.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    width: "100%", padding: "12px 16px",
                    border: "none", background: "transparent", textAlign: "left",
                    borderBottom: "1px solid #f3f4f6"
                  }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#bfdbfe", color: "#1e3a8a", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>{u.id[0].toUpperCase()}</div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={handleSend}
            style={{
              padding: isMobile ? "10px 12px" : "12px 16px",
              paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : "16px", // iPhoneのバー対策
              borderTop: "1px solid var(--color-border, #e5e7eb)",
              display: "flex",
              gap: isMobile ? "6px" : "8px",
              background: "var(--color-surface-container-low, #f9fafb)",
            }}
          >
            {/* チャットモードのみ履歴ボタンを表示 */}
            {mode === "chat" && (
              <button
                type="button"
                onClick={handleFetchLogs}
                disabled={loading}
                style={{
                  padding: "8px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border, #d1d5db)",
                  background: "white",
                  cursor: loading ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
                title="履歴を参照"
              >
                <Icon name="book" size={20} color="var(--color-text-main, #111827)" />
              </button>
            )}

            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder={mode === "chat" ? "メッセージを入力..." : "作業内容を入力して送信..."}
              style={{
                flex: 1,
                padding: isMobile ? "10px 12px" : "12px",
                borderRadius: "24px",
                border: "1px solid var(--color-border, #d1d5db)",
                fontSize: isMobile ? "13px" : "14px",
                outline: "none",
                background: isSuccess ? "#dcfce7" : "white",
                transition: "background-color 0.3s ease",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: "8px",
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                border: "none",
                background: mode === "quick-log" && input.trim() ? "var(--color-seed, #2563eb)" : "transparent",
                color: mode === "quick-log" && input.trim() ? "white" : "var(--color-seed, #2563eb)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: loading || !input.trim() ? 0.3 : 1,
                cursor: loading || !input.trim() ? "default" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Icon name={mode === "quick-log" ? "check" : "sendPlane"} size={24} />
            </button>
          </form>
        </div>
      )}
      <style>{`
        .typing-dot {
          width: 6px; height: 6px; background: #9ca3af; border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }
        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); } to { transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .ticker-container {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
        .ticker-content {
          display: inline-flex;
          white-space: nowrap;
          animation: tickerScroll 60s linear infinite;
          gap: 40px;
        }
        .ticker-item {
          display: inline-block;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          padding-right: 40px;
        }
        @keyframes tickerScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @media (max-width: 640px) {
          .ticker-item {
            font-size: 12px;
          }
          .ticker-content {
            gap: 30px;
          }
          .ticker-item {
            padding-right: 30px;
          }
        }
      `}</style>

      {/* 過去ログ表示モーダル */}
      {isLogHistoryOpen && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => setIsLogHistoryOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.32)",
              zIndex: 10000,
              animation: "fadeIn 0.3s ease"
            }}
          />
          {/* モーダル */}
          <div
            style={{
              position: "fixed",
              zIndex: 10001,
              background: "var(--color-surface, white)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl, 0 8px 30px rgba(0,0,0,0.15))",
              width: isMobile ? "90%" : "600px",
              maxWidth: "90vw",
              maxHeight: "80vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* ヘッダー */}
            <div
              style={{
                padding: "16px",
                background: "var(--color-surface-container, #f1f5f9)",
                borderBottom: "1px solid var(--color-border, #e5e7eb)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="book" size={24} color="var(--color-seed, #2563eb)" />
                <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--color-text-main, #111827)" }}>
                  過去ログ
                </div>
              </div>
              <button
                onClick={() => setIsLogHistoryOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "8px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-muted, #9ca3af)"
                }}
              >
                <Icon name="close" size={24} />
              </button>
            </div>

            {/* タブUI */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--color-border, #e5e7eb)",
                background: "var(--color-surface-container-low, #f9fafb)",
              }}
            >
              <button
                onClick={() => setLogSummaryTab("personal")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: "600",
                  border: "none",
                  background: logSummaryTab === "personal"
                    ? "var(--color-surface, white)"
                    : "transparent",
                  color: logSummaryTab === "personal"
                    ? "var(--color-text-main, #111827)"
                    : "var(--color-text-sub, #6b7280)",
                  borderBottom: logSummaryTab === "personal"
                    ? "2px solid var(--color-seed, #2563eb)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                個人ログ
              </button>
              <button
                onClick={() => setLogSummaryTab("team")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: "600",
                  border: "none",
                  background: logSummaryTab === "team"
                    ? "var(--color-surface, white)"
                    : "transparent",
                  color: logSummaryTab === "team"
                    ? "var(--color-text-main, #111827)"
                    : "var(--color-text-sub, #6b7280)",
                  borderBottom: logSummaryTab === "team"
                    ? "2px solid var(--color-seed, #2563eb)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                チーム要約
              </button>
            </div>

            {/* 個人ログタブ: 月選択 */}
            {logSummaryTab === "personal" && (
              <div
                style={{
                  padding: "16px",
                  borderBottom: "1px solid var(--color-border, #e5e7eb)",
                  background: "var(--color-surface-container-low, #f9fafb)",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "var(--color-text-sub, #6b7280)",
                    marginBottom: "8px",
                  }}
                >
                  月を選択
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #d1d5db)",
                    fontSize: "14px",
                    background: "white",
                    color: "var(--color-text-main, #111827)",
                  }}
                />
              </div>
            )}

            {/* チーム要約タブ: 期間選択 */}
            {logSummaryTab === "team" && (
              <div
                style={{
                  padding: "16px",
                  borderBottom: "1px solid var(--color-border, #e5e7eb)",
                  background: "var(--color-surface-container-low, #f9fafb)",
                }}
              >
                <DateRangePicker
                  startDate={summaryStartDate}
                  endDate={summaryEndDate}
                  onStartDateChange={setSummaryStartDate}
                  onEndDateChange={setSummaryEndDate}
                  onQuickSelect={handleQuickSelectDays}
                  disabled={logSummaryLoading}
                />
                <button
                  onClick={() => loadLogSummary(summaryStartDate, summaryEndDate)}
                  disabled={logSummaryLoading || !summaryStartDate || !summaryEndDate}
                  style={{
                    width: "100%",
                    marginTop: "12px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: "600",
                    borderRadius: "8px",
                    border: "none",
                    background: logSummaryLoading || !summaryStartDate || !summaryEndDate
                      ? "var(--color-surface-container-high, #e5e7eb)"
                      : "var(--color-seed, #2563eb)",
                    color: logSummaryLoading || !summaryStartDate || !summaryEndDate
                      ? "var(--color-text-sub, #9ca3af)"
                      : "white",
                    cursor: logSummaryLoading || !summaryStartDate || !summaryEndDate
                      ? "not-allowed"
                      : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {logSummaryLoading ? "要約を生成中..." : "要約を生成"}
                </button>
              </div>
            )}

            {/* コンテンツエリア */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: "var(--color-surface-container-lowest, white)",
              }}
            >
              {/* 個人ログタブ */}
              {logSummaryTab === "personal" && (
                <>
                  {logHistoryLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="typing-dot" style={{ animationDelay: "0s" }} />
                        <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
                        <div className="typing-dot" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  ) : logHistory.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "32px",
                        color: "var(--color-text-sub, #6b7280)",
                        fontSize: "14px",
                      }}
                    >
                      この月のログはありません
                    </div>
                  ) : (
                    logHistory.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: "12px 16px",
                          background: "var(--color-surface-container-high, #f3f4f6)",
                          borderRadius: "12px",
                          border: "1px solid var(--color-border, #e5e7eb)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--color-text-sub, #6b7280)",
                            marginBottom: "8px",
                          }}
                        >
                          {new Date(log.createdAt).toLocaleDateString("ja-JP", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            lineHeight: "1.6",
                            color: "var(--color-text-main, #1f2937)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {log.text}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* チーム要約タブ */}
              {logSummaryTab === "team" && (
                <>
                  {logSummaryLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px", gap: "12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="typing-dot" style={{ animationDelay: "0s" }} />
                        <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
                        <div className="typing-dot" style={{ animationDelay: "0.4s" }} />
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-sub, #6b7280)" }}>
                        AIが要約を生成しています...
                      </div>
                    </div>
                  ) : !logSummary ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "32px",
                        color: "var(--color-text-sub, #6b7280)",
                        fontSize: "14px",
                      }}
                    >
                      期間を選択して「要約を生成」ボタンをクリックしてください
                    </div>
                  ) : (
                    <>
                      {/* 統計情報カード */}
                      <div
                        style={{
                          padding: "16px",
                          background: "var(--color-surface-container-high, #f3f4f6)",
                          borderRadius: "12px",
                          border: "1px solid var(--color-border, #e5e7eb)",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-sub, #6b7280)", marginBottom: "12px" }}>
                          統計情報
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--color-text-sub, #6b7280)" }}>総ログ件数</div>
                            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--color-text-main, #111827)" }}>
                              {logSummary.statistics.totalLogs}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--color-text-sub, #6b7280)" }}>参加人数</div>
                            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--color-text-main, #111827)" }}>
                              {logSummary.statistics.uniqueUsers}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--color-text-sub, #6b7280)" }}>期間</div>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-text-main, #111827)" }}>
                              {logSummary.statistics.dateRange.days}日間
                            </div>
                          </div>
                          {logSummary.statistics.mostActiveDay && (
                            <div>
                              <div style={{ fontSize: "11px", color: "var(--color-text-sub, #6b7280)" }}>最も活発な日</div>
                              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-text-main, #111827)" }}>
                                {logSummary.statistics.mostActiveDay.date}<br />
                                {logSummary.statistics.mostActiveDay.count}件
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 要約カード */}
                      {logSummary.overview && (
                        <div
                          style={{
                            padding: "16px",
                            background: "linear-gradient(135deg, var(--color-seed, #2563eb) 0%, #1d4ed8 100%)",
                            borderRadius: "12px",
                            color: "white",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: "700", marginBottom: "8px", opacity: 0.9 }}>
                            期間総括
                          </div>
                          <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
                            {logSummary.overview}
                          </div>
                        </div>
                      )}

                      {/* インサイト */}
                      {logSummary.insights && logSummary.insights.length > 0 && (
                        <div
                          style={{
                            padding: "16px",
                            background: "var(--color-surface-container-high, #f3f4f6)",
                            borderRadius: "12px",
                            border: "1px solid var(--color-border, #e5e7eb)",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-sub, #6b7280)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Icon name="thinking" size={16} />
                            インサイト
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {logSummary.insights.map((insight, idx) => (
                              <li key={idx} style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--color-text-main, #111827)" }}>
                                {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ハイライト */}
                      {logSummary.highlights && logSummary.highlights.length > 0 && (
                        <div
                          style={{
                            padding: "16px",
                            background: "var(--color-surface-container-high, #f3f4f6)",
                            borderRadius: "12px",
                            border: "1px solid var(--color-border, #e5e7eb)",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-sub, #6b7280)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Icon name="fire" size={16} />
                            ハイライト
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {logSummary.highlights.map((highlight, idx) => (
                              <li key={idx} style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--color-text-main, #111827)" }}>
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* アクティブユーザー */}
                      {logSummary.statistics.topUsers && logSummary.statistics.topUsers.length > 0 && (
                        <div
                          style={{
                            padding: "16px",
                            background: "var(--color-surface-container-high, #f3f4f6)",
                            borderRadius: "12px",
                            border: "1px solid var(--color-border, #e5e7eb)",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-sub, #6b7280)", marginBottom: "12px" }}>
                            アクティブユーザー（上位5名）
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {logSummary.statistics.topUsers.map((user, idx) => (
                              <div key={user.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "13px", color: "var(--color-text-main, #111827)" }}>
                                  {idx + 1}. {user.userId}
                                </div>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-seed, #2563eb)" }}>
                                  {user.count}件
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

// スタイル定義 (CSS-in-JSで切り分け)
const desktopStyle: React.CSSProperties = {
  width: "360px",
  height: "520px",
  borderRadius: "16px",
  border: "1px solid var(--color-border, #e5e7eb)",
};

const tabletStyle: React.CSSProperties = {
  width: "340px",
  height: "480px",
  borderRadius: "16px",
  border: "1px solid var(--color-border, #e5e7eb)",
};

const mobileStyle: React.CSSProperties = {
  left: 0,
  right: 0,
  bottom: 0,
  width: "100%",
  height: "85vh", // 画面の85%を占める
  borderTopLeftRadius: "28px", // M3 Bottom Sheet Shape
  borderTopRightRadius: "28px",
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  animation: "slideUp 0.3s cubic-bezier(0.2, 0, 0, 1)", // M3 Emphasized Decelerate
};
