/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_OPENAI_KEY?: string;
  // 必要なら追加で定義（例: VITE_SHEET_ID など）
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
