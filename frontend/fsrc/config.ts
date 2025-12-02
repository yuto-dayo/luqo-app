// Vite の環境変数（.env）から API のベースURLを取得
// 例: VITE_API_BASE_URL="http://localhost:4000"
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
