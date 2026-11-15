-- Repairs desk_check_in_event_v1, which could never succeed.
--
-- 0208:17 read the next version with a locking clause on an aggregate:
--
--   select coalesce(max(version),0)+1 into v_version from ... for update;
--
-- PostgreSQL rejects that at parse analysis with
--   0A000: FOR UPDATE is not allowed with aggregate functions
-- and plpgsql does not parse-analyze a function body at CREATE time, so 0208
-- applied cleanly and the error fired only on first invocation. Verified on
-- PostgreSQL 17.6 by executing the same statement shape.
--
-- Every rejection branch above it returns first, so an ineligible player still
-- gets a correct refusal. Only a player who passes the roster, payment and
-- enrollment checks reaches this line, which means desk check-in failed for
-- exactly the players who were eligible. The route reports the error as 503 and
-- event-check-in-client.tsx renders any non-ok response as "The player is not
-- ready for event check-in. Confirm their event enrollment and paid-in-full
-- payment record at the desk", so the director was told that a fully paid
-- player had not paid. The button is disabled unless the roster already shows
-- the player as paid, so every click that was possible hit this path.
--
-- The locking clause is not simply removed. Lines 16 and 17 are a
-- read-check-write, and the advisory lock at 0208:15 keys on
-- p_actor_id||':'||p_idempotency_key, which dedupes one caller's retry and does
-- not serialize two officials working the same desk. Dropping the clause alone
-- would trade a hard error for a silent lost update. A target-keyed advisory
-- lock is taken first instead, the shape already used at
-- 0215_side_pool_team_election_authorization.sql for the same problem.
--
-- The body below is 0208's verbatim, with those two edits only.

create or replace function public.desk_check_in_event_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_version integer;v_response jsonb;
begin
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_roster_entry_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
 if not exists(select 1 from app.event_check_in_windows w where w.tournament_id=p_tournament_id and w.event_id=p_event_id and w.state='open') then return jsonb_build_object('status','rejected','code','window_not_open');end if;
 if not exists(select 1 from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1) lifecycle on true where r.id=p_roster_entry_id and r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn') then return jsonb_build_object('status','rejected','code','roster_entry_unavailable');end if;
 if not app.event_qr_player_is_paid_and_enrolled(p_tournament_id,p_event_id,p_roster_entry_id) then return jsonb_build_object('status','rejected','code','payment_or_enrollment_required');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('desk_check_in_event_v1',p_tournament_id::text,p_event_id::text,p_roster_entry_id::text)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('desk-check-in:'||p_event_id::text||':'||p_roster_entry_id::text,0));
 if exists(select 1 from app.event_check_in_events e where e.event_id=p_event_id and e.roster_entry_id=p_roster_entry_id and e.state='checked_in') then return jsonb_build_object('status','already_checked_in','eventId',p_event_id,'rosterEntryId',p_roster_entry_id);end if;
 select coalesce(max(version),0)+1 into v_version from app.event_check_in_events where event_id=p_event_id and roster_entry_id=p_roster_entry_id;
 v_response:=jsonb_build_object('status','checked_in','eventId',p_event_id,'rosterEntryId',p_roster_entry_id,'source','desk');insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(p_tournament_id,p_actor_id,'desk_check_in_event_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;
 insert into app.event_check_in_events(tournament_id,event_id,roster_entry_id,version,state,source,actor_profile_id,operation_receipt_id)values(p_tournament_id,p_event_id,p_roster_entry_id,v_version,'checked_in','desk',p_actor_id,v_receipt);
 update app.event_check_in_requests set request_state='checked_in',resolved_at=now(),resolved_by_profile_id=p_actor_id where event_id=p_event_id and roster_entry_id=p_roster_entry_id and request_state='pending_desk';
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,v_receipt,'event_check_in',p_roster_entry_id,'event_check_in_recorded_at_desk',v_response);return v_response;
end $$;
