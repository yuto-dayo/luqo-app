-- 任意のスター申請の状態を確認するスクリプト
-- 使用方法: star_id変数を変更して実行（例: 'p14', 'p1', 'c1' など）

DO $$
DECLARE
  rec RECORD;
  current_state jsonb;
  target_vote jsonb;
  approvers uuid[];
  rejecters uuid[];
  passers uuid[];
  approvers_effective uuid[];
  rejecters_effective uuid[];
  total_users int;
  voters_count int;
  approvers_count int;
  rejecters_count int;
  threshold int;
  star_id text := 'p14';  -- ここを変更: 確認したいスターID（例: 'p14', 'p1', 'c1'）
  applicant_id uuid;
BEGIN
  -- 全ユーザー数
  SELECT count(*) INTO total_users FROM profiles;
  IF total_users IS NULL OR total_users = 0 THEN total_users := 1; END IF;
  
  RAISE NOTICE '=== %申請の状態確認 ===', star_id;
  RAISE NOTICE '全ユーザー数: %', total_users;
  
  -- 1. 指定スターがpendingにある全ユーザーを確認
  RAISE NOTICE '';
  RAISE NOTICE '--- pendingにあるユーザー一覧 ---';
  FOR rec IN 
    SELECT ss.user_id, ss.state, p.name as user_name
    FROM star_states ss
    LEFT JOIN profiles p ON p.id = ss.user_id
    WHERE ss.state->'pending' @> to_jsonb(star_id)
  LOOP
    RAISE NOTICE 'ユーザーID: %, ユーザー名: %', rec.user_id, rec.user_name;
  END LOOP;
  
  -- 2. 各ユーザーのpending申請を詳細に確認
  FOR rec IN 
    SELECT ss.user_id, ss.state, p.name as user_name
    FROM star_states ss
    LEFT JOIN profiles p ON p.id = ss.user_id
    WHERE ss.state->'pending' @> to_jsonb(star_id)
  LOOP
    applicant_id := rec.user_id;
    current_state := rec.state;
    
    -- 投票データを取得
    target_vote := COALESCE(
      current_state->'votes'->star_id, 
      '{"approvers": [], "rejecters": [], "passers": []}'::jsonb
    );
    
    -- 投票者を配列に変換
    SELECT array_agg(x::uuid) INTO approvers 
    FROM jsonb_array_elements_text(target_vote->'approvers') t(x);
    SELECT array_agg(x::uuid) INTO rejecters 
    FROM jsonb_array_elements_text(target_vote->'rejecters') t(x);
    SELECT array_agg(x::uuid) INTO passers 
    FROM jsonb_array_elements_text(target_vote->'passers') t(x);
    
    approvers := COALESCE(approvers, '{}');
    rejecters := COALESCE(rejecters, '{}');
    passers := COALESCE(passers, '{}');
    
    -- 申請者を除外した有効投票者を計算
    SELECT array_agg(x::uuid) INTO approvers_effective 
    FROM unnest(approvers) x 
    WHERE x <> applicant_id;
    SELECT array_agg(x::uuid) INTO rejecters_effective 
    FROM unnest(rejecters) x 
    WHERE x <> applicant_id;
    
    approvers_effective := COALESCE(approvers_effective, '{}');
    rejecters_effective := COALESCE(rejecters_effective, '{}');
    
    -- 閾値計算: 申請者以外のユーザー数の過半数
    threshold := GREATEST(1, CEIL((total_users - 1)::numeric / 2));
    
    -- カウント
    approvers_count := array_length(approvers_effective, 1);
    rejecters_count := array_length(rejecters_effective, 1);
    voters_count := approvers_count + rejecters_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '--- 申請者ID: %, ユーザー名: % ---', applicant_id, rec.user_name;
    RAISE NOTICE '承認者数（全）: %', array_length(approvers, 1);
    RAISE NOTICE '承認者数（有効）: %', approvers_count;
    RAISE NOTICE '否決者数（全）: %', array_length(rejecters, 1);
    RAISE NOTICE '否決者数（有効）: %', rejecters_count;
    RAISE NOTICE '保留者数: %', array_length(passers, 1);
    RAISE NOTICE '有効投票数: %', voters_count;
    RAISE NOTICE '閾値（過半数）: %', threshold;
    RAISE NOTICE '閾値に達しているか: %', (voters_count >= threshold);
    RAISE NOTICE '承認多数か: %', (approvers_count > rejecters_count);
    
    -- 確定可能かどうかを判定
    IF voters_count >= threshold THEN
      IF approvers_count > rejecters_count THEN
        RAISE NOTICE '>>> 確定可能: 承認確定（acquiredに追加すべき）';
      ELSIF rejecters_count >= approvers_count THEN
        RAISE NOTICE '>>> 確定可能: 否決確定（pendingから削除すべき）';
      ELSE
        RAISE NOTICE '>>> 未確定: 同数で決着がついていません';
      END IF;
    ELSE
      RAISE NOTICE '>>> 未確定: まだ投票が足りません（必要: %票、現在: %票）', threshold, voters_count;
    END IF;
  END LOOP;
  
  -- 3. 投票状況のサマリー（SQLクエリとしても表示可能）
  RAISE NOTICE '';
  RAISE NOTICE '--- 投票状況の詳細（SQLクエリで確認可能） ---';
  RAISE NOTICE '以下のクエリを実行して詳細を確認:';
  RAISE NOTICE 'SELECT user_id, p.name, state->''votes''->''%s'' FROM star_states ss LEFT JOIN profiles p ON p.id = ss.user_id WHERE state->''pending'' @> ''"%s"''::jsonb;', star_id, star_id;
END $$;

-- 上記のDOブロック実行後、以下のクエリで詳細を確認できます
-- （star_idを変更して実行）

-- 指定スターがpendingにある全ユーザーを確認
SELECT 
  user_id,
  p.name as user_name,
  state->'pending' as pending_stars,
  state->'acquired' as acquired_stars,
  state->'votes'->'p14' as star_votes  -- 'p14'を確認したいスターIDに変更
FROM star_states ss
LEFT JOIN profiles p ON p.id = ss.user_id
WHERE state->'pending' @> '"p14"'::jsonb;  -- 'p14'を確認したいスターIDに変更

-- 指定スターの投票状況を詳細に確認
WITH star_applicants AS (
  SELECT 
    user_id,
    state
  FROM star_states
  WHERE state->'pending' @> '"p14"'::jsonb  -- 'p14'を確認したいスターIDに変更
)
SELECT 
  sa.user_id,
  p.name as user_name,
  sa.state->'votes'->'p14'->'approvers' as approvers,  -- 'p14'を確認したいスターIDに変更
  sa.state->'votes'->'p14'->'rejecters' as rejecters,  -- 'p14'を確認したいスターIDに変更
  sa.state->'votes'->'p14'->'passers' as passers,  -- 'p14'を確認したいスターIDに変更
  jsonb_array_length(COALESCE(sa.state->'votes'->'p14'->'approvers', '[]'::jsonb)) as approver_count,  -- 'p14'を確認したいスターIDに変更
  jsonb_array_length(COALESCE(sa.state->'votes'->'p14'->'rejecters', '[]'::jsonb)) as rejecter_count,  -- 'p14'を確認したいスターIDに変更
  jsonb_array_length(COALESCE(sa.state->'votes'->'p14'->'passers', '[]'::jsonb)) as passer_count  -- 'p14'を確認したいスターIDに変更
FROM star_applicants sa
LEFT JOIN profiles p ON p.id = sa.user_id;
