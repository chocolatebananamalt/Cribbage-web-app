-- Event-scoped, short-lived QR presence check-in.  A bearer shown on a live
-- display is valid for sixty seconds only; it is not a roster, payment, or
-- scorecard disclosure mechanism.

create table app.event_check_in_windows (
  event_id uuid primary key references app.events(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  state text not null check (state in ('open','closed')),
  opened_at timestamptz not null,
  opened_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  closed_at timestamptz,
  closed_by_profile_id uuid references app.profiles(id) on delete restrict,
  version integer not null check (version > 0),
  check (state = 'open' and closed_at is null and closed_by_profile_id is null
    or state = 'closed' and closed_at is not null and closed_by_profile_id is not null),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict
);
alter table app.event_check_in_windows enable row level security;
alter table app.event_check_in_windows force row level security;
revoke all on table app.event_check_in_windows from public, anon, authenticated;

create table app.event_check_in_qr_credentials (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  token_salt bytea not null check (octet_length(token_salt) = 32),
  token_digest bytea not null check (octet_length(token_digest) = 32),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  issued_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  check (expires_at > issued_at and expires_at <= issued_at + interval '61 seconds')
);
alter table app.event_check_in_qr_credentials enable row level security;
alter table app.event_check_in_qr_credentials force row level security;
revoke all on table app.event_check_in_qr_credentials from public, anon, authenticated;
create index event_check_in_qr_credentials_event_expiry_idx
  on app.event_check_in_qr_credentials(event_id, expires_at desc);

create table app.event_check_in_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  roster_entry_id uuid,
  requested_first_name text not null,
  requested_last_name text not null,
  requested_email text not null,
  requested_acc_number text,
  request_state text not null check (request_state in ('pending_desk','checked_in','already_checked_in','rejected')),
  source text not null check (source in ('qr','desk')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_profile_id uuid references app.profiles(id) on delete restrict,
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (roster_entry_id, tournament_id) references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  check ((request_state in ('pending_desk','rejected') and resolved_at is null and resolved_by_profile_id is null)
    or (request_state in ('checked_in','already_checked_in') and resolved_at is not null))
);
alter table app.event_check_in_requests enable row level security;
alter table app.event_check_in_requests force row level security;
revoke all on table app.event_check_in_requests from public, anon, authenticated;
create index event_check_in_requests_event_state_idx on app.event_check_in_requests(event_id, request_state, created_at desc);
create index event_check_in_requests_roster_event_idx on app.event_check_in_requests(roster_entry_id, event_id, created_at desc);

create table app.event_check_in_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  roster_entry_id uuid not null,
  version integer not null check (version > 0),
  state text not null check (state in ('checked_in','cancelled')),
  source text not null check (source in ('qr','desk')),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  request_id uuid references app.event_check_in_requests(id) on delete restrict,
  operation_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (roster_entry_id, tournament_id) references app.tournament_roster_entries(id, tournament_id) on delete restrict,
  unique (event_id, roster_entry_id, version)
);
alter table app.event_check_in_events enable row level security;
alter table app.event_check_in_events force row level security;
revoke all on table app.event_check_in_events from public, anon, authenticated;
create trigger event_check_in_events_immutable before update or delete on app.event_check_in_events
for each row execute function app.reject_immutable_history();
create index event_check_in_events_event_roster_version_idx on app.event_check_in_events(event_id, roster_entry_id, version desc);

create or replace function app.event_qr_player_is_paid_and_enrolled(
  p_tournament_id uuid, p_event_id uuid, p_roster_entry_id uuid
) returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from app.event_participants participant
    where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id
      and participant.roster_entry_id=p_roster_entry_id
  ) and exists (
    select 1 from lateral (
      select obligation.amount_owed_minor from app.roster_payment_obligation_versions obligation
      where obligation.tournament_id=p_tournament_id and obligation.roster_entry_id=p_roster_entry_id
      order by obligation.version desc limit 1
    ) owed
    left join lateral (
      select receipt.amount_minor from app.roster_payment_events receipt
      where receipt.tournament_id=p_tournament_id and receipt.roster_entry_id=p_roster_entry_id
      order by receipt.version desc limit 1
    ) received on true
    where coalesce(received.amount_minor,0) >= owed.amount_owed_minor
  )
$$;
revoke all on function app.event_qr_player_is_paid_and_enrolled(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.open_event_check_in_window_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt uuid; v_hash text; v_existing app.operation_receipts%rowtype; v_version integer; v_response jsonb;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director'); end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.registration_status in('open','closed') for update; if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
  perform 1 from app.events e where e.id=p_event_id and e.tournament_id=p_tournament_id and exists(select 1 from app.tournament_setup_activations a where a.tournament_id=e.tournament_id and a.event_id=e.id); if not found then return jsonb_build_object('status','rejected','code','event_unavailable'); end if;
  if exists(select 1 from app.events e where e.id=p_event_id and e.event_type='consolation') and not exists(select 1 from app.qualification_result_versions q join app.events main on main.id=q.event_id where q.tournament_id=p_tournament_id and main.event_type='main') then return jsonb_build_object('status','rejected','code','consolation_not_eligible'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('open_event_check_in_window_v1',p_tournament_id::text,p_event_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key; if found then if v_existing.request_hash=v_hash then return v_existing.response_payload; else return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; end if;
  select coalesce(version,0)+1 into v_version from app.event_check_in_windows where event_id=p_event_id for update;
  v_response:=jsonb_build_object('status','event_check_in_opened','eventId',p_event_id,'version',v_version);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'open_event_check_in_window_v1',p_event_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.event_check_in_windows(event_id,tournament_id,state,opened_at,opened_by_profile_id,version) values(p_event_id,p_tournament_id,'open',now(),p_actor_id,v_version) on conflict(event_id) do update set state='open',opened_at=excluded.opened_at,opened_by_profile_id=excluded.opened_by_profile_id,closed_at=null,closed_by_profile_id=null,version=excluded.version;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_check_in_window',p_event_id,'event_check_in_opened',v_response); return v_response;
end $$;

create or replace function public.close_event_check_in_window_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt uuid; v_hash text; v_existing app.operation_receipts%rowtype; v_version integer; v_response jsonb;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('close_event_check_in_window_v1',p_tournament_id::text,p_event_id::text)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
  select version+1 into v_version from app.event_check_in_windows where event_id=p_event_id and tournament_id=p_tournament_id and state='open' for update;if not found then return jsonb_build_object('status','rejected','code','window_not_open');end if;
  v_response:=jsonb_build_object('status','event_check_in_closed','eventId',p_event_id,'version',v_version);insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'close_event_check_in_window_v1',p_event_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;update app.event_check_in_windows set state='closed',closed_at=now(),closed_by_profile_id=p_actor_id,version=v_version where event_id=p_event_id;insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,v_receipt,'event_check_in_window',p_event_id,'event_check_in_closed',v_response);return v_response;
end $$;

create or replace function public.issue_event_check_in_qr_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_credential_id uuid,p_salt bytea,p_digest bytea,p_expires_at timestamptz,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_response jsonb;
begin
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_credential_id is null or p_idempotency_key is null or octet_length(p_salt)<>32 or octet_length(p_digest)<>32 or p_expires_at<=now() or p_expires_at>now()+interval '61 seconds' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) or not exists(select 1 from app.event_check_in_windows w where w.event_id=p_event_id and w.tournament_id=p_tournament_id and w.state='open') then return jsonb_build_object('status','rejected','code','window_not_open');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('issue_event_check_in_qr_v1',p_tournament_id::text,p_event_id::text,p_credential_id::text,p_expires_at,p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
 v_response:=jsonb_build_object('status','event_check_in_qr_issued','eventId',p_event_id,'expiresAt',p_expires_at);insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(p_tournament_id,p_actor_id,'issue_event_check_in_qr_v1',p_event_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;insert into app.event_check_in_qr_credentials(id,tournament_id,event_id,token_salt,token_digest,expires_at,issued_by_profile_id)values(p_credential_id,p_tournament_id,p_event_id,p_salt,p_digest,p_expires_at,p_actor_id);insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,v_receipt,'event_check_in_qr',p_credential_id,'event_check_in_qr_issued',v_response);return v_response;
end $$;

create or replace function public.submit_event_check_in_qr_request_v1(
  p_credential_id uuid,p_secret text,p_first_name text,p_last_name text,p_email text,p_acc_number text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_credential app.event_check_in_qr_credentials%rowtype;v_name text;v_email text;v_acc text;v_roster uuid;v_state text;v_request uuid;
begin
 if p_credential_id is null or p_secret !~ '^[A-Za-z0-9_-]{43}$' or length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(trim(coalesce(p_last_name,''))) not between 1 and 80 or length(trim(coalesce(p_email,''))) not between 3 and 320 then return jsonb_build_object('status','unavailable');end if;
 select c.* into v_credential from app.event_check_in_qr_credentials c join app.event_check_in_windows w on w.event_id=c.event_id and w.tournament_id=c.tournament_id and w.state='open' where c.id=p_credential_id and c.expires_at>now() and app.fixed_32_byte_equal(c.token_digest,extensions.digest(c.token_salt||convert_to(lower(p_credential_id::text)||'.'||p_secret,'utf8'),'sha256'));if not found then return jsonb_build_object('status','unavailable');end if;
 v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g'));v_email:=lower(trim(p_email));v_acc:=nullif(upper(trim(p_acc_number)),'');
 select r.id into v_roster from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1)life on true where r.tournament_id=v_credential.tournament_id and coalesce(life.event_type,'active')<>'withdrawn' and (r.claimed_normalized_acc_number is not distinct from v_acc) and r.claimed_normalized_name=v_name and r.claimed_normalized_email=v_email limit 1;
 if v_roster is not null and app.event_qr_player_is_paid_and_enrolled(v_credential.tournament_id,v_credential.event_id,v_roster) then
   select state into v_state from app.event_check_in_events where event_id=v_credential.event_id and roster_entry_id=v_roster order by version desc limit 1;
   if v_state='checked_in' then return jsonb_build_object('status','already_checked_in');end if;
   insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source) values(v_credential.tournament_id,v_credential.event_id,v_roster,coalesce((select max(version)+1 from app.event_check_in_events where event_id=v_credential.event_id and roster_entry_id=v_roster),1),'checked_in','qr');
   insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source,resolved_at) values(v_credential.tournament_id,v_credential.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'checked_in','qr',now()) returning id into v_request;
   return jsonb_build_object('status','checked_in');
 end if;
 insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source) values(v_credential.tournament_id,v_credential.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'pending_desk','qr') returning id into v_request;
 return jsonb_build_object('status','desk_required');
end $$;

create or replace function public.get_event_check_in_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then jsonb_build_object(
  'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'name',e.name,'eventType',e.event_type,'format',e.format,'windowState',coalesce(w.state,'closed'),'checkedInCount',coalesce((select count(*) from app.event_check_in_events x where x.event_id=e.id and x.state='checked_in'),0),'pendingDeskCount',coalesce((select count(*) from app.event_check_in_requests q where q.event_id=e.id and q.request_state='pending_desk'),0)) order by v.ordinal) from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id left join app.event_check_in_windows w on w.event_id=e.id where a.tournament_id=p_tournament_id),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('requestId',q.id,'eventId',q.event_id,'firstName',q.requested_first_name,'lastName',q.requested_last_name,'email',q.requested_email,'accNumber',q.requested_acc_number,'createdAt',q.created_at) order by q.created_at desc) from app.event_check_in_requests q where q.tournament_id=p_tournament_id and q.request_state='pending_desk'),'[]'::jsonb)
 ) else null end
$$;

revoke all on function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.issue_event_check_in_qr_v1(uuid,uuid,uuid,uuid,bytea,bytea,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.submit_event_check_in_qr_request_v1(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.get_event_check_in_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.open_event_check_in_window_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.close_event_check_in_window_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.issue_event_check_in_qr_v1(uuid,uuid,uuid,uuid,bytea,bytea,timestamptz,uuid) to service_role;
grant execute on function public.submit_event_check_in_qr_request_v1(uuid,text,text,text,text,text) to service_role;
grant execute on function public.get_event_check_in_workspace_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
