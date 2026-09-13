-- Protected resolution of immutable public registration claims. A decision is
-- deliberately not roster enrollment, payment, check-in, or seating.

alter table app.registration_claims
  add constraint registration_claims_id_tournament_unique unique (id, tournament_id);

create table app.registration_claim_decisions (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  claim_id uuid not null,
  decision text not null check (decision in ('approved_for_roster', 'rejected')),
  duplicate_resolution text check (duplicate_resolution in ('confirmed_distinct_person', 'duplicate_of_claim')),
  duplicate_of_claim_id uuid,
  reason text,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  decided_at timestamptz not null default now(),
  foreign key (claim_id, tournament_id) references app.registration_claims(id, tournament_id) on delete restrict,
  foreign key (duplicate_of_claim_id, tournament_id) references app.registration_claims(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id) references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (claim_id),
  check ((decision = 'approved_for_roster' and duplicate_of_claim_id is null and (duplicate_resolution is null or duplicate_resolution = 'confirmed_distinct_person')) or (decision = 'rejected' and ((duplicate_resolution is null and duplicate_of_claim_id is null) or (duplicate_resolution = 'duplicate_of_claim' and duplicate_of_claim_id is not null)))),
  check (duplicate_of_claim_id is null or duplicate_of_claim_id <> claim_id),
  check (reason is null or (length(trim(reason)) between 1 and 500 and octet_length(trim(reason)) <= 2000))
);
alter table app.registration_claim_decisions enable row level security;
alter table app.registration_claim_decisions force row level security;
revoke all on table app.registration_claim_decisions from public, anon, authenticated;
create trigger registration_claim_decisions_immutable before update or delete on app.registration_claim_decisions for each row execute function app.reject_immutable_history();
create index registration_claim_decisions_tournament_idx on app.registration_claim_decisions(tournament_id, decided_at desc);

create table app.registration_claim_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  tournament_id uuid references app.tournaments(id) on delete restrict,
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.registration_claim_operation_conflicts enable row level security;
alter table app.registration_claim_operation_conflicts force row level security;
revoke all on table app.registration_claim_operation_conflicts from public, anon, authenticated;
create trigger registration_claim_operation_conflicts_immutable before update or delete on app.registration_claim_operation_conflicts for each row execute function app.reject_immutable_history();

create or replace function public.get_registration_claim_review_workspace(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null or not exists (select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_actor and role in ('director','co_director')) then return null; end if;
  select jsonb_build_object('claims', coalesce(jsonb_agg(jsonb_build_object(
    'claimId', c.id, 'displayName', c.display_name, 'email', c.email, 'accNumber', c.acc_number,
    'intendedPaymentMethod', c.intended_payment_method, 'submittedAt', c.submitted_at,
    'decision', d.decision, 'collisionClaimIds', coalesce(collisions.ids, '[]'::jsonb)
  ) order by c.submitted_at), '[]'::jsonb)) into v_result
  from app.registration_claims c
  left join app.registration_claim_decisions d on d.claim_id=c.id
  left join lateral (select jsonb_agg(other.id) ids from app.registration_claims other left join app.registration_claim_decisions od on od.claim_id=other.id where other.tournament_id=c.tournament_id and other.id<>c.id and od.decision is distinct from 'rejected' and (other.normalized_email=c.normalized_email or other.normalized_name=c.normalized_name or (c.normalized_acc_number is not null and other.normalized_acc_number=c.normalized_acc_number))) collisions on true
  where c.tournament_id=p_tournament_id;
  return v_result;
end; $$;

create or replace function public.review_registration_claim(
  p_tournament_id uuid, p_claim_id uuid, p_decision text, p_duplicate_resolution text,
  p_duplicate_of_claim_id uuid, p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_claim app.registration_claims%rowtype; v_existing app.operation_receipts%rowtype;
  v_hash text; v_reason text:=nullif(trim(coalesce(p_reason,'')), ''); v_receipt uuid; v_decision uuid:=extensions.gen_random_uuid(); v_response jsonb; v_error text; v_code text;
  v_tournament_exists boolean:=false; v_collision boolean:=false;
begin begin
  if v_actor is null then raise exception using errcode='P0001', message='authentication required'; end if;
  if p_tournament_id is null or p_claim_id is null or p_decision is null or p_decision not in ('approved_for_roster','rejected') or p_idempotency_key is null or length(coalesce(p_reason,''))>500 or octet_length(coalesce(p_reason,''))>2000 then raise exception using errcode='P0001', message='invalid registration review'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('review_registration_claim',p_tournament_id::text,p_claim_id::text,p_decision,coalesce(p_duplicate_resolution,''),coalesce(p_duplicate_of_claim_id::text,''),coalesce(v_reason,''),p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
  perform 1 from app.tournaments where id=p_tournament_id for update; v_tournament_exists:=found;
  if not v_tournament_exists then raise exception using errcode='P0001', message='tournament unavailable'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001', message='idempotency conflict'; end if; return v_existing.response_payload; end if;
  if not exists (select 1 from app.tournaments where id=p_tournament_id and status in ('draft','open')) then raise exception using errcode='P0001', message='tournament unavailable'; end if;
  if not exists (select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_actor and role in ('director','co_director')) then raise exception using errcode='P0001', message='director role required'; end if;
  select * into v_claim from app.registration_claims where id=p_claim_id and tournament_id=p_tournament_id for update;
  if not found then raise exception using errcode='P0001', message='claim unavailable'; end if;
  perform 1 from app.tournament_registration_links where id=v_claim.registration_link_id for update;
  if exists (select 1 from app.registration_claim_decisions where claim_id=p_claim_id) then raise exception using errcode='P0001', message='claim already decided'; end if;
  select exists(select 1 from app.registration_claims other left join app.registration_claim_decisions od on od.claim_id=other.id where other.tournament_id=p_tournament_id and other.id<>p_claim_id and od.decision is distinct from 'rejected' and (other.normalized_email=v_claim.normalized_email or other.normalized_name=v_claim.normalized_name or (v_claim.normalized_acc_number is not null and other.normalized_acc_number=v_claim.normalized_acc_number))) into v_collision;
  if p_decision='approved_for_roster' then
    if p_duplicate_of_claim_id is not null or (p_duplicate_resolution is not null and p_duplicate_resolution <> 'confirmed_distinct_person') then raise exception using errcode='P0001', message='invalid duplicate resolution'; end if;
    if v_collision and p_duplicate_resolution is distinct from 'confirmed_distinct_person' then raise exception using errcode='P0001', message='collision requires confirmation'; end if;
  end if;
  if p_decision='rejected' and p_duplicate_resolution='duplicate_of_claim' then
    if p_duplicate_of_claim_id is null or p_duplicate_of_claim_id=p_claim_id or not exists (select 1 from app.registration_claims other join app.registration_claim_decisions od on od.claim_id=other.id and od.decision='approved_for_roster' where other.id=p_duplicate_of_claim_id and other.tournament_id=p_tournament_id and (other.normalized_email=v_claim.normalized_email or other.normalized_name=v_claim.normalized_name or (v_claim.normalized_acc_number is not null and other.normalized_acc_number=v_claim.normalized_acc_number))) then raise exception using errcode='P0001', message='invalid duplicate reference'; end if;
  elsif p_decision='rejected' and (p_duplicate_resolution is not null or p_duplicate_of_claim_id is not null) then raise exception using errcode='P0001', message='invalid duplicate resolution'; end if;
  v_response:=jsonb_build_object('status',p_decision,'claimId',p_claim_id,'decisionId',v_decision,'rosterCreated',false,'paymentRecorded',false,'checkedIn',false);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'review_registration_claim',p_claim_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.registration_claim_decisions(id,tournament_id,claim_id,decision,duplicate_resolution,duplicate_of_claim_id,reason,actor_profile_id,operation_receipt_id) values(v_decision,p_tournament_id,p_claim_id,p_decision,p_duplicate_resolution,p_duplicate_of_claim_id,v_reason,v_actor,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'registration_claim',p_claim_id,'registration_claim_reviewed',v_response);
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error=message_text; v_code:=case v_error when 'authentication required' then 'authentication_required' when 'director role required' then 'not_director' when 'collision requires confirmation' then 'collision_unresolved' when 'invalid duplicate reference' then 'invalid_duplicate_reference' when 'claim already decided' then 'claim_already_decided' when 'idempotency conflict' then 'idempotency_conflict' else 'review_rejected' end;
  v_response:=jsonb_build_object('status','rejected','code',v_code,'claimId',p_claim_id);
  if v_error='idempotency conflict' then insert into app.registration_claim_operation_conflicts(actor_profile_id,tournament_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code) values(v_actor,p_tournament_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
  elsif v_actor is not null and v_tournament_exists then insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'review_registration_claim',p_claim_id,coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt; insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'registration_claim',p_claim_id,'registration_claim_review_rejected',v_response); end if;
  return v_response;
end; end; $$;

revoke all on function public.get_registration_claim_review_workspace(uuid) from public, anon;
revoke all on function public.review_registration_claim(uuid,uuid,text,text,uuid,text,uuid) from public, anon;
grant execute on function public.get_registration_claim_review_workspace(uuid) to authenticated;
grant execute on function public.review_registration_claim(uuid,uuid,text,text,uuid,text,uuid) to authenticated;
