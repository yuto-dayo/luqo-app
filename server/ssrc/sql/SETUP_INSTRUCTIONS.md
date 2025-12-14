# スター申請システムのセットアップ手順

## 実行順序

### ステップ1: vote_star関数を更新（必須）
SupabaseのSQLエディタで `vote_star_clean.sql` の内容を実行します。

これにより、新しいシンプルなロジック（過半数ルール）が適用されます。

**重要**: この関数を更新しないと、新しい投票が古いロジックで処理されてしまいます。

### ステップ2: 既存のpending申請を再評価（推奨）
SupabaseのSQLエディタで以下を実行します：

```sql
-- 1. 関数を作成
-- fix_pending_applications.sql の内容を実行

-- 2. 再評価を実行
SELECT * FROM fix_pending_applications();
```

これにより、既存のpending申請（C13、P14、P1など）が新しいロジックで再評価され、確定可能なものは自動的に確定されます。

## 確認方法

### 関数が正しく更新されているか確認
```sql
-- verify_vote_star_function.sql を実行
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'vote_star'
  AND n.nspname = 'public';
```

### 特定のスターの状態を確認
```sql
-- check_pending_status.sql の star_id を変更して実行
-- 例: star_id text := 'c13';
```

### 全てのpending申請を確認
```sql
-- debug_pending_applications.sql を実行
```

## トラブルシューティング

### 問題: 実行後も審査中のまま
1. `vote_star_clean.sql`が正しく実行されたか確認
2. `fix_pending_applications.sql`を実行して再評価
3. フロントエンドでページをリロード

### 問題: 関数の実行エラー
- エラーメッセージを確認
- `verify_vote_star_function.sql`で関数の定義を確認
- 古い関数定義が残っていないか確認

## ロジックの確認

新しいロジックは以下の通りです：
- **閾値**: 申請者以外のユーザー数の過半数
- **確定条件**: 過半数以上が投票し、かつ承認 > 否決
- **例**: 4人の場合 → 申請者1人を除くと3人 → 過半数は2人
