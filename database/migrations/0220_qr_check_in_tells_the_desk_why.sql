-- A player turned away from QR self check-in is told "desk_required" and nothing
-- else, and the form then reports most failures as "your time expired". Four
-- unrelated causes look identical to the player and to the desk triaging them.
--
-- This adds a 'reason' alongside the existing 'status' so the desk knows which
-- of the four happened. Every 'status' value is unchanged, and nothing reads the
-- response shape (src/lib/api/event-check-in.ts guards requests only), so this is
-- additive.
--
-- It also makes the roster lookup deterministic. The lookup matches on
-- normalized name, email and ACC identity with `limit 1` and no `order by`.
-- No tournament currently has two ACTIVE roster entries sharing one normalized
-- identity, and the lookup already excludes withdrawn entries, so this is latent
-- rather than live. But nothing in the schema prevents it: there is no unique
-- constraint on that identity, and case alone does not separate rows ("Hi296"
-- and "HI296" both normalize to HI296). If it ever happens, `limit 1` picks
-- arbitrarily and the same player can be admitted on one scan and refused on the
-- next. The order by prefers a row enrolled in this event, then one that
-- satisfies the money gate, then the lowest id so repeat scans agree. With a
-- single match, which is every case today, it changes nothing.

create or replace function public.submit_event_check_in_completion_v1(p_completion_id uuid,p_secret text,p_first_name text,p_last_name text,p_email text,p_acc_number text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session app.event_check_in_completion_sessions%rowtype;v_name text;v_email text;v_acc text;v_roster uuid;v_state text;
begin
  if p_completion_id is null or p_secret !~ '^[A-Za-z0-9_-]{43}$' or length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(trim(coalesce(p_last_name,''))) not between 1 and 80 or length(trim(coalesce(p_email,''))) not between 3 and 320 or trim(coalesce(p_acc_number,'')) !~ '^[A-Z]{2}[0-9]+Y?$' then return jsonb_build_object('status','unavailable','reason','invalid_details');end if;
  select s.* into v_session from app.event_check_in_completion_sessions s join app.event_check_in_windows w on w.event_id=s.event_id and w.tournament_id=s.tournament_id and w.state='open' where s.id=p_completion_id and s.expires_at>now() and app.fixed_32_byte_equal(s.token_digest,extensions.digest(s.token_salt||convert_to(lower(p_completion_id::text)||'.'||p_secret,'utf8'),'sha256'));if not found then return jsonb_build_object('status','unavailable','reason','session_expired_or_window_closed');end if;
  v_name:=lower(regexp_replace(trim(p_first_name)||' '||trim(p_last_name),'[[:space:]]+',' ','g'));v_email:=lower(trim(p_email));v_acc:=trim(p_acc_number);
  select r.id into v_roster from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1) life on true where r.tournament_id=v_session.tournament_id and coalesce(life.event_type,'active')<>'withdrawn' and coalesce(r.claimed_acc_identity_key,app.acc_identity_key_v1(r.claimed_normalized_acc_number))=app.acc_identity_key_v1(v_acc) and r.claimed_normalized_name=v_name and r.claimed_normalized_email=v_email
    order by (exists(select 1 from app.event_participants p where p.tournament_id=v_session.tournament_id and p.event_id=v_session.event_id and p.roster_entry_id=r.id and p.status in ('registered','checked_in'))) desc,
             app.event_qr_player_is_paid_and_enrolled(v_session.tournament_id,v_session.event_id,r.id) desc,
             r.id
    limit 1;
  if v_roster is not null and app.event_qr_player_is_paid_and_enrolled(v_session.tournament_id,v_session.event_id,v_roster) and exists(select 1 from app.event_participants p where p.event_id=v_session.event_id and p.roster_entry_id=v_roster and p.status in ('registered','checked_in')) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-presence:'||v_roster::text,0));
    if app.event_attendance_conflict_v1(v_session.tournament_id,v_session.event_id,v_roster) then return jsonb_build_object('status','desk_required','reason','checked_in_to_another_event');end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-attendance:'||v_session.event_id::text||':'||v_roster::text,0));
    select state into v_state from app.event_check_in_events where event_id=v_session.event_id and roster_entry_id=v_roster order by version desc limit 1;if v_state='checked_in' then return jsonb_build_object('status','already_checked_in');elsif v_state='no_show' then return jsonb_build_object('status','desk_required','reason','marked_no_show');end if;
    insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source) values(v_session.tournament_id,v_session.event_id,v_roster,coalesce((select max(version)+1 from app.event_check_in_events where event_id=v_session.event_id and roster_entry_id=v_roster),1),'checked_in','qr');
    update app.event_participants set status='checked_in' where tournament_id=v_session.tournament_id and event_id=v_session.event_id and roster_entry_id=v_roster and status in ('registered','absent');
    insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source,resolved_at) values(v_session.tournament_id,v_session.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'checked_in','qr',now());return jsonb_build_object('status','checked_in');
  end if;
  insert into app.event_check_in_requests(tournament_id,event_id,roster_entry_id,requested_first_name,requested_last_name,requested_email,requested_acc_number,request_state,source) values(v_session.tournament_id,v_session.event_id,v_roster,trim(p_first_name),trim(p_last_name),v_email,v_acc,'pending_desk','qr');
  return jsonb_build_object('status','desk_required','reason',case when v_roster is null then 'not_recognized' else 'not_enrolled_or_unpaid' end);
end $$;

revoke all on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_event_check_in_completion_v1(uuid,text,text,text,text,text) to service_role;
notify pgrst,'reload schema';
