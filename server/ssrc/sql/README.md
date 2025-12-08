# SQLスクリプト一覧

## 本番環境で使用するスクリプト

### `vote_star_clean.sql` ⭐ **推奨**
- **用途**: スター申請・投票機能のメイン関数
- **説明**: シンプルで分かりやすいロジックに完全リニューアル
- **ロジック**: 
  1. 自分で申請（apply）→ pendingに追加
  2. 他のユーザーが投票（approve/reject/pass）
  3. **申請者以外のユーザー数の過半数以上が承認したら → スター獲得**
- **閾値**: 申請者以外のユーザー数の過半数（例: 4人の場合 → 申請者1人を除くと3人 → 過半数は2人）
- **実行**: SupabaseのSQLエディタで実行
- **変更履歴**: 
  - 2025年 - シンプルなロジックに完全リニューアル
  - 複雑な計算を削除し、過半数ルールに統一
  - 全てのスター申請に共通する汎用的なロジック

## デバッグ・確認用スクリプト

### `debug_pending_applications.sql`
- **用途**: 全てのpending申請の詳細なデバッグ情報を表示
- **実行**: 承認が確定しない原因を調査する場合
- **特徴**: 全てのスター申請に共通して使用可能

### `check_pending_status.sql`
- **用途**: 任意のスター申請の状態と投票状況を確認
- **実行**: 特定のスターIDの状態を確認したい場合
- **使用方法**: スクリプト内の`star_id`変数を変更して実行（例: 'p14', 'p1', 'c1' など）

### `verify_vote_star_function.sql`
- **用途**: vote_star関数の現在の定義を確認
- **実行**: 関数が正しく登録されているか確認したい場合

## 修正・再評価用スクリプト

### `fix_pending_applications.sql` ⭐ **推奨**
- **用途**: 全てのpending申請を新しいシンプルなロジックで再評価し、確定可能なものは確定する
- **実行**: 一括で既存申請を新しいロジックで再評価したい場合
- **特徴**: 全てのスター申請に共通して使用可能（P14、P1、C1など全て対応）
- **実行方法**:
  ```sql
  SELECT * FROM fix_pending_applications();
  ```


## 新しいシンプルなロジックの特徴

### 基本的な流れ
1. **申請**: 自分で申請（apply）→ pendingに追加
2. **投票**: 他のユーザーが投票（approve/reject/pass）
3. **確定**: 申請者以外のユーザー数の過半数以上が承認したら確定

### 閾値の計算
- **申請者以外のユーザー数の過半数**
- 例: 4人の場合 → 申請者1人を除くと3人 → 過半数は2人
- 例: 3人の場合 → 申請者1人を除くと2人 → 過半数は1人（最小1票）

### 確定条件
- **承認確定**: 過半数以上が投票し、かつ承認 > 否決
- **否決確定**: 過半数以上が投票し、かつ否決 >= 承認
- **未確定**: 過半数に達していない、または同数の場合

### 汎用性
- **全てのスター申請に共通**: P1、P14、C1など、どのスターIDでも同じロジックで動作
- **特定のスターに限定しない**: 一つのスクリプトで全ての申請を処理可能

## 使用方法

### 初回セットアップ
1. `vote_star_clean.sql`を実行して関数を登録

### 問題発生時
1. **状態確認**: `debug_pending_applications.sql`を実行して、全てのpending申請の状態を確認
2. **特定スター確認**: `check_pending_status.sql`を実行して、特定のスターの状態を確認（star_id変数を変更）
3. **再評価**: `fix_pending_applications.sql`を実行して、確定可能な申請を確定させる
   ```sql
   SELECT * FROM fix_pending_applications();
   ```

### 関数の確認
- `verify_vote_star_function.sql`を実行して、関数が正しく登録されているか確認

## 自動確定機能

`vote_star`関数は、投票時に自動的に確定判定を行います：

1. **新しい投票が入った時**: 自動的に確定判定が実行される
2. **過半数以上が承認した場合**: 自動的に確定（pendingから削除、acquiredに追加）
3. **過半数以上が否決した場合**: 自動的に確定（pendingから削除）

手動で`fix_pending_applications()`を実行する必要はありません。新しい投票が入った時に自動的に確定されます。

## 削除されたファイル（統合済み）

以下のファイルは汎用的なスクリプトに統合され、削除されました：
- `fix_p14_pending.sql` → `fix_pending_applications.sql`に統合
- `check_p14_status.sql` → `check_pending_status.sql`に統合
- `quick_check_c13.sql` → 削除（特定スター用）
- `check_p4_status.sql` → 削除（特定スター用）
- `force_fix_c13.sql` → 削除（特定スター用）
- `quick_fix_pending_p1.sql` → `fix_pending_applications.sql`に統合
- `force_approve_p1.sql` → 削除（強制承認は危険なため）
- `manual_approve_p1.sql` → 削除
- `check_vote_with_applicant.sql` → `debug_pending_applications.sql`に統合
- `check_actual_votes.sql` → `debug_pending_applications.sql`に統合
- `check_existing_pending.sql` → `debug_pending_applications.sql`に統合
- `check_all_pending.sql` → `debug_pending_applications.sql`に統合
- `migrate_existing_pending.sql` → `fix_pending_applications.sql`に統合
- `fix_pending_simple.sql` → `fix_pending_applications.sql`に統合
- `fix_vote_star_apply.sql` → 非推奨（古いバージョン）
- `rpc_vote_star.sql` → 非推奨（古いバージョン）
- `check_and_fix_vote_star.sql` → 削除（古いファイル）
- `test_vote_star.sql` → 削除（テスト用）
- `verify_vote_star_logic.sql` → 削除（診断用）
- `FINAL_FIX_P1.md` → 削除（不要なドキュメント）
- `COMPLETE_FIX_GUIDE.md` → 削除（古いガイド）
- `DIAGNOSIS.md` → 削除（一時的な診断ドキュメント）
- `EXECUTE_FIX.md` → 削除（一時的な手順書）
