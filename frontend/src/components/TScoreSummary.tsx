import React from "react";

type TScoreSummaryProps = {
  tScore: number;
  currentStars: number;
  nextTarget: number;
};

export const TScoreSummary: React.FC<TScoreSummaryProps> = ({
  tScore,
  currentStars,
  nextTarget,
}) => {
  const targetDiff = Math.max(0, nextTarget - currentStars);

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <p className="card__eyebrow">Tスコア</p>
          <h2 className="card__title">今週のスター進捗</h2>
        </div>
        <span className="card__status">Auto-sync</span>
      </header>
      <div className="tscore-summary">
        <div className="tscore-summary__value">
          <strong>{tScore.toFixed(1)}</strong>
          <span>/ 100 pt</span>
        </div>
        <p className="tscore-summary__hint">
          次の目標スターまで <strong>{targetDiff}</strong> 個
        </p>
        <p className="tscore-summary__hint">
          現在: {currentStars} / 170 ⭐️（参考）
        </p>
      </div>
    </section>
  );
};
