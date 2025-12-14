-- ====================================================
-- work_categories テーブル作成スクリプト
-- 工事カテゴリのマスタデータを管理するテーブル
-- TScore計算時の重み付け係数を含む
-- ====================================================

-- 1. テーブル作成
CREATE TABLE IF NOT EXISTS work_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,              -- システム内部識別子（例: 'cloth', 'electric'）
    label TEXT NOT NULL,                    -- 表示名（例: 'クロス工事', '電気工事'）
    default_weight NUMERIC(5, 2) DEFAULT 1.0 NOT NULL, -- TScore計算時の重み係数（デフォルト: 1.0）
    is_active BOOLEAN DEFAULT TRUE NOT NULL, -- アクティブフラグ
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. インデックス作成
CREATE INDEX IF NOT EXISTS idx_work_categories_code ON work_categories(code);
CREATE INDEX IF NOT EXISTS idx_work_categories_is_active ON work_categories(is_active);

-- 3. updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_work_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_work_categories_updated_at ON work_categories;
CREATE TRIGGER trigger_work_categories_updated_at
    BEFORE UPDATE ON work_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_work_categories_updated_at();

-- 4. 初期データ投入（UPSERT形式で重複を防ぐ）
INSERT INTO work_categories (code, label, default_weight, is_active)
VALUES 
    ('cloth', 'クロス工事', 1.0, TRUE),
    ('electric', '電気工事', 1.0, TRUE),
    ('floor', '床工事', 1.0, TRUE)
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    default_weight = EXCLUDED.default_weight,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 5. RLS（Row Level Security）ポリシー設定
-- 全ユーザーが参照可能（認証済みユーザー）
ALTER TABLE work_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_categories_select_policy" ON work_categories;
CREATE POLICY "work_categories_select_policy" ON work_categories
    FOR SELECT
    USING (TRUE);

-- 認証済みユーザーのみ挿入・更新可能
DROP POLICY IF EXISTS "work_categories_insert_policy" ON work_categories;
CREATE POLICY "work_categories_insert_policy" ON work_categories
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "work_categories_update_policy" ON work_categories;
CREATE POLICY "work_categories_update_policy" ON work_categories
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. コメント追加
COMMENT ON TABLE work_categories IS '工事カテゴリマスタ: TScore計算時の重み付けを管理';
COMMENT ON COLUMN work_categories.code IS 'システム内部識別子（一意キー）';
COMMENT ON COLUMN work_categories.label IS '画面表示用のカテゴリ名';
COMMENT ON COLUMN work_categories.default_weight IS 'TScore計算時の重み係数（1.0 = 標準）';
COMMENT ON COLUMN work_categories.is_active IS 'アクティブフラグ（FALSEで論理削除）';

-- ====================================================
-- 確認クエリ（実行後の確認用）
-- ====================================================
-- SELECT * FROM work_categories ORDER BY created_at;
