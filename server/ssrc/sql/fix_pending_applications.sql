-- 全てのpending申請を新しいシンプルなロジックで再評価し、確定可能なものは確定する
-- 新しいロジック: 申請者以外のユーザー数の過半数以上が承認したら確定
-- このスクリプトは全てのスター申請に共通して使用できます

CREATE OR REPLACE FUNCTION fix_pending_applications()
RETURNS TABLE(
  user_id uuid,
  user_name text,
  star_id text,
  action_taken text,
  approvers_count int,
  rejecters_count int,
  threshold int
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  star_rec RECORD;
  current_state jsonb;
  new_state jsonb;
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
  
  applicant_id uuid;
  applicant_name text;
  star_id text;
  log_event jsonb;
BEGIN
  -- 全ユーザー数
  SELECT count(*) INTO total_users FROM profiles;
  IF total_users IS NULL OR total_users = 0 THEN total_users := 1; END IF;
  
  -- 各ユーザーのpending申請を確認
  FOR rec IN 
    SELECT ss.user_id, ss.state
    FROM star_states ss
    WHERE ss.state->'pending' IS NOT NULL 
      AND jsonb_array_length(ss.state->'pending') > 0
    FOR UPDATE OF ss
  LOOP
    applicant_id := rec.user_id;
    current_state := rec.state;
    new_state := current_state;
    
    -- ユーザー名を取得
    SELECT name INTO applicant_name FROM profiles WHERE id = applicant_id;
    applicant_name := COALESCE(applicant_name, applicant_id::text);
    
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
      
      -- カウント（NULL対策: 空配列の場合は0にする）
      approvers_count := COALESCE(array_length(approvers_effective, 1), 0);
      rejecters_count := COALESCE(array_length(rejecters_effective, 1), 0);
      voters_count := approvers_count + rejecters_count;
      
      -- 閾値計算: 申請者以外のユーザー数の過半数
      threshold := GREATEST(1, CEIL((total_users - 1)::numeric / 2));
      
      -- 確定判定
      IF voters_count >= threshold AND approvers_count > rejecters_count THEN
        -- 承認確定
        new_state := jsonb_set(
          current_state,
          '{pending}',
          COALESCE(
            (SELECT jsonb_agg(elem) 
             FROM jsonb_array_elements(current_state->'pending') elem 
             WHERE elem::text <> to_jsonb(star_id)::text),
            '[]'::jsonb
          )
        );
        
        IF NOT (new_state->'acquired' @> to_jsonb(star_id)) THEN
          new_state := jsonb_set(
            new_state, 
            '{acquired}', 
            (new_state->'acquired') || to_jsonb(star_id)
          );
        END IF;
        
        new_state := new_state #- ('{votes,' || star_id || '}')::text[];
        
        log_event := jsonb_build_object(
          'userId', applicant_id, 
          'text', format('【祝】スター「%s」を獲得しました！(賛成: %s票 / 反対: %s票)', 
                         star_id, approvers_count, rejecters_count), 
          'kind', 'log'
        );
        
        INSERT INTO events (user_id, kind, text, created_at, payload)
        VALUES (
          applicant_id,
          log_event->>'kind',
          log_event->>'text',
          NOW(),
          log_event
        );
        
        RETURN QUERY SELECT 
          applicant_id,
          applicant_name,
          star_id,
          '承認確定'::text,
          approvers_count,
          rejecters_count,
          threshold;
        
      ELSIF voters_count >= threshold AND rejecters_count >= approvers_count THEN
        -- 否決確定
        new_state := jsonb_set(
          current_state,
          '{pending}',
          COALESCE(
            (SELECT jsonb_agg(elem) 
             FROM jsonb_array_elements(current_state->'pending') elem 
             WHERE elem::text <> to_jsonb(star_id)::text),
            '[]'::jsonb
          )
        );
        
        new_state := new_state #- ('{votes,' || star_id || '}')::text[];
        
        log_event := jsonb_build_object(
          'userId', applicant_id, 
          'text', format('【残念】スター「%s」は承認されませんでした。(賛成: %s票 / 反対: %s票)', 
                         star_id, approvers_count, rejecters_count), 
          'kind', 'log'
        );
        
        INSERT INTO events (user_id, kind, text, created_at, payload)
        VALUES (
          applicant_id,
          log_event->>'kind',
          log_event->>'text',
          NOW(),
          log_event
        );
        
        RETURN QUERY SELECT 
          applicant_id,
          applicant_name,
          star_id,
          '否決確定'::text,
          approvers_count,
          rejecters_count,
          threshold;
      ELSE
        -- 未確定
        RETURN QUERY SELECT 
          applicant_id,
          applicant_name,
          star_id,
          format('未確定（必要: %s票、現在: %s票）', threshold, voters_count)::text,
          approvers_count,
          rejecters_count,
          threshold;
      END IF;
      
      current_state := new_state;
    END LOOP;
    
    -- 状態を更新
    UPDATE star_states 
    SET state = new_state, updated_at = NOW() 
    WHERE star_states.user_id = applicant_id;
  END LOOP;
END;
$$;

-- 実行方法:
-- SELECT * FROM fix_pending_applications();
