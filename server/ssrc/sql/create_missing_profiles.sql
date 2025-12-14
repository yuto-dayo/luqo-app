-- ============================================================
-- 不足しているprofilesレコードを作成するSQL
-- star_statesに存在するユーザーで、profilesにレコードがない場合に作成
-- ============================================================

-- 1. 不足しているprofilesレコードを確認
SELECT 
  ss.user_id,
  au.email,
  p.id as profile_exists
FROM star_states ss
INNER JOIN auth.users au ON ss.user_id = au.id
LEFT JOIN profiles p ON ss.user_id = p.id
WHERE p.id IS NULL;

-- 2. 不足しているprofilesレコードを作成
-- （emailの@より前の部分をnameとして使用）
INSERT INTO profiles (id, name, email, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(
    SPLIT_PART(au.email, '@', 1),  -- emailの@より前の部分
    'No Name'
  ) as name,
  au.email,
  au.created_at,
  NOW()
FROM star_states ss
INNER JOIN auth.users au ON ss.user_id = au.id
LEFT JOIN profiles p ON ss.user_id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. 作成結果を確認
SELECT 
  ss.user_id,
  p.name,
  p.email
FROM star_states ss
INNER JOIN profiles p ON ss.user_id = p.id
WHERE ss.state->'pending' != '[]'::jsonb;
