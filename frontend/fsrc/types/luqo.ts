export type LuqoScore = {
  LU: number;
  Q: number;
  O: number;
  total: number;
  reasoning?: string;

  // ★追加: インシデント監査による調整結果
  adjustments?: {
    delta: number;       // 加減算の合計値 (+20, -10 等)
    badges: string[];    // 獲得バッジ ("🛡️" 等)
    reasons: string[];   // 調整理由のリスト
  };

  // ★追加: AIが生成するUI用メタデータ
  ui: {
    headline: string;   // 例: "素晴らしい！Qスコアが急上昇中です"
    greeting: string;   // 例: "お疲れ様、佐藤さん。昨日のクロス貼りは完璧でしたね"
    color: string;      // 例: "#15803d" (AIが雰囲気に合わせて色コードも決める)
    icon: string;      // 例: "fire"
    theme: {
      color: string;           // ベースカラー (Seed Color)
      shape: "rounded" | "cut" | "sharp"; // 形状ファミリー
      radiusLevel: number;     // 0(四角) ~ 100(完全な丸)
      vibe: "calm" | "energetic" | "professional"; // アニメーション用
    };
  };
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
