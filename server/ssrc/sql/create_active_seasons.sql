-- アクティブなシーズンを管理するテーブル
-- このSQLをSupabaseのSQLエディタで実行してください

create table if not exists active_seasons (
  id uuid primary key default gen_random_uuid(),
  season_event_id uuid not null, -- eventsテーブルのID
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  is_active boolean default true
);

-- 同時に「有効(is_active=true)」なレコードは1つしか存在できないようにする
create unique index if not exists unique_active_season 
on active_seasons (is_active) 
where is_active = true;

-- RLS (Row Level Security) 設定
-- 全ユーザーが読み取り可能、書き込みはサービスロールのみ（RLSをバイパス）
ALTER TABLE active_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read Active Seasons" ON active_seasons;
CREATE POLICY "Read Active Seasons" ON active_seasons
    FOR SELECT
    TO authenticated
    USING (true);
