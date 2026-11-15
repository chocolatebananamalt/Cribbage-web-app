-- Complete Rule 12.2 independent-card correction release contract.
-- The canonical game remains immutable identity evidence. Corrected scorecards,
-- totals, and standings consume only the latest independently applied projection.

alter table app.independent_card_corrections
  add column affected_participant_id uuid,
  add foreign key (affected_participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  add constraint rule12_qualification_notice_target_check
    check ((qualification_changed and affected_participant_id is not null)
      or (not qualification_changed and affected_participant_id is null));

create table app.independent_card_correction_claims (
  correction_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  card_side text not null check (card_side in ('a','b')),
  recorded_outcome text not null check (recorded_outcome in ('win','loss')),
  recorded_margin integer check (recorded_margin between 1 and 121),
  recorded_column text not null check (recorded_column in ('plus','minus','blank')),
  apparent_qualifier boolean not null,
  created_at timestamptz not null default now(),
  primary key (correction_id, card_side),
  foreign key (correction_id, canonical_game_id, tournament_id, event_id)
    references app.independent_card_corrections(id, canonical_game_id, tournament_id, event_id) on delete restrict,
  check ((recorded_column = 'blank') = (recorded_margin is null))
);

create table app.rule12_affected_player_notices (
  id uuid primary key default extensions.gen_random_uuid(),
  correction_id uuid not null unique,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  participant_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  notice_code text not null check (notice_code = 'qualification_position_changed'),
  created_at timestamptz not null default now(),
  foreign key (correction_id, canonical_game_id, tournament_id, event_id)
    references app.independent_card_corrections(id, canonical_game_id, tournament_id, event_id) on delete restrict,
  foreign key (participant_id, profile_id, event_id, tournament_id)
    references app.event_participants(id, profile_id, event_id, tournament_id) on delete restrict
);

alter table app.independent_card_correction_claims enable row level security;
alter table app.independent_card_correction_claims force row level security;
alter table app.rule12_affected_player_notices enable row level security;
alter table app.rule12_affected_player_notices force row level security;
revoke all on table app.independent_card_correction_claims, app.rule12_affected_player_notices from public, anon, authenticated;
create trigger independent_card_correction_claims_immutable before update or delete on app.independent_card_correction_claims
for each row execute function app.reject_immutable_history();
create trigger rule12_affected_player_notices_immutable before update or delete on app.rule12_affected_player_notices
for each row execute function app.reject_immutable_history();
create index rule12_affected_player_notices_profile_idx on app.rule12_affected_player_notices(profile_id, created_at desc);
create index independent_card_corrections_affected_participant_idx on app.independent_card_corrections(affected_participant_id) where affected_participant_id is not null;

alter table app.independent_card_correction_operation_conflicts
  drop constraint independent_card_correction_operation_conf_operation_type_check,
  add constraint independent_card_correction_operation_conf_operation_type_check
    check (operation_type in ('create_rule12b_correction_v1','create_rule12_correction_v2','review_rule12_correction_v1','review_rule12_correction_v2'));

create or replace function app.rule12_adjudication_v1(p_rule_case text, p_a jsonb, p_b jsonb)
returns jsonb language plpgsql immutable security definer set search_path = '' as $$
declare
  ao text := p_a->>'outcome'; bo text := p_b->>'outcome';
  ac text := p_a->>'column'; bc text := p_b->>'column';
  am integer; bm integer; aq boolean; bq boolean;
  fao text; fbo text; fam integer; fbm integer;
begin
  if p_rule_case not in ('12.2a','12.2b','12.2c','12.2d','12.2e','12.2f','12.2h')
     or jsonb_typeof(p_a) <> 'object' or jsonb_typeof(p_b) <> 'object'
     or (select count(*) from jsonb_object_keys(p_a)) <> 4
     or (select count(*) from jsonb_object_keys(p_b)) <> 4
     or not (p_a ?& array['outcome','margin','column','apparentQualifier'])
     or not (p_b ?& array['outcome','margin','column','apparentQualifier'])
     or ao not in ('win','loss') or bo not in ('win','loss')
     or ac not in ('plus','minus','blank') or bc not in ('plus','minus','blank')
     or jsonb_typeof(p_a->'apparentQualifier') <> 'boolean'
     or jsonb_typeof(p_b->'apparentQualifier') <> 'boolean' then
    raise exception using errcode='P0001', message='invalid Rule 12 claims';
  end if;
  aq := (p_a->>'apparentQualifier')::boolean; bq := (p_b->>'apparentQualifier')::boolean;
  if p_a->'margin' <> 'null'::jsonb then am := (p_a->>'margin')::integer; end if;
  if p_b->'margin' <> 'null'::jsonb then bm := (p_b->>'margin')::integer; end if;
  if (ac = 'blank') <> (am is null) or (bc = 'blank') <> (bm is null)
     or (am is not null and am not between 1 and 121)
     or (bm is not null and bm not between 1 and 121) then
    raise exception using errcode='P0001', message='invalid Rule 12 claims';
  end if;
  fao := ao; fbo := bo; fam := am; fbm := bm;
  if p_rule_case = '12.2a' then
    if aq = bq or ao = bo or am is null or bm is null or am = bm
       or (aq and (ao <> 'win' or am <= bm)) or (bq and (bo <> 'win' or bm <= am)) then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
    if aq then fam := bm; else fbm := am; end if;
  elsif p_rule_case = '12.2b' then
    if not aq or not bq or ao = bo or am is null or bm is null or am = bm then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
    fam := bm; fbm := am;
  elsif p_rule_case = '12.2c' then
    if (am is null) = (bm is null) then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
    fam := coalesce(am,bm); fbm := coalesce(bm,am);
  elsif p_rule_case = '12.2d' then
    if ao <> bo or ac = 'blank' or bc = 'blank' or ac = bc or am is null or bm is null then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
    fao := case ac when 'plus' then 'win' else 'loss' end;
    fbo := case bc when 'plus' then 'win' else 'loss' end;
  elsif p_rule_case = '12.2e' then
    if ao <> bo or ac = 'blank' or ac <> bc or am is null or bm is null then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
    fao := 'loss'; fbo := 'loss';
  elsif p_rule_case = '12.2f' then
    if ao = bo or ac = 'blank' or ac <> bc or am is null or bm is null then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
  elsif p_rule_case = '12.2h' then
    if aq = bq or ao = bo or am is null or bm is null
       or (aq and (ao <> 'win' or am >= bm)) or (bq and (bo <> 'win' or bm >= am)) then raise exception using errcode='P0001', message='Rule 12 case does not apply'; end if;
  end if;
  return jsonb_build_object('a',jsonb_build_object('isWinner',fao='win','margin',fam),
    'b',jsonb_build_object('isWinner',fbo='win','margin',fbm));
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='P0001', message='invalid Rule 12 claims';
end;
$$;
revoke all on function app.rule12_adjudication_v1(text,jsonb,jsonb) from public, anon, authenticated;

create or replace function app.queue_rule12_affected_player_notice_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'applied' then
    insert into app.rule12_affected_player_notices(correction_id,tournament_id,event_id,canonical_game_id,participant_id,profile_id,notice_code)
    select c.id,c.tournament_id,c.event_id,c.canonical_game_id,c.affected_participant_id,ep.profile_id,'qualification_position_changed'
    from app.independent_card_corrections c join app.event_participants ep on ep.id=c.affected_participant_id
      and ep.event_id=c.event_id and ep.tournament_id=c.tournament_id
    where c.id=new.correction_id and c.qualification_changed
    on conflict (correction_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger queue_rule12_affected_player_notice after insert on app.independent_card_correction_state_events
for each row execute function app.queue_rule12_affected_player_notice_v1();
revoke all on function app.queue_rule12_affected_player_notice_v1() from public, anon, authenticated;

create or replace function app.record_rule12_rejection_v1(p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_correction_id uuid,p_operation_id uuid,p_request_hash text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; response jsonb:=jsonb_build_object('status','rejected','code',p_code,'correctionId',p_correction_id);
begin
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_actor_id,p_tournament_id,'create_rule12_correction_v2',p_correction_id,p_request_hash,p_operation_id,'rejected',response,now()) returning id into rid;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,p_game_id,rid,'independent_card_correction',p_correction_id,'rule12_correction_rejected',response);
  return response;
end;
$$;
revoke all on function app.record_rule12_rejection_v1(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;

create or replace function public.create_rule12_correction_v2(
  p_actor_id uuid, p_game_id uuid, p_correction_id uuid,
  p_expected_game_version integer, p_expected_correction_sequence integer,
  p_rule_case text, p_claim_a jsonb, p_claim_b jsonb,
  p_qualification_changed boolean, p_affected_participant_id uuid,
  p_reason text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g app.canonical_games%rowtype; pol app.correction_policy_versions%rowtype;
  prior app.operation_receipts%rowtype; adj jsonb; seq integer; rid uuid;
  sa app.card_scorelines%rowtype; sb app.card_scorelines%rowtype;
  affected uuid; role_name text; reason_text text; request_hash text; response jsonb;
  tournament_status text; publication_state text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception using errcode='P0001',message='server-only Rule 12 correction lifecycle'; end if;
  if p_actor_id is null or p_game_id is null or p_correction_id is null or p_operation_id is null
     or p_expected_game_version < 1 or p_expected_correction_sequence < 0 or p_qualification_changed is null
     or (p_qualification_changed <> (p_affected_participant_id is not null)) or char_length(coalesce(p_reason,'')) > 500 then
    return jsonb_build_object('status','rejected','code','invalid_request','correctionId',p_correction_id);
  end if;
  adj := app.rule12_adjudication_v1(p_rule_case,p_claim_a,p_claim_b);
  if p_rule_case='12.2h' and p_qualification_changed then return jsonb_build_object('status','rejected','code','fixture_not_applicable','correctionId',p_correction_id); end if;
  reason_text := nullif(btrim(coalesce(p_reason,'')),'');
  request_hash := encode(extensions.digest(convert_to(jsonb_build_array('create_rule12_correction_v2',p_actor_id,p_game_id,p_correction_id,p_expected_game_version,p_expected_correction_sequence,p_rule_case,p_claim_a,p_claim_b,p_qualification_changed,p_affected_participant_id,coalesce(reason_text,''),p_operation_id)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rule12:'||p_game_id::text,0));
  select * into g from app.canonical_games where id=p_game_id for update;
  if not found then return jsonb_build_object('status','rejected','code','game_not_found','correctionId',p_correction_id); end if;
  select status into tournament_status from app.tournaments where id=g.tournament_id for update;
  select state into publication_state from app.event_publication_states where tournament_id=g.tournament_id and event_id=g.event_id for update;
  select r.role into role_name from app.tournament_roles r where r.tournament_id=g.tournament_id and r.profile_id=p_actor_id and r.role='cross_checker' for update;
  if role_name is null then return jsonb_build_object('status','rejected','code','not_cross_checker','correctionId',p_correction_id); end if;
  if exists(select 1 from app.event_participants ep where ep.id in(g.side_a_participant_id,g.side_b_participant_id) and ep.profile_id=p_actor_id) then return jsonb_build_object('status','rejected','code','self_correction_denied','correctionId',p_correction_id); end if;
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
    if prior.tournament_id=g.tournament_id and prior.operation_type='create_rule12_correction_v2' and prior.target_id=p_correction_id and prior.request_hash=request_hash then return prior.response_payload; end if;
    insert into app.independent_card_correction_operation_conflicts(tournament_id,actor_profile_id,canonical_game_id,correction_id,operation_type,attempted_operation_id,attempted_request_hash,prior_receipt_id,prior_receipt_tournament_id,reason_code)
    values(g.tournament_id,p_actor_id,p_game_id,p_correction_id,'create_rule12_correction_v2',p_operation_id,request_hash,prior.id,prior.tournament_id,'idempotency_conflict');
    return jsonb_build_object('status','rejected','code','idempotency_conflict','correctionId',p_correction_id);
  end if;
  if tournament_status<>'open' then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'tournament_closed'); end if;
  if publication_state<>'draft' then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'result_publication_guarded'); end if;
  if g.state not in ('verified','corrected') or g.version<>p_expected_game_version then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'stale_game_version'); end if;
  if not exists(select 1 from app.events e join app.ruleset_versions rv on rv.id=e.ruleset_version_id and rv.tournament_id=e.tournament_id where e.id=g.event_id and e.tournament_id=g.tournament_id and e.format='standard_singles' and e.scoring_method='digital' and rv.format='standard_singles' and rv.approved_at is not null) then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'event_not_eligible'); end if;
  if exists(select 1 from app.game_corrections lc where lc.canonical_game_id=p_game_id) then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'correction_history_unsupported'); end if;
  if exists(select 1 from app.independent_card_correction_lifecycles l where l.canonical_game_id=p_game_id and exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=l.correction_id and se.state='pending') and not exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=l.correction_id and se.state in('approved','rejected'))) then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'pending_correction_exists'); end if;
  select coalesce(max(c.correction_sequence),0) into seq from app.independent_card_corrections c where c.canonical_game_id=p_game_id;
  if seq<>p_expected_correction_sequence then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'stale_correction_sequence'); end if;
  seq:=seq+1;
  select * into pol from app.correction_policy_versions p where p.tournament_id=g.tournament_id order by p.version desc limit 1;
  if not found then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'policy_unavailable'); end if;
  if pol.reason_required and reason_text is null then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'reason_required'); end if;
  select * into sa from app.card_scorelines where canonical_game_id=p_game_id and side='a';
  select * into sb from app.card_scorelines where canonical_game_id=p_game_id and side='b';
  if sa.id is null or sb.id is null then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'card_identity_unavailable'); end if;
  if p_qualification_changed then
    select ep.id into affected from app.event_participants ep where ep.id=p_affected_participant_id and ep.event_id=g.event_id and ep.tournament_id=g.tournament_id;
    if affected is null then return app.record_rule12_rejection_v1(p_actor_id,g.tournament_id,p_game_id,p_correction_id,p_operation_id,request_hash,'affected_player_invalid'); end if;
  end if;
  response:=jsonb_build_object('status',case when pol.required_approvals=0 then 'applied' else 'pending' end,'correctionId',p_correction_id,'gameId',p_game_id,'gameVersion',g.version,'correctionSequence',seq,'policyVersion',pol.version,'reasonRequired',pol.reason_required,'requiredApprovals',pol.required_approvals,'qualificationChanged',p_qualification_changed);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_actor_id,g.tournament_id,'create_rule12_correction_v2',p_correction_id,request_hash,p_operation_id,'accepted',response,now()) returning id into rid;
  insert into app.independent_card_corrections(id,tournament_id,event_id,canonical_game_id,correction_sequence,base_game_version,editor_profile_id,rule_case,reason,qualification_changed,apparent_qualifier_sides,affected_participant_id)
  values(p_correction_id,g.tournament_id,g.event_id,p_game_id,seq,g.version,p_actor_id,p_rule_case,reason_text,p_qualification_changed,
    array(select side from (values('a',(p_claim_a->>'apparentQualifier')::boolean),('b',(p_claim_b->>'apparentQualifier')::boolean)) q(side,is_q) where is_q),affected);
  insert into app.independent_card_correction_claims(correction_id,tournament_id,event_id,canonical_game_id,card_side,recorded_outcome,recorded_margin,recorded_column,apparent_qualifier)
  values(p_correction_id,g.tournament_id,g.event_id,p_game_id,'a',p_claim_a->>'outcome',nullif(p_claim_a->>'margin','')::integer,p_claim_a->>'column',(p_claim_a->>'apparentQualifier')::boolean),
        (p_correction_id,g.tournament_id,g.event_id,p_game_id,'b',p_claim_b->>'outcome',nullif(p_claim_b->>'margin','')::integer,p_claim_b->>'column',(p_claim_b->>'apparentQualifier')::boolean);
  insert into app.independent_card_correction_projections(correction_id,tournament_id,event_id,canonical_game_id,card_side,canonical_scoreline_id,original_is_winner,original_margin,original_plus_points,original_minus_points,original_game_points,adjudicated_is_winner,adjudicated_margin,adjudicated_plus_points,adjudicated_minus_points,adjudicated_game_points)
  values(p_correction_id,g.tournament_id,g.event_id,p_game_id,'a',sa.id,(p_claim_a->>'outcome')='win',coalesce((p_claim_a->>'margin')::integer,sa.margin),case when (p_claim_a->>'outcome')='win' then coalesce((p_claim_a->>'margin')::integer,sa.margin) else 0 end,case when (p_claim_a->>'outcome')='win' then 0 else coalesce((p_claim_a->>'margin')::integer,sa.margin) end,case when (p_claim_a->>'outcome')='win' then case when coalesce((p_claim_a->>'margin')::integer,sa.margin)>=31 then 3 else 2 end else 0 end,(adj->'a'->>'isWinner')::boolean,(adj->'a'->>'margin')::integer,case when (adj->'a'->>'isWinner')::boolean then (adj->'a'->>'margin')::integer else 0 end,case when (adj->'a'->>'isWinner')::boolean then 0 else (adj->'a'->>'margin')::integer end,case when (adj->'a'->>'isWinner')::boolean then case when (adj->'a'->>'margin')::integer>=31 then 3 else 2 end else 0 end),
        (p_correction_id,g.tournament_id,g.event_id,p_game_id,'b',sb.id,(p_claim_b->>'outcome')='win',coalesce((p_claim_b->>'margin')::integer,sb.margin),case when (p_claim_b->>'outcome')='win' then coalesce((p_claim_b->>'margin')::integer,sb.margin) else 0 end,case when (p_claim_b->>'outcome')='win' then 0 else coalesce((p_claim_b->>'margin')::integer,sb.margin) end,case when (p_claim_b->>'outcome')='win' then case when coalesce((p_claim_b->>'margin')::integer,sb.margin)>=31 then 3 else 2 end else 0 end,(adj->'b'->>'isWinner')::boolean,(adj->'b'->>'margin')::integer,case when (adj->'b'->>'isWinner')::boolean then (adj->'b'->>'margin')::integer else 0 end,case when (adj->'b'->>'isWinner')::boolean then 0 else (adj->'b'->>'margin')::integer end,case when (adj->'b'->>'isWinner')::boolean then case when (adj->'b'->>'margin')::integer>=31 then 3 else 2 end else 0 end);
  insert into app.independent_card_correction_lifecycles(correction_id,tournament_id,event_id,canonical_game_id,policy_version,reason_required,required_approvals,creator_operation_receipt_id)
  values(p_correction_id,g.tournament_id,g.event_id,p_game_id,pol.version,pol.reason_required,pol.required_approvals,rid);
  insert into app.independent_card_correction_state_events(correction_id,tournament_id,event_id,canonical_game_id,actor_profile_id,actor_role,state,transition_sequence,operation_receipt_id)
  values(p_correction_id,g.tournament_id,g.event_id,p_game_id,p_actor_id,'cross_checker',case when pol.required_approvals=0 then 'applied' else 'pending' end,1,rid);
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
  values(g.tournament_id,p_actor_id,p_game_id,rid,'independent_card_correction',p_correction_id,case when pol.required_approvals=0 then 'rule12_correction_applied' else 'rule12_correction_pending' end,jsonb_build_object('gameVersion',g.version),response);
  return response;
exception when sqlstate 'P0001' then
  return jsonb_build_object('status','rejected','code',case sqlerrm when 'invalid Rule 12 claims' then 'invalid_request' else 'fixture_not_applicable' end,'correctionId',p_correction_id);
end;
$$;

create or replace function public.review_rule12_correction_v2(p_actor_id uuid,p_correction_id uuid,p_decision text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c app.independent_card_corrections%rowtype; l app.independent_card_correction_lifecycles%rowtype; g app.canonical_games%rowtype; prior app.operation_receipts%rowtype; actor_role text; request_hash text; response jsonb; code text; rid uuid; authorized boolean:=false;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='P0001',message='server-only Rule 12 correction lifecycle'; end if;
 begin
  if p_actor_id is null or p_correction_id is null or p_decision not in('approve','reject') or p_operation_id is null then raise exception using errcode='P0001',message='invalid review'; end if;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('review_rule12_correction_v2',p_actor_id,p_correction_id,p_decision)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into c from app.independent_card_corrections where id=p_correction_id;
  if not found then raise exception using errcode='P0001',message='correction not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rule12:'||c.canonical_game_id::text,0));
  select * into g from app.canonical_games where id=c.canonical_game_id and tournament_id=c.tournament_id and event_id=c.event_id for update;
  if not found then raise exception using errcode='P0001',message='scope invalid'; end if;
  if c.editor_profile_id=p_actor_id or exists(select 1 from app.event_participants ep where ep.id in(g.side_a_participant_id,g.side_b_participant_id) and ep.profile_id=p_actor_id) then raise exception using errcode='P0001',message='reviewer not independent'; end if;
  select r.role into actor_role from app.tournament_roles r where r.tournament_id=c.tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker') order by case r.role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1 for update;
  if actor_role is null then raise exception using errcode='P0001',message='reviewer ineligible'; end if;
  authorized:=true;
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
   if prior.tournament_id=c.tournament_id and prior.operation_type='review_rule12_correction_v2' and prior.target_id=p_correction_id and prior.request_hash=request_hash then return prior.response_payload; end if;
   insert into app.independent_card_correction_operation_conflicts(tournament_id,actor_profile_id,canonical_game_id,correction_id,operation_type,attempted_operation_id,attempted_request_hash,prior_receipt_id,prior_receipt_tournament_id,reason_code) values(c.tournament_id,p_actor_id,c.canonical_game_id,p_correction_id,'review_rule12_correction_v2',p_operation_id,request_hash,prior.id,prior.tournament_id,'idempotency_conflict');
   return jsonb_build_object('status','rejected','code','idempotency_conflict','correctionId',p_correction_id);
  end if;
  perform 1 from app.tournaments where id=c.tournament_id and status='open' for update; if not found then raise exception using errcode='P0001',message='tournament closed'; end if;
  perform 1 from app.event_publication_states where tournament_id=c.tournament_id and event_id=c.event_id and state='draft' for update; if not found then raise exception using errcode='P0001',message='publication guarded'; end if;
  perform 1 from app.events e join app.ruleset_versions rv on rv.id=e.ruleset_version_id and rv.tournament_id=e.tournament_id where e.id=c.event_id and e.tournament_id=c.tournament_id and e.format='standard_singles' and e.scoring_method='digital' and rv.format='standard_singles' and rv.approved_at is not null; if not found then raise exception using errcode='P0001',message='event ineligible'; end if;
  select * into l from app.independent_card_correction_lifecycles where correction_id=p_correction_id for update;
  if not found or l.required_approvals<>1 then raise exception using errcode='P0001',message='review unavailable'; end if;
  if not exists(select 1 from app.correction_policy_versions p where p.tournament_id=c.tournament_id and p.version=l.policy_version and p.reason_required=l.reason_required and p.required_approvals=l.required_approvals) then raise exception using errcode='P0001',message='policy snapshot invalid'; end if;
  if not exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=p_correction_id and se.state='pending') or exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=p_correction_id and se.state in('approved','applied','rejected')) then raise exception using errcode='P0001',message='not pending'; end if;
  if g.state not in('verified','corrected') or g.version<>c.base_game_version then raise exception using errcode='P0001',message='stale source'; end if;
  response:=jsonb_build_object('status',case when p_decision='approve' then 'applied' else 'rejected' end,'decision',p_decision,'correctionId',p_correction_id,'gameId',c.canonical_game_id,'gameVersion',c.base_game_version,'correctionSequence',c.correction_sequence);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,c.tournament_id,'review_rule12_correction_v2',p_correction_id,request_hash,p_operation_id,'accepted',response,now()) returning id into rid;
  if p_decision='approve' then insert into app.independent_card_correction_state_events(correction_id,tournament_id,event_id,canonical_game_id,actor_profile_id,actor_role,state,transition_sequence,operation_receipt_id) values(p_correction_id,c.tournament_id,c.event_id,c.canonical_game_id,p_actor_id,actor_role,'approved',2,rid),(p_correction_id,c.tournament_id,c.event_id,c.canonical_game_id,p_actor_id,actor_role,'applied',3,rid); else insert into app.independent_card_correction_state_events(correction_id,tournament_id,event_id,canonical_game_id,actor_profile_id,actor_role,state,transition_sequence,operation_receipt_id) values(p_correction_id,c.tournament_id,c.event_id,c.canonical_game_id,p_actor_id,actor_role,'rejected',2,rid); end if;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(c.tournament_id,p_actor_id,c.canonical_game_id,rid,'independent_card_correction',p_correction_id,case when p_decision='approve' then 'rule12_correction_review_approved' else 'rule12_correction_review_rejected' end,jsonb_build_object('status','pending'),response);
  return response;
 exception when sqlstate 'P0001' then
  code:=case sqlerrm when 'invalid review' then 'invalid_request' when 'correction not found' then 'correction_not_found' when 'scope invalid' then 'correction_scope_invalid' when 'tournament closed' then 'tournament_closed' when 'publication guarded' then 'result_publication_guarded' when 'event ineligible' then 'event_not_eligible' when 'reviewer not independent' then 'reviewer_not_independent' when 'reviewer ineligible' then 'not_eligible_reviewer' when 'not pending' then 'not_pending_review' when 'stale source' then 'stale_correction_source' when 'policy snapshot invalid' then 'correction_policy_invalid' else 'correction_review_unavailable' end;
  response:=jsonb_build_object('status','rejected','code',code,'correctionId',p_correction_id);
  if authorized then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rule12:'||c.canonical_game_id::text,0));
   select * into c from app.independent_card_corrections where id=p_correction_id for update; if not found then return response; end if;
   select * into g from app.canonical_games where id=c.canonical_game_id and tournament_id=c.tournament_id and event_id=c.event_id for update; if not found then return response; end if;
   perform 1 from app.tournaments where id=c.tournament_id and status='open' for update; if not found then return response; end if;
   perform 1 from app.event_publication_states where tournament_id=c.tournament_id and event_id=c.event_id and state='draft' for update; if not found then return response; end if;
   if c.editor_profile_id=p_actor_id or exists(select 1 from app.event_participants ep where ep.id in(g.side_a_participant_id,g.side_b_participant_id) and ep.profile_id=p_actor_id) or not exists(select 1 from app.tournament_roles r where r.tournament_id=c.tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker')) then return response; end if;
   select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
   if found then
    if prior.tournament_id=c.tournament_id and prior.operation_type='review_rule12_correction_v2' and prior.target_id=p_correction_id and prior.request_hash=request_hash then return prior.response_payload; end if;
    insert into app.independent_card_correction_operation_conflicts(tournament_id,actor_profile_id,canonical_game_id,correction_id,operation_type,attempted_operation_id,attempted_request_hash,prior_receipt_id,prior_receipt_tournament_id,reason_code) values(c.tournament_id,p_actor_id,c.canonical_game_id,p_correction_id,'review_rule12_correction_v2',p_operation_id,request_hash,prior.id,prior.tournament_id,'idempotency_conflict') on conflict do nothing;
    return jsonb_build_object('status','rejected','code','idempotency_conflict','correctionId',p_correction_id);
   end if;
   insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,c.tournament_id,'review_rule12_correction_v2',p_correction_id,request_hash,p_operation_id,'rejected',response,now()) returning id into rid;
   insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(c.tournament_id,p_actor_id,c.canonical_game_id,rid,'independent_card_correction',p_correction_id,'rule12_correction_review_rejected',response);
  end if;
  return response;
 end;
end $$;

create or replace function public.get_rule12_player_notices_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('noticeId',n.id,'eventId',n.event_id,'gameId',n.canonical_game_id,'correctionId',n.correction_id,'noticeCode',n.notice_code,'createdAt',n.created_at) order by n.created_at desc),'[]'::jsonb)
  from app.rule12_affected_player_notices n where n.tournament_id=p_tournament_id and n.profile_id=p_actor_id and coalesce(auth.role(),'')='service_role'
$$;

create or replace function public.get_rule12_correction_workspace_v2(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor_role text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='P0001',message='server-only Rule 12 workspace'; end if;
  select r.role into actor_role from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id
    and r.role in('director','co_director','cross_checker') order by case r.role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1;
  if actor_role is null then return null; end if;
  return jsonb_build_object(
    'proposalCandidates',coalesce((select jsonb_agg(jsonb_build_object(
      'gameId',g.id,'eventId',g.event_id,'eventName',e.name,'roundNumber',r.round_number,'matchInstance',g.match_instance,'gameVersion',g.version,
      'correctionSequence',(select coalesce(max(c.correction_sequence),0) from app.independent_card_corrections c where c.canonical_game_id=g.id),
      'sideA',jsonb_build_object('displayName',pa.display_name,'tableSeat',sa.table_seat_snapshot,'isWinner',sa.is_winner,'margin',sa.margin),
      'sideB',jsonb_build_object('displayName',pb.display_name,'tableSeat',sb.table_seat_snapshot,'isWinner',sb.is_winner,'margin',sb.margin)
    ) order by e.name,r.round_number,g.match_instance)
    from app.canonical_games g join app.events e on e.id=g.event_id and e.tournament_id=g.tournament_id
    join app.rounds r on r.id=g.round_id and r.event_id=g.event_id and r.tournament_id=g.tournament_id
    join app.card_scorelines sa on sa.canonical_game_id=g.id and sa.side='a'
    join app.card_scorelines sb on sb.canonical_game_id=g.id and sb.side='b'
    join app.event_participants epa on epa.id=g.side_a_participant_id join app.profiles pa on pa.id=epa.profile_id
    join app.event_participants epb on epb.id=g.side_b_participant_id join app.profiles pb on pb.id=epb.profile_id
    where actor_role='cross_checker' and g.tournament_id=p_tournament_id and g.state in('verified','corrected')
      and not exists(select 1 from app.event_participants selfp where selfp.id in(g.side_a_participant_id,g.side_b_participant_id) and selfp.profile_id=p_actor_id)
      and not exists(select 1 from app.independent_card_correction_lifecycles l where l.canonical_game_id=g.id and exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=l.correction_id and se.state='pending') and not exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=l.correction_id and se.state in('approved','rejected')))
    ),'[]'::jsonb),
    'noticeTargets',coalesce((select jsonb_agg(jsonb_build_object('participantId',ep.id,'eventId',ep.event_id,'displayName',p.display_name) order by p.display_name,ep.id) from app.event_participants ep join app.profiles p on p.id=ep.profile_id where ep.tournament_id=p_tournament_id and ep.status in('registered','checked_in')),'[]'::jsonb),
    'pendingReviews',coalesce((select jsonb_agg(jsonb_build_object(
      'correctionId',c.id,'gameId',c.canonical_game_id,'eventName',e.name,'roundNumber',r.round_number,'matchInstance',g.match_instance,
      'ruleCase',c.rule_case,'reason',c.reason,'qualificationChanged',c.qualification_changed,
      'affectedNoticeTarget',case when affected.id is null then null else jsonb_build_object('participantId',affected.id,'displayName',affected_profile.display_name) end,
      'sideA',jsonb_build_object('displayName',pa.display_name,'tableSeat',sa.table_seat_snapshot,'original',jsonb_build_object('outcome',ca.recorded_outcome,'margin',ca.recorded_margin,'column',ca.recorded_column,'apparentQualifier',ca.apparent_qualifier),'adjudicated',jsonb_build_object('isWinner',pra.adjudicated_is_winner,'margin',pra.adjudicated_margin)),
      'sideB',jsonb_build_object('displayName',pb.display_name,'tableSeat',sb.table_seat_snapshot,'original',jsonb_build_object('outcome',cb.recorded_outcome,'margin',cb.recorded_margin,'column',cb.recorded_column,'apparentQualifier',cb.apparent_qualifier),'adjudicated',jsonb_build_object('isWinner',prb.adjudicated_is_winner,'margin',prb.adjudicated_margin))
    ) order by c.created_at)
    from app.independent_card_corrections c join app.independent_card_correction_lifecycles l on l.correction_id=c.id and l.required_approvals=1
    join app.canonical_games g on g.id=c.canonical_game_id join app.events e on e.id=c.event_id
    join app.rounds r on r.id=g.round_id and r.event_id=g.event_id and r.tournament_id=g.tournament_id join app.card_scorelines sa on sa.canonical_game_id=g.id and sa.side='a'
    join app.card_scorelines sb on sb.canonical_game_id=g.id and sb.side='b'
    join app.independent_card_correction_projections pra on pra.correction_id=c.id and pra.card_side='a'
    join app.independent_card_correction_projections prb on prb.correction_id=c.id and prb.card_side='b'
    join app.independent_card_correction_claims ca on ca.correction_id=c.id and ca.card_side='a'
    join app.independent_card_correction_claims cb on cb.correction_id=c.id and cb.card_side='b'
    join app.event_participants epa on epa.id=g.side_a_participant_id join app.profiles pa on pa.id=epa.profile_id
    join app.event_participants epb on epb.id=g.side_b_participant_id join app.profiles pb on pb.id=epb.profile_id
    left join app.event_participants affected on affected.id=c.affected_participant_id and affected.event_id=c.event_id and affected.tournament_id=c.tournament_id
    left join app.profiles affected_profile on affected_profile.id=affected.profile_id
    where c.tournament_id=p_tournament_id and c.editor_profile_id<>p_actor_id
      and not exists(select 1 from app.event_participants selfp where selfp.id in(g.side_a_participant_id,g.side_b_participant_id) and selfp.profile_id=p_actor_id)
      and exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=c.id and se.state='pending')
      and not exists(select 1 from app.independent_card_correction_state_events se where se.correction_id=c.id and se.state in('approved','rejected'))
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_rule12_correction_policy_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tournamentId',t.id,'tournamentStatus',t.status,'policyVersion',p.version,'reasonRequired',p.reason_required,'requiredApprovals',p.required_approvals,'canConfigure',t.status in('draft','open'))
  from app.tournaments t join lateral(select * from app.correction_policy_versions pv where pv.tournament_id=t.id order by pv.version desc limit 1)p on true
  where t.id=p_tournament_id and coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=t.id and r.profile_id=p_actor_id and r.role in('director','co_director'))
$$;

create or replace function public.configure_rule12_correction_policy_v1(p_actor_id uuid,p_tournament_id uuid,p_reason_required boolean,p_required_approvals smallint,p_expected_policy_version integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_version integer; prior app.operation_receipts%rowtype; rid uuid; response jsonb; request_hash text;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_reason_required is null or p_required_approvals not in(0,1) or p_expected_policy_version<0 or p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_request','tournament_id',p_tournament_id); end if;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('configure_rule12_correction_policy_v1',p_actor_id,p_tournament_id,p_reason_required,p_required_approvals,p_expected_policy_version,p_operation_id)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open') for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_not_configurable','tournament_id',p_tournament_id); end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director','tournament_id',p_tournament_id); end if;
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
    if prior.operation_type='configure_rule12_correction_policy_v1' and prior.target_id=p_tournament_id and prior.request_hash=request_hash then return prior.response_payload; end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict','tournament_id',p_tournament_id);
  end if;
  select max(version) into current_version from app.correction_policy_versions where tournament_id=p_tournament_id;
  if current_version is distinct from p_expected_policy_version then return jsonb_build_object('status','rejected','code','stale_policy','tournament_id',p_tournament_id); end if;
  response:=jsonb_build_object('status','configured','tournament_id',p_tournament_id,'policy_version',current_version+1,'reason_required',p_reason_required,'required_approvals',p_required_approvals);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'configure_rule12_correction_policy_v1',p_tournament_id,request_hash,p_operation_id,'accepted',response,now()) returning id into rid;
  insert into app.correction_policy_versions(tournament_id,version,reason_required,required_approvals,created_by_profile_id) values(p_tournament_id,current_version+1,p_reason_required,p_required_approvals,p_actor_id);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,rid,'correction_policy',p_tournament_id,'correction_policy_configured',response);
  return response;
end;
$$;

create or replace function public.get_rule12_correction_policy_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select r.response_payload from app.operation_receipts r where coalesce(auth.role(),'')='service_role' and r.actor_profile_id=p_actor_id and r.tournament_id=p_tournament_id and r.operation_type='configure_rule12_correction_policy_v1' and r.target_id=p_tournament_id and r.client_operation_id=p_operation_id limit 1
$$;

create or replace function public.get_rule12_correction_reconciliation_v1(p_actor_id uuid,p_correction_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when r.id is null then jsonb_build_object('state','unknown') else jsonb_build_object('state','resolved','response',r.response_payload) end
  from (select 1) seed left join app.operation_receipts r on r.actor_profile_id=p_actor_id and r.client_operation_id=p_operation_id and r.target_id=p_correction_id and r.operation_type in('create_rule12_correction_v2','review_rule12_correction_v2')
  where coalesce(auth.role(),'')='service_role' limit 1
$$;

revoke all on function public.create_rule12_correction_v2(uuid,uuid,uuid,integer,integer,text,jsonb,jsonb,boolean,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.get_rule12_player_notices_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_rule12_correction_workspace_v2(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_rule12_correction_policy_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.configure_rule12_correction_policy_v1(uuid,uuid,boolean,smallint,integer,uuid) from public,anon,authenticated;
revoke all on function public.get_rule12_correction_policy_reconciliation_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_rule12_correction_reconciliation_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.review_rule12_correction_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.review_rule12_correction_v2(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_rule12_correction_v2(uuid,uuid,uuid,integer,integer,text,jsonb,jsonb,boolean,uuid,text,uuid) to service_role;
grant execute on function public.get_rule12_player_notices_v1(uuid,uuid) to service_role;
grant execute on function public.get_rule12_correction_workspace_v2(uuid,uuid) to service_role;
grant execute on function public.get_rule12_correction_policy_v1(uuid,uuid) to service_role;
grant execute on function public.configure_rule12_correction_policy_v1(uuid,uuid,boolean,smallint,integer,uuid) to service_role;
grant execute on function public.get_rule12_correction_policy_reconciliation_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.get_rule12_correction_reconciliation_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.review_rule12_correction_v2(uuid,uuid,text,uuid) to service_role;

-- Repair the already-installed 0131 finalizer without rewriting correction
-- history: only an applied qualification-changing correction whose bound
-- notice is missing may block finalization. Rejected corrections never block.
do $repair$
declare definition text; target_function regprocedure; old_guard text; new_guard text;
begin
  target_function := coalesce(
    to_regprocedure('app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(uuid,uuid,uuid,uuid)'),
    to_regprocedure('public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)')
  );
  if target_function is null then
    raise exception 'qualification finalizer unavailable';
  end if;
  select pg_get_functiondef(target_function) into definition;
  old_guard := $old$if exists (select 1 from app.independent_card_corrections correction
      where correction.tournament_id = p_tournament_id and correction.event_id = p_event_id
        and correction.qualification_changed) then
      raise exception using errcode = 'P0001', message = 'qualification notice pending';
    end if;$old$;
  new_guard := $new$if exists (select 1 from app.independent_card_corrections correction
      cross join lateral (select state_event.state from app.independent_card_correction_state_events state_event
        where state_event.correction_id=correction.id order by state_event.transition_sequence desc limit 1) latest
      where correction.tournament_id = p_tournament_id and correction.event_id = p_event_id
        and correction.qualification_changed and latest.state='applied'
        and not exists(select 1 from app.rule12_affected_player_notices notice where notice.correction_id=correction.id)) then
      raise exception using errcode = 'P0001', message = 'qualification notice pending';
    end if;$new$;
  if strpos(definition,new_guard)>0 then
    null; -- clean-chain 0131 already contains the repaired guard
  elsif strpos(definition,old_guard)>0 then
    execute replace(definition,old_guard,new_guard); -- additive repair for an older installed 0131
  else
    raise exception '0131 qualification notice guard shape unavailable';
  end if;
end $repair$;

-- Keep every legacy reciprocal writer suspended.
revoke all on function public.propose_game_correction(uuid,uuid,integer,text,integer,text,uuid) from authenticated;
revoke all on function public.review_game_correction(uuid,text,uuid) from authenticated;
