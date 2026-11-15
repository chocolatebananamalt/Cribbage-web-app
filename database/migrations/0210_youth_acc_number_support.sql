-- Youth ACC numbers have the same member identity as their adult form.
-- Keep the supplied value for display/audit, while matching on the base number.

create or replace function app.acc_identity_key_v1(p_acc_number text)
returns text language sql immutable set search_path='' as $$
  select nullif(regexp_replace(upper(regexp_replace(trim(coalesce(p_acc_number,'')),'[[:space:]]+','','g')),'Y$',''),'')
$$;
revoke all on function app.acc_identity_key_v1(text) from public,anon,authenticated;

alter table app.registration_claims add column if not exists acc_identity_key text;
alter table app.tournament_roster_entries add column if not exists claimed_acc_identity_key text;

do $$
declare v_collisions integer;
begin
  with active_roster as (
    select r.tournament_id,coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number)) as acc_identity_key
    from app.tournament_roster_entries r
    left join lateral(select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true
    where coalesce(lifecycle.event_type,'active')<>'withdrawn' and coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number)) is not null
  )
  select count(*) into v_collisions from (
    select tournament_id,acc_identity_key from active_roster group by tournament_id,acc_identity_key having count(*)>1
  ) collisions;
  if v_collisions>0 then
    raise exception 'youth/adult ACC identity collision requires roster review';
  end if;
end $$;

create or replace function app.capture_registration_claim_acc_identity_key_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.acc_identity_key:=app.acc_identity_key_v1(new.normalized_acc_number);
  return new;
end $$;
revoke all on function app.capture_registration_claim_acc_identity_key_v1() from public,anon,authenticated;
drop trigger if exists registration_claims_capture_acc_identity_key on app.registration_claims;
create trigger registration_claims_capture_acc_identity_key before insert or update of normalized_acc_number on app.registration_claims
for each row execute function app.capture_registration_claim_acc_identity_key_v1();

create or replace function app.capture_roster_acc_identity_key_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.claimed_acc_identity_key:=app.acc_identity_key_v1(new.claimed_normalized_acc_number);
  return new;
end $$;
revoke all on function app.capture_roster_acc_identity_key_v1() from public,anon,authenticated;
drop trigger if exists tournament_roster_entries_capture_acc_identity_key on app.tournament_roster_entries;
create trigger tournament_roster_entries_capture_acc_identity_key before insert or update of claimed_normalized_acc_number on app.tournament_roster_entries
for each row execute function app.capture_roster_acc_identity_key_v1();

create index if not exists tournament_roster_entries_acc_identity_key_idx on app.tournament_roster_entries(tournament_id,claimed_acc_identity_key);
create index if not exists registration_claims_acc_identity_key_idx on app.registration_claims(tournament_id,acc_identity_key);

create or replace function app.roster_identity_outcome_v1(p_tournament_id uuid,p_name text,p_email text,p_acc text,p_excluded_claim_id uuid default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_hard boolean:=false;v_withdrawn boolean:=false;v_weak boolean:=false;v_key text;v_acc_key text;
begin
  v_acc_key:=app.acc_identity_key_v1(p_acc);
  foreach v_key in array array_remove(array[
    case when v_acc_key is null then null else 'roster-identity:acc:'||p_tournament_id::text||':'||v_acc_key end,
    case when p_email is null then null else 'roster-identity:email:'||p_tournament_id::text||':'||p_email end,
    case when p_email is null then null else 'roster-identity:name-email:'||p_tournament_id::text||':'||p_name||':'||p_email end
  ],null) loop perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0)); end loop;
  with active_roster as (
    select r.* from app.tournament_roster_entries r
    left join lateral(select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true
    where r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'
  ), active_claims as (
    select c.* from app.registration_claims c where c.tournament_id=p_tournament_id and c.id is distinct from p_excluded_claim_id and c.status not in('rejected','withdrawn')
  )
  select exists(select 1 from active_roster r where (v_acc_key is not null and coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=v_acc_key) or (p_email is not null and r.claimed_normalized_name=p_name and r.claimed_normalized_email=p_email))
      or exists(select 1 from active_claims c where (v_acc_key is not null and coalesce(c.acc_identity_key,app.acc_identity_key_v1(c.normalized_acc_number))=v_acc_key) or (p_email is not null and c.normalized_name=p_name and c.normalized_email=p_email)) into v_hard;
  if v_hard then return 'duplicate'; end if;
  select exists(select 1 from app.tournament_roster_entries r join lateral(select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true where r.tournament_id=p_tournament_id and lifecycle.event_type='withdrawn' and ((v_acc_key is not null and coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=v_acc_key) or (p_email is not null and r.claimed_normalized_name=p_name and r.claimed_normalized_email=p_email))) into v_withdrawn;
  if v_withdrawn then return 'withdrawn'; end if;
  with active_roster as (
    select r.* from app.tournament_roster_entries r left join lateral(select e.event_type from app.roster_entry_lifecycle_events e where e.roster_entry_id=r.id order by e.version desc limit 1) lifecycle on true
    where r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'
  ), active_claims as (select c.* from app.registration_claims c where c.tournament_id=p_tournament_id and c.id is distinct from p_excluded_claim_id and c.status not in('rejected','withdrawn'))
  select exists(select 1 from active_roster r where r.claimed_normalized_name=p_name or (p_email is not null and r.claimed_normalized_email=p_email))
      or exists(select 1 from active_claims c where c.normalized_name=p_name or (p_email is not null and c.normalized_email=p_email)) into v_weak;
  return case when v_weak then 'review' else 'clear' end;
end $$;
revoke all on function app.roster_identity_outcome_v1(uuid,text,text,text,uuid) from public,anon,authenticated;

alter function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) rename to submit_registration_claim_v4_before_youth_acc;
create function public.submit_registration_claim_v4(p_link_id uuid,p_digest bytea,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_intended_payment_method text,p_scorecard_type text,p_client_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tournament uuid;v_name text;v_email text;v_acc text;v_outcome text;v_result jsonb;
begin
  if p_first_name is null or p_last_name is null or p_email is null or p_acc_number is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g'));v_email:=lower(trim(p_email));v_acc:=nullif(trim(p_acc_number),'');
  if v_acc is not null and v_acc !~ '^[A-Z]{2}[0-9]+Y?$' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  select tournament_id into v_tournament from app.tournament_registration_links where id=p_link_id and app.fixed_32_byte_equal(token_digest,p_digest);if not found then return jsonb_build_object('status','unavailable');end if;
  v_outcome:=app.roster_identity_outcome_v1(v_tournament,v_name,v_email,v_acc,null);
  if v_outcome in('duplicate','withdrawn') then return jsonb_build_object('status','rejected','code','already_registered');end if;
  v_result:=public.submit_registration_claim_v4_before_identity_guard(p_link_id,p_digest,p_first_name,p_last_name,p_email,p_acc_number,p_intended_payment_method,p_scorecard_type,p_client_operation_id);
  if v_outcome='review' and v_result->>'status'='received' then update app.registration_claims set status='needs_review' where tournament_id=v_tournament and client_operation_id=p_client_operation_id;end if;
  return v_result;
end $$;
revoke all on function public.submit_registration_claim_v4_before_youth_acc(uuid,bytea,text,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) to service_role;

alter function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) rename to create_manual_roster_entry_v3_before_youth_acc;
create function public.create_manual_roster_entry_v3(p_actor_id uuid,p_tournament_id uuid,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_scorecard_type text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text;v_email text;v_acc text;v_outcome text;
begin
  v_name:=lower(regexp_replace(trim(coalesce(p_first_name,''))||' '||trim(coalesce(p_last_name,'')),'[[:space:]]+',' ','g'));v_email:=nullif(lower(trim(coalesce(p_email,''))), '');v_acc:=nullif(trim(coalesce(p_acc_number,'')), '');
  if v_acc is not null and v_acc !~ '^[A-Z]{2}[0-9]+Y?$' then return jsonb_build_object('status','rejected','code','invalid_manual_entry');end if;
  if length(v_name)>1 then
    v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_name,v_email,v_acc,null);
    if v_outcome='duplicate' then return jsonb_build_object('status','rejected','code','duplicate_roster_entry');end if;
    if v_outcome='withdrawn' then return jsonb_build_object('status','rejected','code','withdrawn_roster_entry');end if;
    if v_outcome='review' then return jsonb_build_object('status','rejected','code','potential_duplicate');end if;
  end if;
  return public.create_manual_roster_entry_v3_before_acc_guard(p_actor_id,p_tournament_id,p_first_name,p_last_name,p_email,p_acc_number,p_scorecard_type,p_idempotency_key);
end $$;
revoke all on function public.create_manual_roster_entry_v3_before_youth_acc(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) to service_role;

alter function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) rename to import_roster_csv_v3_before_youth_acc;
create function public.import_roster_csv_v3(p_actor_id uuid,p_tournament_id uuid,p_rows jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row jsonb;v_name text;v_email text;v_acc text;v_outcome text;
begin
  if jsonb_typeof(p_rows)<>'array' or exists(select 1 from jsonb_array_elements(p_rows) x where nullif(trim(x->>'accNumber'),'') is not null and trim(x->>'accNumber') !~ '^[A-Z]{2}[0-9]+Y?$') then return jsonb_build_object('status','rejected','code','invalid_roster_batch');end if;
  if exists(with rows as (select app.acc_identity_key_v1(x->>'accNumber') acc_key from jsonb_array_elements(p_rows) x) select 1 from rows where acc_key is not null group by acc_key having count(*)>1) then return jsonb_build_object('status','rejected','code','duplicate_in_batch');end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name:=lower(regexp_replace(trim(v_row->>'firstName')||' '||trim(v_row->>'lastName'),'[[:space:]]+',' ','g'));v_email:=nullif(lower(trim(v_row->>'email')),'');v_acc:=nullif(trim(v_row->>'accNumber'),'');v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_name,v_email,v_acc,null);
    if v_outcome='duplicate' then return jsonb_build_object('status','rejected','code','duplicate_roster_entry');end if;
    if v_outcome='withdrawn' then return jsonb_build_object('status','rejected','code','withdrawn_roster_entry');end if;
    if v_outcome='review' then return jsonb_build_object('status','rejected','code','potential_duplicate');end if;
  end loop;
  return public.import_roster_csv_v3_before_acc_guard(p_actor_id,p_tournament_id,p_rows,p_idempotency_key);
end $$;
revoke all on function public.import_roster_csv_v3_before_youth_acc(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) to service_role;

create or replace function public.submit_event_check_in_completion_v1(p_completion_id uuid,p_secret text,p_first_name text,p_last_name text,p_email text,p_acc_number text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session app.event_check_in_completion_sessions%rowtype;v_name text;v_email text;v_acc text;v_roster uuid;v_state text;
begin
  if p_completion_id is null or p_secret !~ '^[A-Za-z0-9_-]{43}$' or length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(trim(coalesce(p_last_name,''))) not between 1 and 80 or length(trim(coalesce(p_email,''))) not between 3 and 320 or trim(coalesce(p_acc_number,'')) !~ '^[A-Z]{2}[0-9]+Y?$' then return jsonb_build_object('status','unavailable'); end if;
  select s.* into v_session from app.event_check_in_completion_sessions s join app.event_check_in_windows w on w.event_id=s.event_id and w.tournament_id=s.tournament_id and w.state='open' where s.id=p_completion_id and s.expires_at>now() and app.fixed_32_byte_equal(s.token_digest,extensions.digest(s.token_salt||convert_to(lower(p_completion_id::text)||'.'||p_secret,'utf8'),'sha256'));
  if not found then return jsonb_build_object('status','unavailable'); end if;
  v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g'));v_email:=lower(trim(p_email));v_acc:=trim(p_acc_number);
  select r.id into v_roster from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1) life on true where r.tournament_id=v_session.tournament_id and coalesce(life.event_type,'active')<>'withdrawn' and coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=app.acc_identity_key_v1(v_acc) and r.claimed_normalized_name=v_name and r.claimed_normalized_email=v_email limit 1;
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
revoke all on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) to service_role;

create or replace function public.get_tournament_seating_directory_unbounded_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid default null,p_query text default null)
returns jsonb language sql stable security definer set search_path='' as $$
select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id) then jsonb_build_object('tournamentId',t.id,'tournamentName',t.name,'entries',coalesce((select jsonb_agg(x order by x->>'displayName') from (
  select jsonb_build_object('entryKind','player','eventId',ep.event_id,'eventName',e.name,'displayName',r.claimed_display_name,'teamName',null,'scorecardType',r.scorecard_type,'assignedTableSeat',seat.initial_table_seat,'verificationId',seat.verification_id,'currentTableSeat',null,'isSelf',l.profile_id=p_actor_id) x
    from app.event_participants ep join app.events e on e.id=ep.event_id join app.tournament_roster_entries r on r.id=ep.roster_entry_id left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id join app.initial_seating_assignments seat on seat.roster_entry_id=r.id and seat.tournament_id=r.tournament_id
    where ep.tournament_id=p_tournament_id and e.format='standard_singles' and (p_event_id is null or ep.event_id=p_event_id) and (nullif(trim(p_query),'') is null or lower(r.claimed_display_name) like '%'||lower(trim(p_query))||'%' or coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=app.acc_identity_key_v1(p_query))
  union all
  select jsonb_build_object('entryKind','team_member','eventId',te.event_id,'eventName',e.name,'displayName',r.claimed_display_name,'teamName',team.display_name,'scorecardType',v.scorecard_type,'assignedTableSeat',seat.initial_table_seat,'verificationId',seat.verification_id,'currentTableSeat',cg.current_table_seat,'isSelf',tm.profile_id=p_actor_id) x
    from app.event_team_entries te join app.events e on e.id=te.event_id join app.event_teams team on team.id=te.team_id join app.event_team_members tm on tm.team_id=team.id join app.tournament_roster_entries r on r.id=tm.roster_entry_id join lateral(select * from app.event_team_entry_versions q where q.team_entry_id=te.id order by q.version desc limit 1)v on true join app.event_team_seating_assignments seat on seat.team_entry_id=te.id left join lateral(select case when g.side_a_team_entry_id=te.id then g.side_a_table_seat else g.side_b_table_seat end current_table_seat from app.event_team_games g where g.event_id=te.event_id and (g.side_a_team_entry_id=te.id or g.side_b_team_entry_id=te.id) and g.state in('pending','submitted','mismatch','confirmation_pending') order by g.game_number,g.match_instance limit 1) cg on true
    where te.tournament_id=p_tournament_id and (p_event_id is null or te.event_id=p_event_id) and (nullif(trim(p_query),'') is null or lower(r.claimed_display_name) like '%'||lower(trim(p_query))||'%' or coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=app.acc_identity_key_v1(p_query))
) q),'[]'::jsonb)) else null end from app.tournaments t where t.id=p_tournament_id
$$;
revoke all on function public.get_tournament_seating_directory_unbounded_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_seating_directory_unbounded_v1(uuid,uuid,uuid,text) to service_role;

notify pgrst,'reload schema';
