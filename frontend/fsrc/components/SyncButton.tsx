// frontend/src/components/SyncButton.tsx
import React, { useState } from "react";
import {
  createLogEventRequest,
  postLog,
} from "../lib/api";

type SyncState = "idle" | "syncing" | "success" | "error";

export function SyncButton() {
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setState("syncing");
      setMessage(null);

      const event = createLogEventRequest({
        text: "フロントからのLUQOテスト送信",
      });

      const saved = await postLog(event);

      setState("success");
      setMessage(`同期完了: id=${saved.id}`);
    } catch (err: any) {
      console.error(err);
      setState("error");
      setMessage(err?.message ?? "同期に失敗しました");
    }
  };

  const label =
    state === "syncing"
      ? "同期中..."
      : state === "success"
        ? "同期済み（もう一度送る）"
        : state === "error"
          ? "エラー → 再試行"
          : "テストログを同期する";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={state === "syncing"}
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: state === "syncing" ? "default" : "pointer",
        }}
      >
        {label}
      </button>
      {message && (
        <div
          style={{
            fontSize: 12,
            color:
              state === "error"
                ? "#b00020"
                : state === "success"
                  ? "#0a7f2e"
                  : "#555",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
