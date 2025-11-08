/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_OPENAI_KEY?: string;
  // 追加したい環境変数があればここに追記
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
