// frontend/src/components/LuqoSummary.tsx
import React, { useState } from "react";
import { fetchLuqoScore } from "../lib/api";
import { useSetScore } from "../hooks/useLuqoStore";

type LuqoSummaryProps = {
  lu: number;
  q: number;
  o: number;
};

const formatPt = (value: number) => `${value.toFixed(1)} pt`;

export const LuqoSummary: React.FC<LuqoSummaryProps> = ({ lu, q, o }) => {
  const combo = 0.4 * lu + 0.35 * q + 0.25 * o;

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Zustand の setter
  const setScore = useSetScore();

  const handleRefresh = async () => {
    setLoading(true);
    setStatus("idle");
    setMessage(null);

    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}`;

      const res = await fetchLuqoScore({ month });

      // OpenAI から返ってきたスコアを store に反映
      setScore({
        LU: res.score.LU,
        Q: res.score.Q,
        O: res.score.O,
        total: res.score.total,
      });

      setStatus("ok");
      setMessage("LUQOスコアを更新しました。");
    } catch (e: any) {
      console.error("LUQO refresh failed", e);
      setStatus("error");
      setMessage(e?.message ?? "LUQOの更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const statusLabel =
    status === "ok"
      ? "最新"
      : status === "error"
        ? "エラー"
        : "更新待ち";

  return (
    <section
      className="card"
      style={{
        borderRadius: 18,
        border: "1px solid #1f2937",
        background: "radial-gradient(circle at top left, #111827, #020617)",
        boxShadow: "0 16px 40px rgba(15,23,42,0.35)",
      }}
    >
      <header
        className="card__header"
        style={{
          alignItems: "flex-start",
        }}
      >
        <div>
          <p
            className="card__eyebrow"
            style={{ letterSpacing: 1, textTransform: "uppercase" }}
          >
            LUQO ・ 今期のスコア
          </p>
          <h2 className="card__title">約2週間ごとに見直し</h2>
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 4,
            }}
          >
            直近のログから LU・Q・O のバランスを再計算して、
            報酬とフォーカスの土台にします。
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            style={{
              border: "none",
              background: "linear-gradient(135deg, #e5e7eb, #ffffff)",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 600,
              color: "#111827",
              cursor: loading ? "default" : "pointer",
              boxShadow:
                "0 0 0 1px rgba(209,213,219,0.8), 0 10px 25px rgba(15,23,42,0.35)",
              opacity: loading ? 0.8 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "計算中…" : "LUQOを更新"}
          </button>

          <span
            className="card__status"
            style={{
              alignSelf: "flex-end",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background:
                status === "ok"
                  ? "rgba(22,163,74,0.15)"
                  : status === "error"
                    ? "rgba(220,38,38,0.15)"
                    : "rgba(55,65,81,0.6)",
              color:
                status === "ok"
                  ? "#bbf7d0"
                  : status === "error"
                    ? "#fecaca"
                    : "#e5e7eb",
            }}
          >
            {statusLabel}
          </span>
        </div>
      </header>

      <div
        className="luqo-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div
          className="luqo-summary__item"
          style={{
            padding: 8,
            borderRadius: 12,
            background: "rgba(15,23,42,0.8)",
          }}
        >
          <span
            className="luqo-summary__label"
            style={{ fontSize: 11, color: "#9ca3af" }}
          >
            LU
          </span>
          <strong style={{ fontSize: 16, color: "#f9fafb" }}>
            {formatPt(lu)}
          </strong>
        </div>
        <div
          className="luqo-summary__item"
          style={{
            padding: 8,
            borderRadius: 12,
            background: "rgba(15,23,42,0.8)",
          }}
        >
          <span
            className="luqo-summary__label"
            style={{ fontSize: 11, color: "#9ca3af" }}
          >
            Q
          </span>
          <strong style={{ fontSize: 16, color: "#f9fafb" }}>
            {formatPt(q)}
          </strong>
        </div>
        <div
          className="luqo-summary__item"
          style={{
            padding: 8,
            borderRadius: 12,
            background: "rgba(15,23,42,0.8)",
          }}
        >
          <span
            className="luqo-summary__label"
            style={{ fontSize: 11, color: "#9ca3af" }}
          >
            O
          </span>
          <strong style={{ fontSize: 16, color: "#f9fafb" }}>
            {formatPt(o)}
          </strong>
        </div>
      </div>

      <div
        className="luqo-summary__combo"
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 14,
          background: "linear-gradient(135deg, #f97316, #facc15)",
          color: "#111827",
        }}
      >
        <p
          style={{
            fontSize: 11,
            margin: 0,
            marginBottom: 4,
          }}
        >
          合成スコア（内部指標）
        </p>
        <strong style={{ fontSize: 18 }}>{combo.toFixed(1)} pt</strong>
      </div>

      {message && (
        <p
          style={{
            fontSize: 11,
            color: status === "error" ? "#fecaca" : "#d1fae5",
            margin: 0,
            marginTop: 8,
          }}
        >
          {message}
        </p>
      )}
    </section>
  );
};