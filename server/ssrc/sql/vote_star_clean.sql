-- スター申請・投票機能（シンプル版）
-- 
-- ロジック:
-- 1. 自分で申請（apply）→ pendingに追加
-- 2. 他のユーザーが投票（approve/reject/pass）
-- 3. 申請者以外のユーザー数の過半数以上が承認したら → スター獲得
--
-- シンプルなルール:
-- - 申請者は自分自身（自分で申請）
-- - 投票者は申請者以外の全ユーザー
-- - 承認が過半数（50%以上）なら確定
-- - 保留者は投票母数から除外（投票しない人として扱う）

CREATE OR REPLACE FUNCTION vote_star(
  target_user_id uuid,
  star_id text,
  action_type text,
  feedback text DEFAULT null
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  voter_id uuid;
  applicant_id uuid;
  current_state jsonb;
  new_state jsonb;
  target_vote jsonb;
  
  -- 投票者リスト
  approvers uuid[];
  rejecters uuid[];
  passers uuid[];
  
  -- 有効投票者（申請者を除外）
  approvers_effective uuid[];
  rejecters_effective uuid[];
  
  -- 計算用
  total_users int;
  voters_count int;  -- 投票した人数（申請者を除く）
  approvers_count int;
  rejecters_count int;
  passers_count int;
  
  -- 閾値
  threshold int;
  
  -- 結果
  is_finalized boolean := false;
  log_event jsonb := null;
BEGIN
  -- ============================================================
  -- 1. 認証チェック
  -- ============================================================
  voter_id := auth.uid();
  IF voter_id IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated'; 
  END IF;
  
  -- ============================================================
  -- 2. 状態取得（行ロックで排他制御）
  -- ============================================================
  SELECT state INTO current_state 
  FROM star_states 
  WHERE user_id = target_user_id 
  FOR UPDATE;
  
  -- 状態が存在しない場合は初期化
  IF current_state IS NULL THEN
    current_state := '{"acquired": [], "pending": [], "votes": {}}'::jsonb;
    INSERT INTO star_states (user_id, state, updated_at) 
    VALUES (target_user_id, current_state, NOW()) 
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  applicant_id := target_user_id;  -- 申請者はtarget_user_id
  
  -- ============================================================
  -- 3. 申請（apply）処理
  -- ============================================================
  IF action_type = 'apply' THEN
    -- 既に獲得済みまたは申請中なら何もしない
    IF (current_state->'acquired' @> to_jsonb(star_id)) OR 
       (current_state->'pending' @> to_jsonb(star_id)) THEN
      new_state := current_state;
    ELSE
      -- pendingに追加
      new_state := jsonb_set(
        current_state,
        '{pending}',
        (current_state->'pending') || to_jsonb(star_id)
      );
    END IF;
    
    UPDATE star_states 
    SET state = new_state, updated_at = NOW() 
    WHERE user_id = target_user_id;
    
    RETURN jsonb_build_object(
      'ok', true, 
      'state', new_state, 
      'isFinalized', false
    );
  END IF;
  
  -- ============================================================
  -- 4. 投票（approve/reject/pass）処理
  -- ============================================================
  
  -- 自分自身への投票は禁止
  IF voter_id = applicant_id THEN 
    RAISE EXCEPTION 'Self voting is not allowed'; 
  END IF;
  
  -- pendingにないスターへの投票は無効
  IF NOT (current_state->'pending' @> to_jsonb(star_id)) THEN
    RAISE EXCEPTION 'Star % is not pending', star_id;
  END IF;
  
  -- 投票データ取得
  target_vote := COALESCE(
    current_state->'votes'->star_id, 
    '{"approvers": [], "rejecters": [], "passers": []}'::jsonb
  );
  
  -- 既存の投票から自分を除外（再投票対応）
  SELECT array_agg(x::uuid) INTO approvers 
  FROM jsonb_array_elements_text(target_vote->'approvers') t(x) 
  WHERE x <> voter_id::text;
  
  SELECT array_agg(x::uuid) INTO rejecters 
  FROM jsonb_array_elements_text(target_vote->'rejecters') t(x) 
  WHERE x <> voter_id::text;
  
  SELECT array_agg(x::uuid) INTO passers 
  FROM jsonb_array_elements_text(target_vote->'passers') t(x) 
  WHERE x <> voter_id::text;
  
  approvers := COALESCE(approvers, '{}');
  rejecters := COALESCE(rejecters, '{}');
  passers := COALESCE(passers, '{}');
  
  -- 新しい投票を追加
  IF action_type = 'approve' THEN
    approvers := array_append(approvers, voter_id);
  ELSIF action_type = 'reject' THEN
    rejecters := array_append(rejecters, voter_id);
    -- 否決時はログを記録
    log_event := jsonb_build_object(
      'userId', applicant_id, 
      'text', format('【投票通知】1名がスター「%s」を否決しました。理由: %s', star_id, COALESCE(feedback, 'なし')), 
      'kind', 'log'
    );
  ELSIF action_type = 'pass' THEN
    passers := array_append(passers, voter_id);
  ELSE
    RAISE EXCEPTION 'Invalid action type: %', action_type;
  END IF;
  
  -- ============================================================
  -- 5. 承認判定ロジック（シンプル版）
  -- ============================================================
  
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
  passers_count := COALESCE(array_length(passers, 1), 0);
  voters_count := approvers_count + rejecters_count;
  
  -- 全ユーザー数を取得
  SELECT count(*) INTO total_users FROM profiles;
  IF total_users IS NULL OR total_users = 0 THEN 
    total_users := 1;  -- 最低1人
  END IF;
  
  -- 閾値計算: 申請者以外のユーザー数の過半数
  -- 例: 4人の場合 → 申請者1人を除くと3人 → 過半数は2人
  -- 例: 3人の場合 → 申請者1人を除くと2人 → 過半数は1人（最小1票）
  threshold := GREATEST(1, CEIL((total_users - 1)::numeric / 2));
  
  -- ============================================================
  -- 6. 確定判定
  -- ============================================================
  
  -- 過半数以上が投票し、かつ承認が多数なら確定
  IF voters_count >= threshold AND approvers_count > rejecters_count THEN
    is_finalized := true;
    
    -- pendingから削除
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
    
    -- acquiredに追加
    IF NOT (new_state->'acquired' @> to_jsonb(star_id)) THEN
      new_state := jsonb_set(
        new_state, 
        '{acquired}', 
        (new_state->'acquired') || to_jsonb(star_id)
      );
    END IF;
    
    -- 投票箱を削除
    new_state := new_state #- ('{votes,' || star_id || '}')::text[];
    
    -- ログイベント作成
    log_event := jsonb_build_object(
      'userId', applicant_id, 
      'text', format('【祝】スター「%s」を獲得しました！(賛成: %s票 / 反対: %s票)', 
                     star_id, approvers_count, rejecters_count), 
      'kind', 'log'
    );
    
  ELSIF voters_count >= threshold AND rejecters_count >= approvers_count THEN
    -- 過半数以上が投票し、否決が多数なら否決確定
    is_finalized := true;
    
    -- pendingから削除（acquiredには追加しない）
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
    
    -- 投票箱を削除
    new_state := new_state #- ('{votes,' || star_id || '}')::text[];
    
    -- ログイベント作成（否決の場合、既にlog_eventが設定されている可能性がある）
    IF log_event IS NULL THEN
      log_event := jsonb_build_object(
        'userId', applicant_id, 
        'text', format('【残念】スター「%s」は承認されませんでした。(賛成: %s票 / 反対: %s票)', 
                       star_id, approvers_count, rejecters_count), 
        'kind', 'log'
      );
    END IF;
    
  ELSE
    -- 未確定: 投票状態を更新して待つ
    target_vote := jsonb_build_object(
      'approvers', to_jsonb(approvers), 
      'rejecters', to_jsonb(rejecters), 
      'passers', to_jsonb(passers)
    );
    new_state := jsonb_set(
      current_state, 
      ('{votes,' || star_id || '}')::text[], 
      target_vote
    );
  END IF;
  
  -- ============================================================
  -- 7. 保存
  -- ============================================================
  UPDATE star_states 
  SET state = new_state, updated_at = NOW() 
  WHERE user_id = target_user_id;
  
  -- ログイベントを記録
  IF log_event IS NOT NULL THEN
    INSERT INTO events (user_id, kind, text, created_at, payload)
    VALUES (
      (log_event->>'userId')::uuid, 
      log_event->>'kind', 
      log_event->>'text', 
      NOW(), 
      log_event
    );
  END IF;
  
  -- ============================================================
  -- 8. 結果を返す
  -- ============================================================
  RETURN jsonb_build_object(
    'ok', true, 
    'state', new_state, 
    'isFinalized', is_finalized
  );
END;
$$;
