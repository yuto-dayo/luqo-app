import React, { useState, FormEvent } from "react";
import { KpiPanel } from "../components/KpiPanel";
import { FocusCard } from "../components/FocusCard";
import {
  createLogEventRequest,
  postLog,
} from "../services/logs";
import {
  useUserId,
  useScoreReady,
  useScoreLU,
  useScoreQ,
  useScoreO,
  useScoreTotal,
  useHistoryLast,
} from "../hooks/useLuqoStore";
// 将来: Tスコア専用の hook があればここで import
// import { useTScoreCurrent } from "../hooks/useTScoreStore";
// 将来: react-router の navigate もここで import
// import { useNavigate } from "react-router-dom";

const DashboardPage: React.FC = () => {
  const userId = useUserId();
  // const navigate = useNavigate();

  // LUQOスコア（将来は2週間基準に差し替え予定）
  const lu = useScoreLU() ?? 0;
  const q = useScoreQ() ?? 0;
  const o = useScoreO() ?? 0;
  const total = useScoreTotal() ?? 0;

  const scoreReady = useScoreReady() ?? false;
  const historyBump = useHistoryLast();

  // 日次ログ state（検索バー風クイック入力用）
  const [logText, setLogText] = useState<string>("");
  const [lastSavedLog, setLastSavedLog] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Tスコア（軽量表示用）※後で hook / API に接続
  const tScore: number | null = 68.4; // useTScoreCurrent() ?? null;

  const handleLogChange = (value: string) => {
    setLogText(value);
  };

  const handleQuickLogSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = logText.trim();
    if (!text || isSaving) return;

    if (!userId) {
      console.warn("userId が取得できないためログを送信しません");
      return;
    }

    const event = createLogEventRequest({ text, userId });

    try {
      setIsSaving(true);
      await postLog(event);
      setLastSavedLog(text);
      setLogText("");
    } catch (err) {
      console.error("save error", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogReset = () => {
    setLogText("");
  };

  const handleOpenTScoreDetail = () => {
    // 将来: 詳細画面に遷移
    // navigate("/t-score");
    console.log("TODO: Tスコア詳細画面へ遷移");
  };

  const handleOpenLuqoDetail = () => {
    // 将来: 詳細画面に遷移
    // navigate("/luqo/summary");
    console.log("TODO: LUQO詳細画面へ遷移");
  };

  return (
    <main className="page page--home">
      <div className="page__content page__content--narrow">
        {/* 1. ログ入力（検索バー風＋＋ボタン） */}
        <section className="home-section">
          <form
            className="home-log-input"
            onSubmit={handleQuickLogSubmit}
          >
            <div className="home-log-input__field" style={{ flex: 1 }}>
              <input
                type="text"
                value={logText}
                onChange={(e) => handleLogChange(e.target.value)}
                placeholder={
                  lastSavedLog
                    ? `Previous: ${lastSavedLog.slice(0, 24)}…`
                    : "What did you achieve today?"
                }
                className="home-log-input__input"
                style={{ width: "100%" }}
              />
              <button
                type="submit"
                className="home-log-input__button"
                aria-label="Add Log"
                disabled={isSaving}
              >
                {isSaving ? "…" : "＋"}
              </button>
            </div>
          </form>
        </section>

        {/* 2. 2週間フォーカス（Bandit） */}
        <section className="home-section">
          <div className="home-card">
            {/* FocusCard 側のロジックを週次→2週間サイクルに調整予定 */}
            <FocusCard scoreReady={scoreReady} historyBump={historyBump} />
          </div>
        </section>

        {/* 3. 今期のKPI（一言だけ） */}
        <section className="home-section">
          <div className="home-card" style={{ padding: "var(--spacing-md)" }}>
            {/* 将来: KpiPanel に compact モードを追加して一言だけにする */}
            <KpiPanel />
          </div>
        </section>

        {/* 4. Tスコア（1行のみ） */}
        <section className="home-section">
          <div
            className="home-inline-row home-card home-card--tappable"
            role="button"
            onClick={handleOpenTScoreDetail}
            aria-label="Open T-Score Detail"
          >
            <div className="home-inline-row__left">
              <span className="home-inline-row__label">T-Score</span>
              <span className="home-inline-row__sub">
                Technical Level
              </span>
            </div>
            <div className="home-inline-row__right">
              <span className="home-inline-row__value">
                {tScore !== null ? `${tScore.toFixed(1)}` : "—"}
              </span>
              <span className="home-inline-row__chevron">›</span>
            </div>
          </div>
        </section>

        {/* 5. 今月のLUQO（1行のみ） */}
        <section className="home-section">
          <div
            className="home-inline-row home-card home-card--tappable"
            role="button"
            onClick={handleOpenLuqoDetail}
            aria-label="Open LUQO Detail"
          >
            <div className="home-inline-row__left">
              <span className="home-inline-row__label">LUQO Score</span>
              <span className="home-inline-row__sub">
                L:{lu} / Q:{q} / O:{o}
              </span>
            </div>
            <div className="home-inline-row__right">
              <span className="home-inline-row__value">{total}</span>
              <span className="home-inline-row__chevron">›</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default DashboardPage;
