-- Director-authorized association of an existing Auth profile to one private
-- roster entry. This is not event enrollment, a role grant, or score authority.

create table app.roster_account_links (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  linked_at timestamptz not null default now(),
  foreign key (roster_entry_id, tournament_id)
    references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (tournament_id, roster_entry_id),
  unique (tournament_id, profile_id)
);
alter table app.roster_account_links enable row level security;
alter table app.roster_account_links force row level security;
revoke all on table app.roster_account_links from public, anon, authenticated;
create trigger roster_account_links_immutable before update or delete on app.roster_account_links
for each row execute function app.reject_immutable_history();
create index roster_account_links_actor_profile_id_idx on app.roster_account_links(actor_profile_id);
create index roster_account_links_operation_receipt_id_idx on app.roster_account_links(operation_receipt_id);

create table app.roster_account_link_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  attempted_roster_entry_id uuid,
  attempted_profile_id uuid,
  attempted_idempotency_key uuid not null,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.roster_account_link_conflicts enable row level security;
alter table app.roster_account_link_conflicts force row level security;
revoke all on table app.roster_account_link_conflicts from public, anon, authenticated;
create trigger roster_account_link_conflicts_immutable before update or delete on app.roster_account_link_conflicts
for each row execute function app.reject_immutable_history();
create index roster_account_link_conflicts_actor_profile_id_idx on app.roster_account_link_conflicts(actor_profile_id);
create index roster_account_link_conflicts_tournament_id_idx on app.roster_account_link_conflicts(tournament_id);
create index roster_account_link_conflicts_prior_receipt_id_idx on app.roster_account_link_conflicts(prior_receipt_id);

create or replace function public.link_roster_entry_to_account(
  p_tournament_id uuid, p_roster_entry_id uuid, p_profile_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_status text; v_exists boolean := false; v_authorized boolean := false;
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid; v_response jsonb;
  v_error text; v_code text; v_link_id uuid := extensions.gen_random_uuid();
begin begin
  if v_actor is null then raise exception using errcode='P0001', message='authentication required'; end if;
  if p_tournament_id is null or p_roster_entry_id is null or p_profile_id is null or p_idempotency_key is null then raise exception using errcode='P0001', message='invalid roster account link'; end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('link_roster_entry_to_account',p_tournament_id::text,p_roster_entry_id::text,p_profile_id::text,p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text,0));
  select status into v_status from app.tournaments where id=p_tournament_id for update; v_exists:=found;
  if not v_exists then raise exception using errcode='P0001', message='tournament unavailable'; end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=v_actor and r.role in ('director','co_director')) then raise exception using errcode='P0001', message='director role required'; end if;
  v_authorized:=true;
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001', message='idempotency conflict'; end if; return v_existing.response_payload; end if;
  if v_status not in ('draft','open') then raise exception using errcode='P0001', message='tournament unavailable'; end if;
  if p_profile_id=v_actor then raise exception using errcode='P0001', message='independent linker required'; end if;
  if not exists(select 1 from app.tournament_roster_entries r where r.id=p_roster_entry_id and r.tournament_id=p_tournament_id for update) then raise exception using errcode='P0001', message='roster entry unavailable'; end if;
  if not exists(select 1 from app.profiles p where p.id=p_profile_id) then raise exception using errcode='P0001', message='profile unavailable'; end if;
  if exists(select 1 from app.roster_account_links l where l.tournament_id=p_tournament_id and l.roster_entry_id=p_roster_entry_id) then raise exception using errcode='P0001', message='roster entry already linked'; end if;
  if exists(select 1 from app.roster_account_links l where l.tournament_id=p_tournament_id and l.profile_id=p_profile_id) then raise exception using errcode='P0001', message='profile already linked'; end if;
  v_response:=jsonb_build_object('status','roster_account_linked','rosterEntryId',p_roster_entry_id,'profileLinked',true,'eventEnrolled',false,'roleGranted',false,'checkedIn',false,'seatAssigned',false);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'link_roster_entry_to_account',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.roster_account_links(id,tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id) values(v_link_id,p_tournament_id,p_roster_entry_id,p_profile_id,v_actor,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'roster_account_link',v_link_id,'roster_account_linked',v_response);
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error=message_text;
  v_code:=case v_error when 'authentication required' then 'authentication_required' when 'director role required' then 'not_director' when 'idempotency conflict' then 'idempotency_conflict' when 'independent linker required' then 'independent_linker_required' when 'roster entry unavailable' then 'roster_entry_unavailable' when 'profile unavailable' then 'profile_unavailable' when 'roster entry already linked' then 'roster_entry_already_linked' when 'profile already linked' then 'profile_already_linked' else 'roster_account_link_rejected' end;
  v_response:=jsonb_build_object('status','rejected','code',v_code,'rosterEntryId',p_roster_entry_id);
  if v_authorized and v_exists then
    if v_error='idempotency conflict' then insert into app.roster_account_link_conflicts(actor_profile_id,tournament_id,attempted_roster_entry_id,attempted_profile_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code) values(v_actor,p_tournament_id,p_roster_entry_id,p_profile_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,v_code);
    else insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'link_roster_entry_to_account',coalesce(p_roster_entry_id,p_tournament_id),coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt; insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'roster_account_link',coalesce(p_roster_entry_id,p_tournament_id),'roster_account_link_rejected',v_response); end if;
  end if;
  return v_response;
end; end; $$;
revoke all on function public.link_roster_entry_to_account(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.link_roster_entry_to_account(uuid,uuid,uuid,uuid) to authenticated;
