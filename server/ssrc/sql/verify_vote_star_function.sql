-- vote_star関数の現在の定義を確認
-- このクエリで、Supabaseに登録されている関数のシグネチャを確認できます

SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'vote_star'
  AND n.nspname = 'public';

-- 関数が存在しない場合、または古いバージョンの場合は、以下を実行してください
-- （schema_setup.sqlのvote_star関数部分を実行）
