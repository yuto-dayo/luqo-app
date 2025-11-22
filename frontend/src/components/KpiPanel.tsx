import React, { useEffect, useState } from "react";

// 6週間（42日）
const SIX_WEEKS_DAYS = 42;
const STORAGE_KEY = "luqo-kpi-period-start";

// 今期（6週間スパン）のKPIメッセージ
const CURRENT_KPI_MESSAGE = "ミスが出やすい1箇所だけ改善しよう";

type KpiPeriodState = {
  periodStart: Date;
  daysLeft: number;
};

function calcDaysLeft(start: Date): number {
  const now = new Date();
  const elapsedMs = now.getTime() - start.getTime();
  const totalMs = SIX_WEEKS_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = totalMs - elapsedMs;
  // 0日以下になったらマイナスも許容（ボタン表示トリガーに使う）
  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

export const KpiPanel: React.FC = () => {
  const [state, setState] = useState<KpiPeriodState | null>(null);

  // 初期ロード時にローカルストレージから期間開始日を取得
  useEffect(() => {
    let start: Date;
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = new Date(stored);
      if (!Number.isNaN(parsed.getTime())) {
        start = parsed;
      } else {
        start = new Date();
      }
    } else {
      start = new Date();
      window.localStorage.setItem(STORAGE_KEY, start.toISOString());
    }

    setState({
      periodStart: start,
      daysLeft: calcDaysLeft(start),
    });
  }, []);

  const handleResetPeriod = () => {
    const now = new Date();
    window.localStorage.setItem(STORAGE_KEY, now.toISOString());
    setState({
      periodStart: now,
      daysLeft: calcDaysLeft(now),
    });
    // 将来的にはここで「次のKPIメッセージ」を取得するAPIを叩く
  };

  const daysLeft = state?.daysLeft ?? SIX_WEEKS_DAYS;
  const canUpdate = daysLeft <= 0;

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <p className="card__eyebrow">KPI / 6週間スパン</p>
          <h2 className="card__title">今期のKPI</h2>
        </div>
        <span className="card__status">
          {canUpdate ? "更新可能" : `残り ${daysLeft} 日`}
        </span>
      </header>

      <p className="kpi-panel__action" style={{ fontSize: 16, fontWeight: 500 }}>
        {CURRENT_KPI_MESSAGE}
      </p>

      <div className="kpi-panel__footer">
        <span className="kpi-panel__countdown">
          {canUpdate
            ? "6週間が経過しました。KPIを見直しましょう。"
            : "このKPIを6週間かけてじっくり回します。"}
        </span>
        {canUpdate && (
          <button
            type="button"
            className="kpi-panel__update-button"
            onClick={handleResetPeriod}
          >
            KPIを更新
          </button>
        )}
      </div>
    </section>
  );
};
