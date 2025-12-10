-- ============================================================
-- LUQO App - Supabase スキーマ定義
-- このSQLをSupabaseのSQLエディタで実行してください
-- ============================================================

-- 1. クリーンアップ (古い関数の削除)
-- ============================================================
DROP FUNCTION IF EXISTS vote_star(uuid, text, uuid, text, text);
DROP FUNCTION IF EXISTS vote_star(uuid, text, text, text);
DROP FUNCTION IF EXISTS get_accounting_stats(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_accounting_stats(text, text);
DROP FUNCTION IF EXISTS get_ops_ranking(timestamptz, timestamptz, int);
DROP FUNCTION IF EXISTS get_ops_ranking(text, text, int);

-- ============================================================
-- 2. テーブル定義 (基本構造)
-- ============================================================

-- ユーザープロフィール (Authと連動)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email text,
  name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 既存のテーブルにupdated_atカラムが存在しない場合は追加
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- イベントログ (Core)
CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  kind text NOT NULL,
  created_at timestamptz DEFAULT now(),
  text text,
  payload jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS events_user_id_created_at_idx ON events (user_id, created_at);
CREATE INDEX IF NOT EXISTS events_kind_created_at_idx ON events (kind, created_at);

-- 確定スコアの重複防止インデックス
CREATE UNIQUE INDEX IF NOT EXISTS unique_fixed_score_per_month 
ON events (user_id, (payload->>'month')) 
WHERE kind = 'luqo_score_fixed';

-- 取引先マスタ
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 取引先名の重複を防ぐUNIQUE制約
-- ⚠️ 注意: 既存のテーブルに重複データがある場合、この制約追加は失敗します
-- その場合は、先に fix_duplicate_clients.sql を実行して重複を削除してください
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clients_name_unique' 
    AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients 
    ADD CONSTRAINT clients_name_unique UNIQUE (name);
  END IF;
END $$;

-- シーズン管理 (排他制御付き)
CREATE TABLE IF NOT EXISTS public.active_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_event_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_season ON active_seasons (is_active) WHERE is_active = true;

-- 状態保持用 (Bandit / Star)
CREATE TABLE IF NOT EXISTS public.bandit_states (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  state jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.star_states (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  state jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Tスコア定義関連 (DAO)
CREATE TABLE IF NOT EXISTS public.star_definitions (
  id text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  points int NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.star_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id uuid REFERENCES auth.users(id),
  change_type text NOT NULL,
  target_id text,
  new_definition jsonb,
  reason text NOT NULL,
  ai_review_comment text,
  ai_approval boolean,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.star_proposal_votes (
  proposal_id uuid REFERENCES star_proposals(id) ON DELETE CASCADE,
  voter_id uuid REFERENCES auth.users(id),
  vote text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (proposal_id, voter_id)
);

-- ============================================================
-- 3. 自動処理トリガー
-- ============================================================

-- 新規ユーザー登録時のプロフィール作成
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, 'No Name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profilesテーブルのupdated_at自動更新
-- カラムが存在する場合のみ更新する安全な実装
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  -- updated_atカラムが存在する場合のみ更新
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = TG_TABLE_SCHEMA 
    AND table_name = TG_TABLE_NAME 
    AND column_name = 'updated_at'
  ) THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. RPC 関数定義 (ビジネスロジック)
-- ============================================================

-- A. 会計集計 (逆仕訳のマイナス金額を含めて集計)
CREATE OR REPLACE FUNCTION get_accounting_stats(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_sales numeric;
  total_expenses numeric;
BEGIN
  -- 売上集計（逆仕訳のマイナス金額も含める - 自動的に相殺される）
  SELECT coalesce(sum((payload->>'amount')::numeric), 0) INTO total_sales
  FROM events
  WHERE kind = 'accounting_sale_registered'
    AND created_at >= start_date AND created_at < end_date;
    -- 逆仕訳（isReversal: true）はマイナス金額で作成されるため、集計に含めれば自動的に相殺される

  -- 経費集計（承認済みまたは審議中、逆仕訳のマイナス金額も含める）
  SELECT coalesce(sum((payload->>'amount')::numeric), 0) INTO total_expenses
  FROM events
  WHERE kind = 'accounting_expense_registered'
    AND (payload->>'status' = 'approved' OR payload->>'status' = 'pending_vote')
    AND created_at >= start_date AND created_at < end_date;
    -- 逆仕訳（isReversal: true）はマイナス金額で作成されるため、集計に含めれば自動的に相殺される

  RETURN json_build_object('sales', total_sales, 'expenses', total_expenses);
END;
$$;

-- B. Opsランキング
CREATE OR REPLACE FUNCTION get_ops_ranking(
  start_date timestamptz,
  end_date timestamptz,
  limit_count int DEFAULT 5
)
RETURNS TABLE (user_id uuid, points bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.user_id,
    sum((e.payload->>'amount')::numeric)::bigint as total_points
  FROM events e
  WHERE e.kind = 'ops_point_granted'
    AND e.created_at >= start_date AND e.created_at < end_date
  GROUP BY e.user_id
  ORDER BY total_points DESC
  LIMIT limit_count;
END;
$$;

-- C. スター投票（整理版）
-- この関数は vote_star_clean.sql を参照してください
-- メンテナンス性を向上させるため、整理版を使用することを推奨します

-- ============================================================
-- 5. RLS (Row Level Security) 設定
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandit_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_seasons ENABLE ROW LEVEL SECURITY;

-- 既存ポリシー削除
DROP POLICY IF EXISTS "Public Read Profiles" ON profiles;
DROP POLICY IF EXISTS "Own Update Profiles" ON profiles;
DROP POLICY IF EXISTS "Public Read Profiles" ON profiles;
DROP POLICY IF EXISTS "Own Update Profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Read Clients" ON clients;
DROP POLICY IF EXISTS "Read Star Defs" ON star_definitions;
DROP POLICY IF EXISTS "Read Star States" ON star_states;
DROP POLICY IF EXISTS "Read Active Seasons" ON active_seasons;
DROP POLICY IF EXISTS "Users can view own bandit state" ON bandit_states;
DROP POLICY IF EXISTS "Users can update own bandit state" ON bandit_states;
DROP POLICY IF EXISTS "Users can insert own bandit state" ON bandit_states;

-- Profiles: 全員が読み取り可能、自分のみ更新可能
CREATE POLICY "Public Read Profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own Update Profiles" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Events: 自分のイベントのみ読み書き可能
CREATE POLICY "Users can view own events" ON events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Master Data: 全員読み取り可能
CREATE POLICY "Read Clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read Star Defs" ON star_definitions FOR SELECT TO authenticated USING (true);

-- Star States: 全員読み取り可能（RPC経由で更新）
CREATE POLICY "Read Star States" ON star_states FOR SELECT TO authenticated USING (true);

-- Active Seasons: 全員読み取り可能（書き込みはサービスロールのみ）
CREATE POLICY "Read Active Seasons" ON active_seasons FOR SELECT TO authenticated USING (true);

-- Bandit States: 自分のみ読み書き可能
CREATE POLICY "Users can view own bandit state" ON bandit_states FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own bandit state" ON bandit_states FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bandit state" ON bandit_states FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. 初期データ投入 (サンプル)
-- ============================================================

-- 取引先マスタ（初期データ投入）
-- ⚠️ 注意: UNIQUE制約が追加されている場合のみ、ON CONFLICT句が機能します
INSERT INTO clients (name) VALUES 
  ('株式会社LUQO工務店'),
  ('大和ハウス工業'),
  ('積水ハウス')
ON CONFLICT (name) DO NOTHING;

-- スターカタログ初期化
INSERT INTO star_definitions (id, category, label, points) VALUES
  ('p1', 'putty', '材料計量の正確さ', 1),
  ('p2', 'putty', '道具準備・清掃', 1),
  ('p3', 'putty', '安全・衛生管理', 1),
  ('p4', 'putty', 'パテ練り精度', 2),
  ('p5', 'putty', '下パテ塗り厚管理', 3),
  ('p6', 'putty', 'サンダー削りの均一性', 6),
  ('p7', 'putty', '粉塵管理', 2),
  ('p8', 'putty', '隣接面への配慮', 2),
  ('p9', 'putty', 'クラック補修', 3),
  ('p10', 'putty', '下パテフラットボックス', 4),
  ('p11', 'putty', '上パテ仕上げ品質', 6),
  ('p12', 'putty', '上パテフラットボックス施工', 6),
  ('p13', 'putty', '曲面・特殊部位対応', 5),
  ('p14', 'putty', '作業速度（300㎡以上）', 8),
  ('c1', 'cloth', '糊付け', 2),
  ('c2', 'cloth', '道具管理（常に即使用状態）', 2),
  ('c3', 'cloth', '平場の施工（厚ベラ捌き等）', 4),
  ('c4', 'cloth', '天井貼り（6畳以上）', 6),
  ('c5', 'cloth', 'ジョイント処理（突き付け/重ね切り）', 6),
  ('c6', 'cloth', '入隅・出隅納まり', 3),
  ('c7', 'cloth', '施工不能箇所なし', 5),
  ('c8', 'cloth', '柄物クロスのリピート合わせ', 4),
  ('c9', 'cloth', '寸法取り（正確な割り出し）', 8),
  ('c10', 'cloth', '天井貼り（6m以上・アシスト無）', 10),
  ('c11', 'cloth', '一日50㎡以上 安定品質', 5),
  ('c12', 'cloth', '一日75㎡以上（洋間+α）', 10),
  ('c13', 'cloth', '一日100㎡以上（同日施工）', 25),
  ('c14', 'cloth', '3階建て現場を一人で完全施工', 20),
  ('c15', 'cloth', 'すべての問題に対応可能', 10)
ON CONFLICT (id) DO NOTHING;
