# スパゲッティコード分析レポート

## 🔴 最優先でリファクタリングが必要なファイル

### 1. `frontend/fsrc/components/AiChatFab.tsx` (1178行)
**問題点:**
- 非常に長いコンポーネント（1178行）
- 複数の責務が混在：
  - FABボタンの表示・ドラッグ機能
  - チャットウィンドウのUI
  - ニュースチッカーの表示
  - 過去ログ履歴モーダル
  - チーム要約機能
  - クイックログモード
- インラインスタイルが大量（保守性が低い）
- 複雑な状態管理（複数のuseState、useEffect）
- レスポンシブ対応のロジックが散在

**推奨リファクタリング:**
- コンポーネント分割：
  - `AiChatFab.tsx` → FABボタンのみ
  - `ChatWindow.tsx` → チャットウィンドウ本体
  - `NewsTicker.tsx` → ニュースチッカー
  - `LogHistoryModal.tsx` → 過去ログ履歴モーダル
  - `TeamSummaryTab.tsx` → チーム要約タブ
  - `QuickLogMode.tsx` → クイックログモード
- スタイルをCSS Modulesに移行
- カスタムフックでロジックを分離

---

### 2. `server/ssrc/routes/logs.ts` (619行)
**問題点:**
- 複数のエンドポイントが1つのファイルに集約：
  - `POST /` - ログ投稿
  - `GET /history` - 過去ログ取得
  - `GET /history/all` - 全員のログ取得
  - `GET /news` - AIニュース生成
  - `GET /summary` - チーム要約生成
- 重複したロジック：
  - 認証チェック（各エンドポイントで同じパターン）
  - 日付処理（複数箇所で同じ計算）
  - 統計計算（ユーザー別ログ数、日別ログ数など）
- 深いネスト（エラーハンドリング、バリデーション）

**推奨リファクタリング:**
- エンドポイントを分割：
  - `routes/logs/post.ts` - ログ投稿
  - `routes/logs/history.ts` - 過去ログ取得
  - `routes/logs/news.ts` - ニュース生成
  - `routes/logs/summary.ts` - 要約生成
- 共通ロジックを抽出：
  - `lib/logs/auth.ts` - 認証チェック
  - `lib/logs/dateUtils.ts` - 日付処理
  - `lib/logs/statistics.ts` - 統計計算
- ミドルウェア化（認証チェックなど）

---

## 🟡 リファクタリング推奨ファイル

### 3. `frontend/fsrc/components/PaymasterCard.tsx` (501行)
**問題点:**
- 長いコンポーネント（501行）
- 複数の責務：
  - 給与予測の表示
  - シミュレーション計算
  - チームデータ取得
  - UI描画
- インラインスタイルが多い

**推奨リファクタリング:**
- コンポーネント分割：
  - `PaymasterHero.tsx` - ヒーロー表示部分
  - `PaymasterControls.tsx` - コントロール部分
  - `TeamDistribution.tsx` - チーム分布表示
- カスタムフック：
  - `usePayrollSimulation.ts` - シミュレーション計算（既に部分的に存在）
  - `useTeamStats.ts` - チームデータ取得

---

### 4. `frontend/fsrc/lib/api.ts` (470行)
**問題点:**
- 複数のAPI関数が1つのファイルに集約
- 型定義も混在
- 機能ごとにグループ化されているが、ファイルが長い

**推奨リファクタリング:**
- 機能別に分割：
  - `api/logs.ts` - ログ関連API
  - `api/luqo.ts` - LUQOスコア関連API
  - `api/bandit.ts` - Bandit関連API
  - `api/payroll.ts` - 給与関連API
  - `api/tscore.ts` - T-Score関連API
  - `api/evaluations.ts` - 評価関連API
  - `api/users.ts` - ユーザー関連API
- 型定義は `types/` ディレクトリに移動

---

### 5. `server/ssrc/routes/accounting.ts` (415行)
**問題点:**
- 複数のエンドポイントが1つのファイルに集約：
  - `POST /analyze` - レシート/請求書解析
  - `POST /void` - 取引取り消し
  - `POST /sales` - 売上登録
  - `POST /expenses` - 経費申請
  - `GET /dashboard` - ダッシュボード取得
- 重複したバリデーションロジック

**推奨リファクタリング:**
- エンドポイントを分割：
  - `routes/accounting/analyze.ts` - 解析
  - `routes/accounting/transactions.ts` - 取引（売上・経費・取り消し）
  - `routes/accounting/dashboard.ts` - ダッシュボード
- 共通ロジックを抽出：
  - `lib/accounting/validation.ts` - バリデーション
  - `lib/accounting/calculations.ts` - 計算ロジック

---

## 📊 その他の長いファイル（要監視）

- `server/ssrc/routes/bandit.ts` (374行) - 複雑なロジックあり
- `server/ssrc/routes/aiEvaluations.ts` (267行) - 比較的整理されているが、型定義が多い
- `server/ssrc/routes/agent.ts` (245行) - ツール定義が長い
- `server/ssrc/routes/luqoScore.ts` (223行) - スコア計算ロジックが複雑
- `frontend/fsrc/pages/TScorePage.tsx` (394行) - ページコンポーネントが長い
- `frontend/fsrc/pages/SettingsPage.tsx` (387行) - 設定ページが長い

---

## 🎯 リファクタリング優先順位

1. **最優先**: `AiChatFab.tsx` - 最も複雑で長い
2. **高**: `logs.ts` - 重複ロジックが多い
3. **中**: `PaymasterCard.tsx` - コンポーネント分割が容易
4. **中**: `api.ts` - 機能別分割が容易
5. **低**: `accounting.ts` - 比較的整理されている

---

## 💡 リファクタリングのベストプラクティス

1. **小さなステップで進める** - 一度に全部やらない
2. **テストを書く** - リファクタリング前後で動作確認
3. **機能追加を止める** - リファクタリング中は新機能追加を控える
4. **段階的に移行** - 古いコードと新しいコードを並行運用可能にする
