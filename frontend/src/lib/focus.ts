// frontend/src/lib/focus.ts

// Bandit が返してくる KPI 種別と揃える
export type FocusKpi = "quality" | "growth" | "innovation";

export type FocusPeriod = {
  id: string;
  kpi: FocusKpi;
  action: string; // 具体的な行動提案
  luqoHint: string; // LUQO 観点のヒント
  startAt: string; // ISO文字列
  endAt: string; // ISO文字列（start + 14日）
};

const STORAGE_KEY = "luqo.focusPeriod.v1";

// 2週間後の日時を計算
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// localStorage から現在のフォーカスを復元
export function loadFocusPeriod(now = new Date()): FocusPeriod | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FocusPeriod;
    const end = new Date(parsed.endAt);
    if (isNaN(end.getTime())) return null;

    // 期限切れなら null
    if (end.getTime() < now.getTime()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveFocusPeriod(period: FocusPeriod) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(period));
}

export function clearFocusPeriod() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
