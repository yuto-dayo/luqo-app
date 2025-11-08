import React, { useCallback, useMemo, useState } from "react";
import {
  saveLocalEvent,
  loadLocalEvents,
  clearLocalEvents,
  getLocalEventsCount,
  Event,
} from "./lib/storage";
import { fetchLuqoScore, type LuqoScore } from "./lib/api";

// Prefer fixed port during MVP validation
const API_BASE_URL = "http://localhost:4000";
// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

const App: React.FC = () => {
  const [text, setText] = useState("");
  const [syncState, setSyncState] = useState<
    "idle" | "saving" | "syncing" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState<number>(() =>
    typeof window !== "undefined" ? getLocalEventsCount() : 0,
  );
  const [userId, setUserId] = useState("demo-user");
  const [month, setMonth] = useState("2025-11");
  const [score, setScore] = useState<LuqoScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const canSave = useMemo(() => text.trim().length > 0, [text]);

  const handleSaveLocal = useCallback(() => {
    if (!canSave) return;

    setSyncState("saving");
    setErrorMsg(null);

    const now = new Date().toISOString();
    const newEvent: Event = {
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      userId: "demo-user", // Replace with logged-in user in production
      kind: "luqo_log",
      createdAt: now,
      body: {
        text: text.trim(),
      },
    };

    try {
      saveLocalEvent(newEvent);
      setLocalCount(getLocalEventsCount());
      setText("");
      setSyncState("idle");
    } catch (e) {
      console.error(e);
      setErrorMsg("ローカル保存に失敗しました");
      setSyncState("error");
    }
  }, [canSave, text]);

  const handleSyncToServer = useCallback(async () => {
    setSyncState("syncing");
    setErrorMsg(null);

    const events = loadLocalEvents();
    if (events.length === 0) {
      setSyncState("idle");
      return;
    }

    try {
      for (const ev of events) {
        const res = await fetch(`${API_BASE_URL}/api/v1/luqo/logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ev),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Failed to sync event: ${res.status} ${res.statusText} ${text}`,
          );
        }
      }

      // Clear local events after successful sync
      clearLocalEvents();
      setLocalCount(0);
      setSyncState("success");
    } catch (err) {
      console.error(err);
      setErrorMsg("サーバー同期に失敗しました。ネット環境を確認して再度お試しください。");
      setSyncState("error");
    }
  }, []);

  const handleResetStatus = useCallback(() => {
    setSyncState("idle");
    setErrorMsg(null);
  }, []);

  const handleGenerateScore = useCallback(async () => {
    setScoreLoading(true);
    setScoreError(null);
    try {
      const res = await fetchLuqoScore({ userId, month });
      if (!res.ok) {
        throw new Error("サーバー側で ok=false が返されました");
      }
      setScore(res.score);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "スコア取得に失敗しました。時間をおいてお試しください。";
      setScoreError(message);
      setScore(null);
    } finally {
      setScoreLoading(false);
    }
  }, [month, userId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        backgroundColor: "#0f172a",
        color: "#e5e7eb",
      }}
      onClick={syncState !== "idle" ? handleResetStatus : undefined}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "24px",
          borderRadius: 16,
          background:
            "linear-gradient(145deg, rgba(30,64,175,0.7), rgba(15,23,42,0.9))",
          boxShadow:
            "0 18px 45px rgba(15,23,42,0.8), 0 0 0 1px rgba(148,163,184,0.2)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          LUQO Sync Test – オフライン同期MVP
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#cbd5f5",
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          現場で入力したログをまず
          <span style={{ fontWeight: 600 }}> localStorage </span>
          に貯めておき、後から
          <span style={{ fontWeight: 600 }}> サーバーに一括同期 </span>
          する流れのテスト用画面です。
        </p>

        {/* ローカル入力フォーム */}
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            backgroundColor: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        >
          <label
            htmlFor="logText"
            style={{
              display: "block",
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            作業ログ（テキスト）
          </label>
          <textarea
            id="logText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="例）玄関まわりのパテ1回目完了。フラットボックスの段取り改善で30分短縮。"
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: 8,
              padding: 8,
              border: "1px solid rgba(148,163,184,0.5)",
              backgroundColor: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              fontSize: 14,
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={handleSaveLocal}
            disabled={!canSave || syncState === "saving"}
            style={{
              marginTop: 10,
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: canSave && syncState !== "saving" ? "pointer" : "default",
              opacity: canSave && syncState !== "saving" ? 1 : 0.5,
              background:
                "linear-gradient(135deg, rgb(34,197,94), rgb(22,163,74))",
              color: "#0f172a",
            }}
          >
            {syncState === "saving" ? "ローカル保存中…" : "ローカルに保存"}
          </button>
        </div>

        {/* ローカルイベント情報 & 同期ボタン */}
        <div
          style={{
            marginTop: 8,
            padding: 16,
            borderRadius: 12,
            backgroundColor: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13 }}>
              <span style={{ opacity: 0.8 }}>ローカル未同期イベント数：</span>
              <span style={{ fontWeight: 700 }}>{localCount}</span>
            </div>
            <button
              type="button"
              onClick={handleSyncToServer}
              disabled={localCount === 0 || syncState === "syncing"}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  localCount > 0 && syncState !== "syncing"
                    ? "pointer"
                    : "default",
                opacity:
                  localCount > 0 && syncState !== "syncing" ? 1 : 0.5,
                background:
                  "linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))",
                color: "#e5e7eb",
              }}
            >
              {syncState === "syncing"
                ? "サーバー同期中…"
                : "サーバーに一括同期"}
            </button>
          </div>

          {/* ステータスメッセージ */}
          {syncState === "success" && (
            <p
              style={{
                fontSize: 12,
                marginTop: 4,
                color: "#bbf7d0",
              }}
            >
              サーバー同期に成功しました。localStorage のイベントはクリアされています。
            </p>
          )}
          {syncState === "error" && errorMsg && (
            <p
              style={{
                fontSize: 12,
                marginTop: 4,
                color: "#fecaca",
              }}
            >
              {errorMsg}
            </p>
          )}
          {syncState === "idle" && (
            <p
              style={{
                fontSize: 12,
                marginTop: 4,
                color: "#9ca3af",
              }}
            >
              背景をクリックするとステータス表示をクリアできます。
            </p>
          )}
        </div>

        {/* 補足 */}
        <p
          style={{
            marginTop: 20,
            fontSize: 11,
            color: "#9ca3af",
            lineHeight: 1.6,
          }}
        >
          ※ 現在はデモとして <code>userId: "demo-user"</code> 固定です。本番ではログインユーザーIDに差し替えます。<br />
          ※ /api/v1/luqo/log は 1件ずつ順番にPOSTしています。必要になったらバッチAPIにまとめることも可能です。
        </p>

        {/* LUQOスコア表示 */}
        <section
          style={{
            marginTop: 32,
            padding: 16,
            borderRadius: 12,
            backgroundColor: "rgba(30,41,59,0.9)",
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            LUQOスコア生成
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <label style={{ fontSize: 13 }}>
              userId:
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                style={{
                  marginLeft: 6,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(148,163,184,0.5)",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "#e5e7eb",
                }}
              />
            </label>

            <label style={{ fontSize: 13 }}>
              month:
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{
                  marginLeft: 6,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(148,163,184,0.5)",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "#e5e7eb",
                }}
              />
            </label>

            <button
              type="button"
              onClick={handleGenerateScore}
              disabled={scoreLoading}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: scoreLoading ? "default" : "pointer",
                opacity: scoreLoading ? 0.6 : 1,
                background:
                  "linear-gradient(135deg, rgb(248,250,252), rgb(209,213,219))",
                color: "#0f172a",
              }}
            >
              {scoreLoading ? "スコア生成中…" : "スコア生成"}
            </button>
          </div>

          {scoreError && (
            <p style={{ color: "#fecaca", marginBottom: 12, fontSize: 13 }}>
              {scoreError}
            </p>
          )}

          {score && (
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                backgroundColor: "#0f172a",
                border: "1px solid rgba(248,250,252,0.08)",
                display: "grid",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { label: "LU", value: score.LU },
                  { label: "Q", value: score.Q },
                  { label: "O", value: score.O },
                  { label: "Total", value: score.total },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>コメント</div>
                <p style={{ marginTop: 4, whiteSpace: "pre-wrap", fontSize: 13 }}>
                  {score.reasoning}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;
