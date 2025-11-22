export type LuqoScore = {
  LU: number;
  Q: number;
  O: number;
  total: number;
};

export type KpiKey = "quality" | "growth" | "innovation";

export type BanditSuggestion = {
  baseKpi: KpiKey;
  chosenKpi: KpiKey;
  action: string;
  prob: number;
  luqoHint: string;
  distribution: Record<KpiKey, number>;
};

export type BanditState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: BanditSuggestion };
