-- A current 60-second display code proves an in-person scan.  The separate,
-- opaque completion credential gives that same device five minutes to finish
-- entering required check-in fields without extending the display code.

create table app.event_check_in_completion_sessions (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  source_qr_credential_id uuid not null references app.event_check_in_qr_credentials(id) on delete restrict,
  token_salt bytea not null check (octet_length(token_salt) = 32),
  token_digest bytea not null check (octet_length(token_digest) = 32),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes 1 second')
);
alter table app.event_check_in_completion_sessions enable row level security;
alter table app.event_check_in_completion_sessions force row level security;
revoke all on table app.event_check_in_completion_sessions from public, anon, authenticated;
create index event_check_in_completion_sessions_lookup_idx on app.event_check_in_completion_sessions(id, expires_at);
create index event_check_in_completion_sessions_event_expiry_idx on app.event_check_in_completion_sessions(event_id, expires_at desc);
create trigger event_check_in_completion_sessions_immutable before update or delete on app.event_check_in_completion_sessions for each row execute function app.reject_immutable_history();

create or replace function public.bootstrap_event_check_in_qr_v1(
  p_qr_credential_id uuid, p_qr_secret text, p_completion_id uuid,
  p_salt bytea, p_digest bytea, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_qr app.event_check_in_qr_credentials%rowtype;
begin
  if p_qr_credential_id is null or p_completion_id is null or p_qr_secret !~ '^[A-Za-z0-9_-]{43}$'
    or octet_length(p_salt) <> 32 or octet_length(p_digest) <> 32
    or p_expires_at <= now() or p_expires_at > now() + interval '5 minutes 1 second' then
    return jsonb_build_object('status','unavailable');
  end if;
  select c.* into v_qr from app.event_check_in_qr_credentials c
    join app.event_check_in_windows w on w.event_id=c.event_id and w.tournament_id=c.tournament_id and w.state='open'
    where c.id=p_qr_credential_id and c.expires_at>now()
      and app.fixed_32_byte_equal(c.token_digest, extensions.digest(c.token_salt || convert_to(lower(p_qr_credential_id::text)||'.'||p_qr_secret,'utf8'),'sha256'));
  if not found then return jsonb_build_object('status','unavailable'); end if;
  insert into app.event_check_in_completion_sessions(id,tournament_id,event_id,source_qr_credential_id,token_salt,token_digest,expires_at)
    values(p_completion_id,v_qr.tournament_id,v_qr.event_id,v_qr.id,p_salt,p_digest,p_expires_at);
  return jsonb_build_object('status','ready','expiresAt',p_expires_at);
end $$;

create or replace function public.submit_event_check_in_completion_v1(
  p_completion_id uuid,p_secret text,p_first_name text,p_last_name text,p_email text,p_acc_number text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session app.event_check_in_completion_sessions%rowtype;v_name text;v_email text;v_acc text;v_roster uuid;v_state text;
begin
  if p_completion_id is null or p_secret !~ '^[A-Za-z0-9_-]{43}$'
    or length(trim(coalesce(p_first_name,''))) not between 1 and 80
    or length(trim(coalesce(p_last_name,''))) not between 1 and 80
    or length(trim(coalesce(p_email,''))) not between 3 and 320
    or upper(trim(coalesce(p_acc_number,''))) !~ '^[A-Z]{2}[0-9]+$' then return jsonb_build_object('status','unavailable'); end if;
  select s.* into v_session from app.event_check_in_completion_sessions s
    join app.event_check_in_windows w on w.event_id=s.event_id and w.tournament_id=s.tournament_id and w.state='open'
    where s.id=p_completion_id and s.expires_at>now()
      and app.fixed_32_byte_equal(s.token_digest,extensions.digest(s.token_salt||convert_to(lower(p_completion_id::text)||'.'||p_secret,'utf8'),'sha256'));
  if not found then return jsonb_build_object('status','unavailable'); end if;
  v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g')); v_email:=lower(trim(p_email)); v_acc:=upper(trim(p_acc_number));
  select r.id into v_roster from app.tournament_roster_entries r
    left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1) life on true
    where r.tournament_id=v_session.tournament_id and coalesce(life.event_type,'active')<>'withdrawn'
      and r.claimed_normalized_acc_number=v_acc and r.claimed_normalized_name=v_name and r.claimed_normalized_email=v_email limit 1;
  if v_roster is not null and app.event_qr_player_is_paid_and_enrolled(v_session.tournament_id,v_session.event_id,v_roster) then
    select state into v_state from app.event_check_in_events where event_id=v_session.event_id and roster_entry_id=v_roster order by version desc limit 1;
    if v_state='checked_in' then return jsonb_build_object('status','already_checked_in'); end if;
    insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source) values(v_session.tournament_id,v_session.event_id,v_roster,coalesce((select max(version)+1 from app.event_check_in_events where event_id=v_session.event_id and roster_entry_id=v_roster),1),'checked_in','qr');
    insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source,resolved_at) values(v_session.tournament_id,v_session.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'checked_in','qr',now());
    return jsonb_build_object('status','checked_in');
  end if;
  insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source) values(v_session.tournament_id,v_session.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'pending_desk','qr');
  return jsonb_build_object('status','desk_required');
end $$;

revoke all on function public.bootstrap_event_check_in_qr_v1(uuid,text,uuid,bytea,bytea,timestamptz) from public,anon,authenticated;
revoke all on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.bootstrap_event_check_in_qr_v1(uuid,text,uuid,bytea,bytea,timestamptz) to service_role;
grant execute on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) to service_role;
notify pgrst,'reload schema';
