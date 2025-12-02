-- リモートプロシージャ呼び出し (RPC) 用の関数定義
-- このSQLをSupabaseのSQLエディタで実行してください

create or replace function vote_star(
  target_user_id uuid,
  star_id text,
  voter_id uuid,
  action text, -- 'approve', 'reject', 'pass'
  feedback text default null
)
returns json
language plpgsql
security definer -- 実行者の権限ではなく、定義者の権限(service_role相当)で実行
as $$
declare
  current_state jsonb;
  current_votes jsonb;
  target_vote jsonb;
  
  -- 集計用
  approvers uuid[];
  rejecters uuid[];
  passers uuid[];
  
  total_users int;
  vote_count int;
  threshold int;
  
  is_finalized boolean := false;
  log_event jsonb := null;
  
  new_state jsonb;
begin
  -- 1. 現在の状態を取得 (行ロック)
  select state into current_state
  from star_states
  where user_id = target_user_id
  for update; -- 排他ロック
  
  if current_state is null then
    -- 初期化 (通常はありえないが念のため)
    current_state := '{"acquired": [], "pending": [], "votes": {}}'::jsonb;
  end if;
  
  current_votes := coalesce(current_state->'votes', '{}'::jsonb);
  target_vote := coalesce(current_votes->star_id, '{"approvers": [], "rejecters": [], "passers": []}'::jsonb);
  
  -- 2. 投票処理 (配列操作)
  -- まず自分を全てのリストから削除 (jsonb_array_elements_text で展開してフィルタ)
  -- ※ PL/pgSQLでのJSON配列操作は少し煩雑なので、JS側でロジック組む方が楽だが、
  --    アトミック性を重視してここでやる。
  
  -- 簡易的な配列再構築 (Postgres 12+ jsonb_path_query_array 等も使えるが、汎用的に)
  select array_agg(x) into approvers from jsonb_array_elements_text(target_vote->'approvers') t(x) where x <> voter_id::text;
  select array_agg(x) into rejecters from jsonb_array_elements_text(target_vote->'rejecters') t(x) where x <> voter_id::text;
  select array_agg(x) into passers   from jsonb_array_elements_text(target_vote->'passers')   t(x) where x <> voter_id::text;
  
  -- null対策
  approvers := coalesce(approvers, '{}');
  rejecters := coalesce(rejecters, '{}');
  passers   := coalesce(passers, '{}');
  
  if action = 'apply' then
    -- 申請処理: pendingに追加 (重複チェック)
    -- acquiredにもpendingにもなければ追加
    if not (current_state->'acquired' @> to_jsonb(star_id)) and 
       not (current_state->'pending' @> to_jsonb(star_id)) then
       
      new_state := jsonb_set(
        current_state,
        '{pending}',
        (current_state->'pending') || to_jsonb(star_id)
      );
      
      -- 投票箱初期化 (不要かもだが念のため)
      -- new_state := jsonb_set(new_state, ('{votes,' || star_id || '}')::text[], '{"approvers":[], "rejecters":[], "passers":[]}'::jsonb);
      
    else
      -- 既に持っているか申請中なら何もしない (現状維持)
      new_state := current_state;
    end if;
    
    -- 保存して終了
    update star_states
    set state = new_state,
        updated_at = now()
    where user_id = target_user_id;
    
    return json_build_object('ok', true, 'state', new_state, 'isFinalized', false);
  end if;

  if action = 'approve' then
    approvers := array_append(approvers, voter_id);
  elsif action = 'reject' then
    rejecters := array_append(rejecters, voter_id);
    -- ログ用オブジェクト作成
    log_event := jsonb_build_object(
      'userId', target_user_id,
      'text', format('【投票通知】%sさんがスター「%s」を否決しました。理由: %s', voter_id, star_id, feedback),
      'kind', 'log'
    );
  elsif action = 'pass' then
    passers := array_append(passers, voter_id);
  else
    raise exception 'Invalid action: %', action;
  end if;
  
  -- 3. 判定ロジック (過半数ルール)
  select count(*) into total_users from profiles; -- ユーザー総数
  
  -- 投票数 (賛成 + 反対) ※保留は含めない
  vote_count := array_length(approvers, 1) + array_length(rejecters, 1);
  vote_count := coalesce(vote_count, 0); -- null check
  
  -- 閾値: 全ユーザーの50%以上 (絶対多数)
  threshold := ceil(total_users * 0.5);
  
  if vote_count >= threshold and threshold > 0 then
    -- 決着
    is_finalized := true;
    
    if coalesce(array_length(approvers, 1), 0) > coalesce(array_length(rejecters, 1), 0) then
      -- 承認多数 -> 獲得
      -- pendingから削除、acquiredに追加
      -- (JSON操作が複雑になるため、state全体の更新はJS側でやる手もあるが、ここでは頑張る)
      
      -- pending削除
      new_state := jsonb_set(
        current_state,
        '{pending}',
        (select jsonb_agg(elem) from jsonb_array_elements(current_state->'pending') elem where elem::text <> to_jsonb(star_id)::text)
      );
      if new_state->'pending' is null then new_state := jsonb_set(new_state, '{pending}', '[]'::jsonb); end if;
      
      -- acquired追加
      new_state := jsonb_set(
        new_state,
        '{acquired}',
        (current_state->'acquired') || to_jsonb(star_id)
      );
      
      -- 投票箱削除 (votes->star_id を削除)
      new_state := new_state #- ('{votes,' || star_id || '}')::text[];
      
      log_event := jsonb_build_object(
        'userId', target_user_id,
        'text', format('【祝】スター「%s」を獲得しました！(賛成: %s票)', star_id, array_length(approvers, 1)),
        'kind', 'log'
      );
      
    else
      -- 否決多数 -> 却下
      -- pendingから削除のみ
      new_state := jsonb_set(
        current_state,
        '{pending}',
        (select jsonb_agg(elem) from jsonb_array_elements(current_state->'pending') elem where elem::text <> to_jsonb(star_id)::text)
      );
      if new_state->'pending' is null then new_state := jsonb_set(new_state, '{pending}', '[]'::jsonb); end if;
      
      -- 投票箱削除
      new_state := new_state #- ('{votes,' || star_id || '}')::text[];
      
      log_event := jsonb_build_object(
        'userId', target_user_id,
        'text', format('【残念】スター「%s」は承認されませんでした。(反対: %s票)', star_id, array_length(rejecters, 1)),
        'kind', 'log'
      );
    end if;
    
  else
    -- 未決着: 投票状態を更新して保存
    target_vote := jsonb_build_object(
      'approvers', to_jsonb(approvers),
      'rejecters', to_jsonb(rejecters),
      'passers', to_jsonb(passers)
    );
    
    -- votes全体を更新
    new_state := jsonb_set(current_state, ('{votes,' || star_id || '}')::text[], target_vote);
  end if;
  
  -- 4. 保存
  update star_states
  set state = new_state,
      updated_at = now()
  where user_id = target_user_id;
  
  -- ログがあればeventsテーブルに挿入 (副作用)
  if log_event is not null then
    insert into events (user_id, kind, text, created_at, payload)
    values (
      (log_event->>'userId')::uuid,
      log_event->>'kind',
      log_event->>'text',
      now(),
      log_event
    );
  end if;
  
  return json_build_object(
    'ok', true,
    'state', new_state,
    'isFinalized', is_finalized
  );
end;
$$;
