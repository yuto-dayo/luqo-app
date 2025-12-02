# LUQO App

建設現場の職人を支えるAIパートナー「LUQO Bot」を搭載したアプリケーション。

## 構成

- **Frontend**: React + TypeScript + Vite (`frontend/`)
- **Backend**: Express + TypeScript (`server/`)

## セットアップ

### 必要な環境

- Node.js 18以上
- pnpm（推奨）または npm

### フロントエンド

```bash
cd frontend
pnpm install
cp .env.example .env  # 環境変数を設定
pnpm dev
```

### バックエンド

```bash
cd server
pnpm install
cp .env.example .env  # 環境変数を設定
pnpm dev
```

## 環境変数

### フロントエンド（`frontend/.env`）

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### バックエンド（`server/.env`）

```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_API_KEY=your-google-api-key
```

## ビルド

### フロントエンド

```bash
cd frontend
pnpm build
```

出力: `frontend/dist/`

### バックエンド

```bash
cd server
pnpm build
```

出力: `server/dist/`

## デプロイ

詳細は `RELEASE_CHECKLIST.md` を参照してください。

## 主な機能

- **LUQOスコア**: AIによる作業評価
- **AIチャット**: 過去ログ参照機能付きのAIコーチ
- **経費管理**: 経費申請と承認フロー
- **Tスコア**: スター獲得システム
- **給与計算**: Paymaster連携

## ライセンス

ISC
