import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUserId, useSetUserId, readHistoryOnce } from "../hooks/useLuqoStore";
import { simulatePaymasterCombo, getPersonalWeights } from "../services/luqo";
import type { PaymasterResponse, PersonalWeightsResponse } from "../lib/api";

type Props = {
  lu: number;
  q: number;
  o: number;
  total: number;
  scoreReady: boolean;
  historyBump: string | null;
};

export const PaymasterCard: React.FC<Props> = ({
  lu,
  q,
  o,
  total,
  scoreReady,
  historyBump,
}) => {
  const userId = useUserId();
  const setUserId = useSetUserId();

  const [tScore, setTScore] = useState<number>(50);
  const [result, setResult] = useState<PaymasterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalWeights, setPersonalWeights] =
    useState<PersonalWeightsResponse | null>(null);

  const onceRef = useRef(false);

  const handleSimulate = useCallback(async () => {
    setError(null);
    setResult(null);
    if (!scoreReady) {
      setError("先に LUQO スコアを更新してください。");
      return;
    }
    try {
      setLoading(true);
      const history = readHistoryOnce();
      const res = await simulatePaymasterCombo({
        userId: userId || "demo-user",
        lu,
        q,
        o,
        tScore: Number.isFinite(tScore) ? tScore : 0,
        history,
      });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId, lu, q, o, tScore, scoreReady]);

  useEffect(() => {
    if (onceRef.current || !scoreReady) return;
    if (historyBump === null) return;
    onceRef.current = true;
    void handleSimulate();
  }, [scoreReady, historyBump, handleSimulate]);

  const handleDebugWeights = useCallback(async () => {
    try {
      const weights = await getPersonalWeights({
        userId: userId || "demo-user",
        history: readHistoryOnce(),
        temperature: 0.3,
      });
      setPersonalWeights(weights);
    } catch (e) {
      console.error("bandit personal error", e);
    }
  }, [userId]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>報酬シミュレーター（Paymaster β）</h3>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        LUQO × Tスコアから「combo 指標」を計算する簡易シミュレーター。
        <br />
        現在の LUQO: LU {lu} / Q {q} / O {o} / total {total}
      </div>

      <label style={{ fontSize: 14 }}>
        userId:
        <input
          type="text"
          value={userId ?? ""}
          onChange={(e) => setUserId(e.target.value)}
          style={{ marginLeft: 8, padding: 4, fontSize: 14 }}
        />
      </label>

      <label style={{ fontSize: 14 }}>
        Tスコア:
        <input
          type="number"
          value={tScore}
          onChange={(e) => setTScore(Number(e.target.value))}
          style={{ marginLeft: 8, padding: 4, width: 80, fontSize: 14 }}
        />
      </label>

      <button
        onClick={handleSimulate}
        disabled={loading || !scoreReady}
        style={{ marginTop: 6 }}
      >
        {loading ? "計算中..." : "combo を計算"}
      </button>

      {error && (
        <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>
          エラー: {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        >
          <div>userId: {result.userId}</div>
          <div>LUQO合計: {result.luqoTotal.toFixed(1)}</div>
          <div>
            LUQO重み: LU={result.luqoWeights.lu.toFixed(2)} / Q=
            {result.luqoWeights.q.toFixed(2)} / O=
            {result.luqoWeights.o.toFixed(2)}
          </div>
          <div style={{ marginTop: 4, fontWeight: 600 }}>
            combo: {result.combo.toFixed(1)}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleDebugWeights}
        style={{ marginTop: 8, padding: "4px 8px", fontSize: 12 }}
      >
        個人バンディット重みを再計算
      </button>

      {personalWeights && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div>
            Weights: LU={personalWeights.weights.lu.toFixed(2)} /
            Q={personalWeights.weights.q.toFixed(2)} /
            O={personalWeights.weights.o.toFixed(2)}
          </div>
          <div>
            Corr: LU={personalWeights.correlations.lu.toFixed(2)} /
            Q={personalWeights.correlations.q.toFixed(2)} /
            O={personalWeights.correlations.o.toFixed(2)}
          </div>
          <div>
            Room: LU={personalWeights.room.lu.toFixed(2)} /
            Q={personalWeights.room.q.toFixed(2)} /
            O={personalWeights.room.o.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
};
