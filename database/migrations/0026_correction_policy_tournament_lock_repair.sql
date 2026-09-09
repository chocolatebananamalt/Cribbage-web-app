-- Repair the pilot function after moving the tournament status check under a row lock.
-- New installations receive the same implementation from migration 0023.
create or replace function public.propose_game_correction(
  p_game_id uuid, p_correction_id uuid, p_expected_game_version integer,
  p_winner_side text, p_margin integer, p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_game app.canonical_games%rowtype; v_role boolean;
  v_hash text; v_legacy_hash text; v_existing app.operation_receipts%rowtype; v_policy app.correction_policy_versions%rowtype; v_tournament_status text; v_sequence integer; v_receipt uuid; v_response jsonb; v_error text; v_code text;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_game_id is null or p_correction_id is null or p_expected_game_version is null or p_winner_side is null or p_margin is null or p_winner_side not in ('a','b') or p_margin not between 1 and 121 or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'invalid correction request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('propose_game_correction', p_game_id::text, p_correction_id::text, p_expected_game_version::text, p_winner_side, p_margin::text, coalesce(p_reason, ''), p_idempotency_key::text)::text, 'utf8'), 'sha256'), 'hex');
  v_legacy_hash := encode(extensions.digest(convert_to(concat_ws('|','propose_game_correction',p_game_id::text,p_correction_id::text,p_expected_game_version::text,p_winner_side,p_margin::text,coalesce(p_reason,''),p_idempotency_key::text),'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_game from app.canonical_games where id = p_game_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'game not found'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash and v_existing.request_hash <> v_legacy_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  select status into v_tournament_status from app.tournaments where id = v_game.tournament_id for update;
  if v_tournament_status is distinct from 'open' then raise exception using errcode = 'P0001', message = 'corrections require an open tournament'; end if;
  if not exists (select 1 from app.events e join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id and e.format = 'standard_singles' and e.scoring_method = 'digital' and rv.format = 'standard_singles' and rv.approved_at is not null) then raise exception using errcode = 'P0001', message = 'event is not approved for digital Standard Singles correction'; end if;
  select exists(select 1 from app.tournament_roles where tournament_id = v_game.tournament_id and profile_id = v_actor and role = 'cross_checker') into v_role;
  if not v_role then raise exception using errcode = 'P0001', message = 'cross checker role required'; end if;
  if exists(select 1 from app.event_participants where id in (v_game.side_a_participant_id, v_game.side_b_participant_id) and profile_id = v_actor) then raise exception using errcode = 'P0001', message = 'cannot correct own game'; end if;
  if v_game.state not in ('verified','corrected') then raise exception using errcode = 'P0001', message = 'only verified games may be corrected'; end if;
  if v_game.version <> p_expected_game_version then raise exception using errcode = 'P0001', message = 'stale game version'; end if;
  if v_game.winner_side = p_winner_side and v_game.margin = p_margin then raise exception using errcode = 'P0001', message = 'correction must change result'; end if;
  select * into v_policy from app.correction_policy_versions where tournament_id = v_game.tournament_id order by version desc limit 1;
  if not found then raise exception using errcode = 'P0001', message = 'correction policy unavailable'; end if;
  if v_policy.reason_required and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception using errcode = 'P0001', message = 'correction reason required'; end if;
  if v_policy.required_approvals = 1 and exists (
    select 1 from app.game_corrections c where c.canonical_game_id = p_game_id
      and exists (select 1 from app.correction_state_events e where e.correction_id = c.id and e.state = 'pending')
      and not exists (select 1 from app.correction_state_events e where e.correction_id = c.id and e.state in ('approved', 'rejected'))
  ) then raise exception using errcode = 'P0001', message = 'pending correction already exists'; end if;
  select coalesce(max(correction_sequence),0)+1 into v_sequence from app.game_corrections where canonical_game_id = p_game_id;
  insert into app.game_corrections(id,tournament_id,event_id,canonical_game_id,correction_sequence,base_game_version,editor_profile_id,previous_winner_side,previous_margin,corrected_winner_side,corrected_margin,reason,policy_version,reason_required,required_approvals)
    values(p_correction_id,v_game.tournament_id,v_game.event_id,p_game_id,v_sequence,p_expected_game_version,v_actor,v_game.winner_side,v_game.margin,p_winner_side,p_margin,nullif(trim(p_reason),''),v_policy.version,v_policy.reason_required,v_policy.required_approvals);
  if v_policy.required_approvals = 1 then
    insert into app.correction_state_events(correction_id,canonical_game_id,tournament_id,event_id,actor_profile_id,state)
      values(p_correction_id,p_game_id,v_game.tournament_id,v_game.event_id,v_actor,'pending');
    v_response := jsonb_build_object('status','pending','game_id',p_game_id,'correction_id',p_correction_id,'version',p_expected_game_version,'policy_version',v_policy.version);
  else
    insert into app.correction_state_events(correction_id,canonical_game_id,tournament_id,event_id,actor_profile_id,state)
      values(p_correction_id,p_game_id,v_game.tournament_id,v_game.event_id,v_actor,'applied');
    update app.card_scorelines set is_winner = (side = p_winner_side), margin = p_margin,
      plus_points = case when side = p_winner_side then p_margin else 0 end,
      minus_points = case when side = p_winner_side then 0 else p_margin end,
      game_points = case when side = p_winner_side then case when p_margin >= 31 then 3 else 2 end else 0 end
      where canonical_game_id = p_game_id;
    update app.canonical_games set state='corrected', winner_side=p_winner_side, margin=p_margin, version=version+1 where id=p_game_id;
    v_response := jsonb_build_object('status','applied','game_id',p_game_id,'correction_id',p_correction_id,'version',p_expected_game_version+1,'policy_version',v_policy.version);
  end if;
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_actor,v_game.tournament_id,'propose_game_correction',p_game_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
    values(v_game.tournament_id,v_actor,p_game_id,v_receipt,'canonical_game',p_game_id,case when v_policy.required_approvals = 1 then 'correction_pending' else 'correction_applied' end,jsonb_build_object('winnerSide',v_game.winner_side,'margin',v_game.margin,'version',v_game.version),v_response);
  return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error when 'authentication required' then 'authentication_required' when 'invalid correction request' then 'invalid_request' when 'game not found' then 'game_not_found' when 'corrections require an open tournament' then 'tournament_closed' when 'idempotency conflict' then 'idempotency_conflict' when 'cross checker role required' then 'not_cross_checker' when 'cannot correct own game' then 'self_correction_denied' when 'only verified games may be corrected' then 'invalid_game_state' when 'stale game version' then 'stale_game_version' when 'correction must change result' then 'unchanged_correction' when 'correction policy unavailable' then 'policy_unavailable' when 'correction reason required' then 'reason_required' when 'pending correction already exists' then 'pending_correction_exists' else 'correction_rejected' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'game_id',p_game_id);
    if v_error = 'idempotency conflict' then
      insert into app.correction_operation_conflicts(actor_profile_id,canonical_game_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
      values(v_actor,p_game_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
    elsif v_actor is not null and v_game.tournament_id is not null then
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_actor,v_game.tournament_id,'propose_game_correction',p_game_id,coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
      insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(v_game.tournament_id,v_actor,p_game_id,v_receipt,'canonical_game',p_game_id,'correction_rejected',v_response);
    end if;
    return v_response;
  when others then raise;
  end;
end; $$;

revoke all on function public.propose_game_correction(uuid,uuid,integer,text,integer,text,uuid) from public, anon;
grant execute on function public.propose_game_correction(uuid,uuid,integer,text,integer,text,uuid) to authenticated;
