# リリース前チェックリスト

## ✅ 完了している項目

- [x] ビルドスクリプトの設定（`npm run build`）
- [x] 環境変数の検証（起動時のチェック）
- [x] エラーハンドリングの実装
- [x] CORS設定
- [x] リクエストサイズ制限（10MB）
- [x] 認証ミドルウェア
- [x] ヘルスチェックエンドポイント（`/health`）

## ⚠️ リリース前に確認・修正が必要な項目

### 1. 環境変数の設定

#### フロントエンド（`.env` または `.env.production`）
```env
VITE_API_BASE_URL=https://your-api-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### バックエンド（`.env`）
```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_API_KEY=your-google-api-key
```

### 2. 本番環境用の設定

- [ ] `frontend/fsrc/config.ts` の `localhost` ハードコードを削除（既に環境変数を使用しているが確認）
- [ ] Viteの本番ビルド設定（`vite.config.ts`）
- [ ] サーバーの本番起動設定

### 3. ビルドの確認

```bash
# フロントエンド
cd frontend
pnpm install
pnpm build
pnpm preview  # ビルド結果の確認

# バックエンド
cd server
pnpm install
pnpm build
pnpm start  # ビルド結果の確認
```

### 4. セキュリティチェック

- [x] `.env` ファイルが `.gitignore` に含まれている
- [ ] APIキーがコードにハードコードされていない（確認済み）
- [ ] 認証トークンの適切な管理
- [ ] CORS設定が本番環境に適切

### 5. パフォーマンス

- [ ] フロントエンドのバンドルサイズ確認
- [ ] 画像やアセットの最適化
- [ ] APIレスポンス時間の確認

### 6. エラーログとモニタリング

- [ ] エラーログの収集設定（例: Sentry, LogRocket）
- [ ] 本番環境でのログレベル設定

### 7. ドキュメント

- [ ] README.md の作成
- [ ] 環境変数の説明
- [ ] デプロイ手順の記載

### 8. テスト

- [ ] 主要機能の動作確認
- [ ] 認証フローの確認
- [ ] APIエンドポイントの動作確認
- [ ] エラーケースの確認

## 🚀 デプロイ手順（例）

### フロントエンド（Vercel / Netlify など）

1. 環境変数を設定
2. ビルドコマンド: `cd frontend && pnpm build`
3. 出力ディレクトリ: `frontend/dist`

### バックエンド（Railway / Render / AWS など）

1. 環境変数を設定
2. ビルドコマンド: `cd server && pnpm build`
3. 起動コマンド: `cd server && pnpm start`
4. ポート: `process.env.PORT` または `4000`

## 📝 追加の推奨事項

- [ ] CI/CDパイプラインの設定
- [ ] ステージング環境の構築
- [ ] データベースのバックアップ設定
- [ ] ドメインとSSL証明書の設定
