import { useCallback, useEffect, useState } from "react";
import { fetchBanditSuggestion } from "../lib/api";
import {
  addDays,
  clearFocusPeriod,
  FocusPeriod,
  loadFocusPeriod,
  saveFocusPeriod,
} from "../lib/focus";
import { useScoreLU, useScoreO, useScoreQ } from "./useLuqoStore";

type UseFocusPeriodState = {
  period: FocusPeriod | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: { force?: boolean }) => Promise<void>;
};

export function useFocusPeriod(): UseFocusPeriodState {
  const lu = useScoreLU() ?? 0;
  const q = useScoreQ() ?? 0;
  const o = useScoreO() ?? 0;

  const [period, setPeriod] = useState<FocusPeriod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNewPeriod = useCallback(
    async (options?: { force?: boolean }) => {
      setLoading(true);
      setError(null);

      try {
        const now = new Date();
        const res = await fetchBanditSuggestion({
          kpi: "quality",
          score: {
            LU: lu, Q: q, O: o, total: lu + q + o,
            ui: {
              headline: "", greeting: "", color: "", icon: "target",
              theme: { color: "", shape: "rounded", radiusLevel: 0, vibe: "calm" }
            }
          },
        });

        const startAt = now.toISOString();
        const endAt = addDays(now, 14).toISOString();

        const next: FocusPeriod = {
          id: crypto.randomUUID(),
          kpi: res.chosenKpi,
          action: res.suggestion.action,
          luqoHint: res.suggestion.luqoHint,
          startAt,
          endAt,
        };

        setPeriod(next);
        saveFocusPeriod(next);
      } catch (e: any) {
        console.error("failed to create focus period", e);
        setError(e?.message ?? "focus_update_failed");
      } finally {
        setLoading(false);
      }
    },
    [lu, q, o],
  );

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
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

      await createNewPeriod(options);
    },
    [createNewPeriod],
  );

  // 初回マウント時のみ実行（無限ループを防ぐ）
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回のみ実行

  return { period, loading, error, refresh };
}
