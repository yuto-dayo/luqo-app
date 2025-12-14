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
    // HMR設定: PCからの開発時はHMRを有効化
    // スマホからアクセスする場合でも、PC側のHMRは正常に動作します
    hmr: {
      clientPort: 5173,
    },
  },
  // PDF.jsのワーカーファイルを正しく処理
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  // 静的アセットの設定
  publicDir: "public",
});
