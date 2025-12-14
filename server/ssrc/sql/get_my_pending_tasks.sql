-- 承認待ちタスク取得（DB側フィルタリング版）
-- 
-- 問題: 全ユーザーのデータを取得してからアプリ側でフィルタリングすると、
--       ユーザー数が増えた時にパフォーマンス問題が発生する
-- 
-- 解決策: DB側で「自分が投票すべきタスク」だけをフィルタリングして返す
-- 
-- 戻り値: JSONB配列
-- [
--   {
--     "userId": "uuid",
--     "userName": "string",
--     "pending": ["star_id1", "star_id2"],
--     "votes": { "star_id1": { "approvers": [...], "rejecters": [...], "passers": [...] } }
--   }
-- ]

CREATE OR REPLACE FUNCTION get_my_pending_tasks(
  current_user_id uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  task_record jsonb;
  state_record RECORD;
  unvoted_stars jsonb;
  star_id text;
  votes jsonb;
  vote_record jsonb;
  has_voted boolean;
  approvers jsonb;
  rejecters jsonb;
  passers jsonb;
  user_name text;
BEGIN
  -- 全ユーザーのstar_statesを取得（pendingがあるもののみ）
  FOR state_record IN
    SELECT 
      ss.user_id,
      ss.state
    FROM star_states ss
    WHERE ss.state->'pending' IS NOT NULL
      AND jsonb_array_length(ss.state->'pending') > 0
  LOOP
    -- 自分の申請は除外
    IF state_record.user_id = current_user_id THEN
      CONTINUE;
    END IF;

    -- まだ自分が投票していないスターを抽出
    unvoted_stars := '[]'::jsonb;
    
    -- pending配列をループ
    FOR star_id IN
      SELECT jsonb_array_elements_text(state_record.state->'pending')
    LOOP
      has_voted := false;
      
      -- 投票データを取得
      vote_record := state_record.state->'votes'->star_id;
      
      IF vote_record IS NOT NULL THEN
        -- approvers, rejecters, passersの各配列をチェック
        approvers := vote_record->'approvers';
        rejecters := vote_record->'rejecters';
        passers := COALESCE(vote_record->'passers', '[]'::jsonb);
        
        -- 自分が既に投票しているかチェック
        IF (approvers IS NOT NULL AND approvers @> to_jsonb(current_user_id)) OR
           (rejecters IS NOT NULL AND rejecters @> to_jsonb(current_user_id)) OR
           (passers @> to_jsonb(current_user_id)) THEN
          has_voted := true;
        END IF;
      END IF;
      
      -- まだ投票していないスターを追加
      IF NOT has_voted THEN
        unvoted_stars := unvoted_stars || to_jsonb(star_id);
      END IF;
    END LOOP;
    
    -- 未投票のスターがある場合のみ結果に追加
    IF jsonb_array_length(unvoted_stars) > 0 THEN
      -- ユーザーネームを取得（profilesテーブルから）
      SELECT name INTO user_name
      FROM profiles
      WHERE id = state_record.user_id;
      
      -- ユーザーネームが見つからない場合はemailの@より前の部分を使用
      IF user_name IS NULL OR user_name = '' THEN
        SELECT split_part(email, '@', 1) INTO user_name
        FROM auth.users
        WHERE id = state_record.user_id;
      END IF;
      
      -- タスクレコードを作成
      task_record := jsonb_build_object(
        'userId', state_record.user_id,
        'userName', COALESCE(user_name, 'Unknown'),
        'pending', unvoted_stars,
        'votes', COALESCE(state_record.state->'votes', '{}'::jsonb)
      );
      
      -- 結果配列に追加
      result := result || task_record;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;

