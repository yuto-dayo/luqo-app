import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

type NotificationItem = {
  id?: string;
  text: string;
  createdAt?: string;
  kind?: string;
};

export const NotificationBell: React.FC = () => {
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);

  // ポーリングロジック（変更なし）
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let abort: AbortController | undefined;

    const fetchNotifs = async () => {
      try {
        abort?.abort();
        abort = new AbortController();
        const res = await apiClient.get<{ items: NotificationItem[] }>(
          "/api/v1/notifications",
          { signal: abort.signal },
        );
        if (res?.items) {
          setNotifs(res.items);
          setCount(res.items.length);
        }
      } catch (e) {
        // ignore
      }
    };

    fetchNotifs();
    timer = setInterval(fetchNotifs, 60_000);

    return () => {
      if (timer) clearInterval(timer);
      abort?.abort();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="icon-btn" // ★スタイルはクラス化推奨（下部に定義）
        aria-label="通知"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "8px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isOpen ? "var(--color-seed)" : "var(--color-text-muted)", // 開いてるときは色付く
          transition: "background 0.2s, color 0.2s",
          position: "relative",
        }}
        // ホバー効果（インラインだと限界があるので、本来はCSS ModulesかGlobal CSS推奨）
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* ★Emoji(🔔)をやめて、SVGアイコンにする */}
        {/* Material Symbols: notifications_none / notifications */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          {count > 0 ? (
            // 通知あり: Filled
            <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16ZM16 17H8V11C8 8.52 9.51 6.5 12 6.5C14.49 6.5 16 8.52 16 11V17Z" fill="currentColor" />
          ) : (
            // 通知なし: Outlined
            <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16ZM16 17H8V11C8 8.52 9.51 6.5 12 6.5C14.49 6.5 16 8.52 16 11V17Z" />
          )}
        </svg>

        {/* ★バッジの改善: 白縁をつけて視認性を上げる */}
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              background: "#b3261e", // M3 Error Color
              color: "white",
              fontSize: "10px",
              fontWeight: "bold",
              minWidth: "16px",
              height: "16px",
              borderRadius: "10px", // 丸ではなく角丸（数字が増えてもいいように）
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxSizing: "border-box",
              border: "2px solid #fff", // ★ここが重要！背景色で縁取りして「切り抜き」に見せる
              boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        // ドロップダウンもM3のSurface Container Highスタイルに
        <div
          style={{
            position: "absolute",
            right: 0, // スマホだと画面端に近すぎる場合があるので注意（本来はPopover推奨）
            top: "100%",
            marginTop: "8px",
            width: "320px", // 少し広げる
            maxWidth: "90vw", // スマホ対応
            background: "#fff", // Surface Container
            borderRadius: "16px", // M3 Extra Small ~ Medium Shape
            boxShadow: "0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)", // M3 Elevation 2
            zIndex: 1000,
            overflow: "hidden",
            transformOrigin: "top right",
            animation: "scaleIn 0.2s cubic-bezier(0.2, 0, 0, 1)", // M3 Standard Easing
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e0e2e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#1f1f1f" }}>通知</span>
            {count > 0 && (
              <span style={{ fontSize: "11px", background: "#e0f2fe", color: "#0284c7", padding: "2px 8px", borderRadius: "12px" }}>
                {count} new
              </span>
            )}
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.5 }}>📭</div>
              新しい通知はありません
            </div>
          ) : (
            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
              {notifs.map((n, i) => (
                <div
                  key={n.id ?? i}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "13px",
                    color: "#444746",
                    background: "#fff",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                    {/* アイコン付与 (Kindに応じて変えられるとベスト) */}
                    <span style={{ fontSize: "16px" }}>
                      {n.kind === "q_score_adjustment" ? "🛡️" : "info"}
                    </span>
                    <div style={{ lineHeight: "1.5" }}>{n.text}</div>
                  </div>
                  {n.createdAt && (
                    <div style={{ fontSize: "11px", color: "#8e918f", marginLeft: "24px" }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* "すべて見る" ボタン風フッター */}
          {notifs.length > 0 && (
            <div
              style={{
                padding: "8px",
                textAlign: "center",
                borderTop: "1px solid #e0e2e0",
                background: "#fdfcff",
              }}
            >
              <button
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--color-seed)",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                すべての通知を見る
              </button>
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
