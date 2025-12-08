-- ============================================================
-- 重複した取引先データの確認・削除スクリプト
-- このSQLをSupabaseのSQLエディタで実行してください
-- ============================================================

-- 1. 重複データの確認
-- このクエリで、同じ名前の企業が何件あるか確認できます
SELECT 
  name,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM clients
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC, name;

-- ============================================================
-- 2. 重複データの削除（最新の1件を残して、古いものを削除）
-- ============================================================
-- ⚠️ 注意: このクエリは重複データを削除します。実行前に必ず上記の確認クエリで結果を見てください

-- 各企業名について、最新の1件（created_atが最も新しいもの）を残して、
-- それ以外の古いレコードを削除
WITH ranked_clients AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at DESC) as rn
  FROM clients
),
duplicates_to_delete AS (
  SELECT id
  FROM ranked_clients
  WHERE rn > 1
)
DELETE FROM clients
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- ============================================================
-- 3. 削除結果の確認（重複がなくなったことを確認）
-- ============================================================
SELECT 
  name,
  COUNT(*) as count
FROM clients
GROUP BY name
HAVING COUNT(*) > 1;

-- このクエリが0件を返せば、重複が完全に削除されています

-- ============================================================
-- 4. 将来の重複を防ぐために、nameカラムにUNIQUE制約を追加
-- ============================================================
-- 既存の重複を削除した後に実行してください

-- まず、既存のUNIQUEインデックスが存在するか確認
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'clients' 
  AND schemaname = 'public'
  AND indexdef LIKE '%UNIQUE%';

-- UNIQUE制約を追加（既存の重複がないことが前提）
ALTER TABLE clients 
ADD CONSTRAINT clients_name_unique UNIQUE (name);

-- または、UNIQUEインデックスを作成する方法（制約名を自動生成）
-- CREATE UNIQUE INDEX IF NOT EXISTS clients_name_unique_idx ON clients (name);

-- ============================================================
-- 5. 初期データ投入の修正（schema_setup.sql用）
-- ============================================================
-- 以下のように修正することで、UNIQUE制約違反時はエラーを無視できます
-- 
-- INSERT INTO clients (name) VALUES 
--   ('株式会社LUQO工務店'),
--   ('大和ハウス工業'),
--   ('積水ハウス')
-- ON CONFLICT (name) DO NOTHING;
--
-- ⚠️ 注意: UNIQUE制約を追加した後は、上記のON CONFLICT句が機能するようになります


























