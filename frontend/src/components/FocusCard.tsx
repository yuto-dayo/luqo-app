import React, { useEffect, useState, useCallback } from "react";
import {
  useScoreLU,
  useScoreQ,
  useScoreO,
} from "../hooks/useLuqoStore";
import { readHistoryOnce } from "../hooks/useLuqoStore";
import { apiClient } from "../lib/apiClient";

type Props = {
  scoreReady: boolean;
  historyBump: string | null; // 履歴の末尾ID（プリミティブ）
};

// Bandit が扱うKPI軸
type FocusKpi = "quality" | "growth" | "innovation";

// 2週間フォーカスの構造
type FocusPeriod = {
  id: string;
  kpi: FocusKpi;
  action: string;
  luqoHint: string;
  startAt: string;
  endAt: string;
};

type BanditSuggestResponse = {
  ok: boolean;
  baseKpi: FocusKpi;
  chosenKpi: FocusKpi;
  scores: Record<FocusKpi, number>;
  suggestion: {
    action: string;
    luqoHint: string;
  };
};

const STORAGE_KEY = "luqo.focusPeriod.v1";

// ---- 小さめユーティリティ ----

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const loadFocusPeriod = (now = new Date()): FocusPeriod | null => {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FocusPeriod;
    const end = new Date(parsed.endAt);
    if (isNaN(end.getTime())) return null;
    if (end.getTime() < now.getTime()) return null; // 期限切れ
    return parsed;
  } catch {
    return null;
  }
};

const saveFocusPeriod = (period: FocusPeriod) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(period));
};

const clearFocusPeriod = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};

const kpiLabel = (k: FocusKpi): string => {
  switch (k) {
    case "quality":
      return "品質";
    case "growth":
      return "成長";
    case "innovation":
      return "独自性";
    default:
      return k;
  }
};

const describeRemainingDays = (endIso: string): string => {
  const now = new Date();
  const end = new Date(endIso);
  if (isNaN(end.getTime())) return "約2週間";

  const ms = end.getTime() - now.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));

  if (days <= 0) return "今日で切り替え";
  if (days === 1) return "ラスト1日";
  return `残り${days}日`;
};

const formatRange = (startIso: string, endIso: string): string => {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(s)} 〜 ${fmt(e)}`;
};

// ---- 本体コンポーネント ----

export const FocusCard: React.FC<Props> = ({ scoreReady, historyBump }) => {
  const lu = useScoreLU() ?? 0;
  const q = useScoreQ() ?? 0;
  const o = useScoreO() ?? 0;

  const [period, setPeriod] = useState<FocusPeriod | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ensureFocus = useCallback(
    async (options?: { force?: boolean }) => {
      if (!scoreReady) {
        setPeriod(null);
        return;
      }

      const now = new Date();

      if (!options?.force) {
        const existing = loadFocusPeriod(now);
        if (existing) {
          setPeriod(existing);
          return;
        }
      } else {
        clearFocusPeriod();
      }

      setLoading(true);
      setErr(null);

      try {
        // 履歴を読む（将来使うなら payload に渡す）
        const history = readHistoryOnce();

        // Bandit に現在のLUQOスコアを渡してフォーカスを決める
        const resp = await apiClient.post<BanditSuggestResponse>(
          "/bandit/suggest",
          {
            kpi: "quality", // TODO: 組織KPIから動的に変えてもOK
            score: {
              lu,
              q,
              o,
              total: lu + q + o,
            },
            history,
          },
        );

        if (!resp.ok) {
          throw new Error("bandit_focus_failed");
        }

        const nowIso = now.toISOString();
        const endIso = addDays(now, 14).toISOString();

        const next: FocusPeriod = {
          id: crypto.randomUUID(),
          kpi: resp.chosenKpi,
          action: resp.suggestion.action,
          luqoHint: resp.suggestion.luqoHint,
          startAt: nowIso,
          endAt: endIso,
        };

        setPeriod(next);
        saveFocusPeriod(next);
      } catch (e: any) {
        console.error("focus update failed", e);
        setErr(e?.message ?? "focus_update_failed");
        setPeriod(null);
      } finally {
        setLoading(false);
      }
    },
    [scoreReady, historyBump, lu, q, o],
  );

  useEffect(() => {
    void ensureFocus();
  }, [ensureFocus]);

  const handleForceUpdate = async () => {
    await ensureFocus({ force: true });
  };

  // ---- UI ----

  const showEmptyMessage =
    !scoreReady || !historyBump;

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 18,
        border: "1px solid #e5e7eb",
        boxShadow:
          "0 8px 20px rgba(15, 23, 42, 0.06)",
        background:
          "linear-gradient(135deg, #f9fafb 0%, #ffffff 40%, #f3f4f6 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            {period
              ? `FOCUS • ${describeRemainingDays(period.endAt)}`
              : "FOCUS • 約2週間"}
          </div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            {period
              ? `${kpiLabel(period.kpi)} に集中しよう`
              : showEmptyMessage
                ? "まずはログを書こう"
                : "フォーカスを計算中…"}
          </h3>
          {period && (
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              期間: {formatRange(period.startAt, period.endAt)}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleForceUpdate}
          disabled={loading}
          style={{
            border: "none",
            background: "rgba(243,244,246,0.9)",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 500,
            color: "#374151",
            cursor: loading ? "default" : "pointer",
            backdropFilter: "blur(8px)",
            boxShadow:
              "0 0 0 1px rgba(209,213,219,0.8)",
          }}
        >
          {loading ? "更新中…" : "フォーカスを更新"}
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        {showEmptyMessage && !period ? (
          <p
            style={{
              fontSize: 13,
              color: "#4b5563",
              margin: 0,
            }}
          >
            ログがまだ少ないみたい。まずは今日の作業を1件以上記録してから、
            フォーカスを計算してみよう。
          </p>
        ) : period ? (
          <>
            <p
              style={{
                fontSize: 14,
                color: "#111827",
                margin: 0,
                marginBottom: 6,
              }}
            >
              {period.action}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#6b7280",
                margin: 0,
              }}
            >
              LUQOヒント: {period.luqoHint}
            </p>
          </>
        ) : (
          <p
            style={{
              fontSize: 13,
              color: "#4b5563",
              margin: 0,
            }}
          >
            Bandit が今期のフォーカスを計算中です…
          </p>
        )}
      </div>

      {err && (
        <p
          style={{
            color: "#b91c1c",
            fontSize: 12,
            marginTop: 8,
          }}
        >
          エラー: {err}
        </p>
      )}
    </div>
  );
};
