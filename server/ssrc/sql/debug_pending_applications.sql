-- デバッグ用: 現在のpending申請と投票状況を確認
-- このクエリをSupabaseのSQLエディタで実行して、実際の状態を確認してください

-- 1. 全ユーザーのpending申請と投票状況を表示
SELECT 
  user_id,
  p.name as user_name,
  state->'pending' as pending_stars,
  state->'acquired' as acquired_stars,
  state->'votes' as votes_data
FROM star_states ss
LEFT JOIN profiles p ON p.id = ss.user_id
WHERE ss.state->'pending' IS NOT NULL 
  AND jsonb_array_length(ss.state->'pending') > 0;

-- 2. 閾値計算の確認（全ユーザー数と有効投票母数を確認）
SELECT 
  (SELECT count(*) FROM profiles) as total_users,
  (SELECT count(*) FROM profiles) - 1 as effective_users_minus_applicant,
  GREATEST(1, CEIL(((SELECT count(*) FROM profiles) - 1)::numeric / 2)) as threshold_majority;

-- 3. 全てのpending申請について、新しいロジックで再評価
DO $$
DECLARE
  rec RECORD;
  star_rec RECORD;
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
  star_id text;
  applicant_id uuid;
BEGIN
  -- 全ユーザー数
  SELECT count(*) INTO total_users FROM profiles;
  IF total_users IS NULL OR total_users = 0 THEN total_users := 1; END IF;
  
  RAISE NOTICE '=== デバッグ情報 ===';
  RAISE NOTICE '全ユーザー数: %', total_users;
  RAISE NOTICE '閾値（過半数）: %', GREATEST(1, CEIL((total_users - 1)::numeric / 2));
  
  -- 各ユーザーのpending申請を確認
  FOR rec IN 
    SELECT user_id, state 
    FROM star_states 
    WHERE state->'pending' IS NOT NULL 
      AND jsonb_array_length(state->'pending') > 0
  LOOP
    applicant_id := rec.user_id;
    current_state := rec.state;
    
    -- 各pendingスターについて評価
    FOR star_rec IN 
      SELECT jsonb_array_elements_text(current_state->'pending') as star_id
    LOOP
      star_id := star_rec.star_id;
      
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
      
      -- カウント（NULL対策: 空配列の場合は0にする）
      approvers_count := COALESCE(array_length(approvers_effective, 1), 0);
      rejecters_count := COALESCE(array_length(rejecters_effective, 1), 0);
      voters_count := approvers_count + rejecters_count;
      
      RAISE NOTICE '--- 申請者ID: %, スターID: % ---', applicant_id, star_id;
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
          RAISE NOTICE '>>> 確定可能: 承認確定';
        ELSIF rejecters_count >= approvers_count THEN
          RAISE NOTICE '>>> 確定可能: 否決確定';
        ELSE
          RAISE NOTICE '>>> 未確定: 同数で決着がついていません';
        END IF;
      ELSE
        RAISE NOTICE '>>> 未確定: まだ投票が足りません（必要: %票、現在: %票）', threshold, voters_count;
      END IF;
    END LOOP;
  END LOOP;
END $$;
