-- profilesテーブルの作成（またはnameカラムの追加）
-- このSQLをSupabaseのSQLエディタで実行してください

-- テーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 既にテーブルが存在する場合は、nameカラムを追加
-- （カラムが既に存在する場合はエラーになりますが、問題ありません）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS name text;

-- RLS (Row Level Security) ポリシーの設定
-- ユーザーは自分のプロフィールのみ読み取り・更新可能
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（必要に応じて）
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 読み取りポリシー: 自分のプロフィールのみ閲覧可能
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- 更新ポリシー: 自分のプロフィールのみ更新可能
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- 挿入ポリシー: 自分のプロフィールのみ挿入可能
CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- updated_atを自動更新するトリガー関数（オプション）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
