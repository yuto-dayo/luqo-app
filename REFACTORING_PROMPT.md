# リファクタリング継続プロンプト

## 現在の状況

スパゲッティ化しているコードのリファクタリングを進めています。以下の作業が完了しています：

### ✅ 完了したリファクタリング

1. **WorkCategoryEditPage.tsx** (557行 → 約227行)
   - 3つのモーダルコンポーネントを別ファイルに分離
   - `frontend/fsrc/components/accounting/AddCategoryProposalModal.tsx`
   - `frontend/fsrc/components/accounting/DeleteCategoryProposalModal.tsx`
   - `frontend/fsrc/components/accounting/WeightProposalModal.tsx`

2. **AccountingPage.tsx** (803行)
   - 取り消しモーダルを `VoidTransactionModal.tsx` に分離
   - インラインスタイルをCSS Modulesに移行
   - `AccountingPage.module.css` を作成（Retro Game Mode対応含む）

### 🔄 残りのタスク

以下の2つのファイルがまだスパゲッティ化しています：

1. **SalesInputModal.tsx** (811行)
   - 大量のインラインスタイル
   - 複雑な条件分岐（売上/経費モード）
   - ファイルアップロード、フォーム、カテゴリ選択が混在
   - 品名リストのロジックが複雑（数量×単価の計算など）

2. **PaymasterCard.tsx** (1179行)
   - 非常に長いファイル
   - 複数のuseState、useEffect、useMemoが混在
   - シミュレーションロジックとUI描画が混在

## リファクタリング方針

### SalesInputModal.tsx のリファクタリング

1. **CSS Modules化**
   - インラインスタイルを `SalesInputModal.module.css` に移行
   - Retro Game Mode対応を含める

2. **コンポーネント分割**
   - ファイルアップロード部分を `FileUploadSection.tsx` に分離
   - 売上入力フォームを `SalesFormSection.tsx` に分離
   - 経費入力フォームを `ExpenseFormSection.tsx` に分離
   - カテゴリ選択部分を `CategorySelector.tsx` に分離
   - 品名リスト部分を `ExpenseItemList.tsx` に分離

3. **ロジック分離**
   - バリデーションロジックをカスタムフックに分離
   - 品名合計計算ロジックをユーティリティ関数に分離

### PaymasterCard.tsx のリファクタリング

1. **ロジック分離**
   - シミュレーションロジックを `usePayrollSimulation.ts` に分離
   - データ取得ロジックを `usePaymasterData.ts` に分離

2. **コンポーネント分割**
   - 利益入力セクションを `ProfitInputSection.tsx` に分離
   - チームランキングセクションを `TeamRankingSection.tsx` に分離
   - カテゴリ内訳セクションを `CategoryBreakdownSection.tsx` に分離
   - シミュレーション結果表示を `SimulationResult.tsx` に分離

3. **CSS Modules化**
   - インラインスタイルを `PaymasterCard.module.css` に移行

## プロジェクトルール

- **Language:** すべての回答、解説、コミットメッセージは「日本語」で行うこと
- **Styling:** Tailwindは使用せず、**CSS Modules** で記述すること
- **Variable First:** 色や数値をハードコードせず、必ず `global.css` で定義された変数を使用すること
- **Retro Game Mode:** CSS変数 (`var(--...)`) を使用して、モード切り替えに対応できるコードを書くこと

## 次のステップ

1. `SalesInputModal.tsx` のリファクタリングから開始
2. 完了したら `PaymasterCard.tsx` のリファクタリングに進む
3. 各リファクタリング完了後に動作確認とコミット

## 参考情報

- 最新のコミット: `25932df feat: 工事カテゴリ編集・経費承認機能の追加`
- リファクタリング前の状態はこのコミットで保存済み








