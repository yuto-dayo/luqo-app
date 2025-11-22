import { useEffect, useMemo, useRef, useState } from "react";
import type { KpiKey, LuqoScore } from "../types/luqo";
import { apiClient } from "../lib/apiClient";

type State = {
  status: "idle" | "loading" | "ready" | "error";
  data?: unknown;
};

const DEFAULT_SCORE: LuqoScore = { LU: 60, Q: 70, O: 40, total: 170 };

export function useBanditSuggestion(kpi: KpiKey, scoreInput?: LuqoScore | null): State {
  const [state, setState] = useState<State>({ status: "idle" });
  const onceRef = useRef(false);

  const score = useMemo(
    () => scoreInput ?? DEFAULT_SCORE,
    [scoreInput?.LU, scoreInput?.Q, scoreInput?.O, scoreInput?.total],
  );

  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;

    const controller = new AbortController();

    (async () => {
      setState({ status: "loading" });
      try {
        const json = await apiClient.post(
          "/bandit/suggest",
          { kpi, score },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setState({ status: "ready", data: json });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [kpi, score.LU, score.Q, score.O, score.total]);

  return state;
}
