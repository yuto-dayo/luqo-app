import React from "react";
import type { KpiKey } from "../types/luqo";

export const KPI_ITEMS: Record<
  KpiKey,
  { labelJa: string; labelEn: string; description: string }
> = {
  quality: {
    labelJa: "品質 (Quality)",
    labelEn: "Zero Defects",
    description: "6週間、手直し・クレーム「ゼロ」を完全継続し、信頼を盤石にする。",
  },
  growth: {
    labelJa: "成長 (Growth)",
    labelEn: "1.2x Impact",
    description: "6週間でチームの売上(または個人の技術スター)を「1.2倍」に引き上げる。",
  },
  innovation: {
    labelJa: "革新 (Innovation)",
    labelEn: "20% Efficiency",
    description: "作業時間を「20%短縮」する仕組みを発明し、17時完全撤収を実現する。",
  },
};

type Props = {
  activeKpi: KpiKey;
  onChange: (key: KpiKey) => void;
};

export const KpiHeader: React.FC<Props> = ({ activeKpi, onChange }) => {
  return (
    <header className="kpi-header">
      <div className="kpi-header__title">
        <div className="kpi-header__badge">今期 KPI</div>
        <h1 className="kpi-header__headline">
          今期はどこに集中するか（品質・成長・革新）
        </h1>
        <p className="kpi-header__sub">
          ここで選んだKPIフォーカスに、LUQOスコアとBanditの推薦行動をあとでつないでいく。
        </p>
      </div>

      <nav className="kpi-header__nav" aria-label="Current KPI focus">
        {(Object.keys(KPI_ITEMS) as KpiKey[]).map((key) => {
          const item = KPI_ITEMS[key];
          const isActive = activeKpi === key;
          return (
            <button
              key={key}
              type="button"
              className={
                "kpi-header__pill" + (isActive ? " kpi-header__pill--active" : "")
              }
              onClick={() => onChange(key)}
            >
              <span className="kpi-header__pill-label-ja">{item.labelJa}</span>
              <span className="kpi-header__pill-label-en">{item.labelEn}</span>
            </button>
          );
        })}
      </nav>

      <div className="kpi-header__active-description">
        {KPI_ITEMS[activeKpi].description}
      </div>
    </header>
  );
};
