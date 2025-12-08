import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    // 外部からアクセス可能にする（スマホから接続するために必要）
    host: "0.0.0.0",
    port: 5173,
    // HMR設定: スマホから接続する場合のエラーを防ぐため、HMRを無効化
    // スマホからはHMRが動作しないため、localhostへの接続エラーを防ぐ
    // 注意: PCから開発する場合は、ブラウザをリロードすれば変更が反映されます
    hmr: false,
  },
  // PDF.jsのワーカーファイルを正しく処理
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  // 静的アセットの設定
  publicDir: "public",
});
