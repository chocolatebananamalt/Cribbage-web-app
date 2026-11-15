-- Restore director authorization on team side-pool money elections.
--
-- 0177 guarded app.event_side_pool_team_election_versions with
-- app.guard_side_pool_team_election_v3(), which checks that the acting profile
-- holds director or co_director on the tournament. 0187 dropped that trigger
-- and recreated a trigger of the SAME NAME bound to
-- app.guard_side_pool_election_start_v4(), which only checks play state and the
-- reconciliation lock. 0187 also redefined guard_side_pool_team_election_v3,
-- but nothing has re-attached it since, so the role check has been dead code
-- from 0187 onward.
--
-- The RPC never carried its own role check either, unlike the singles
-- equivalent public.set_event_side_pool_election_v1 (0170), so from 0187 any
-- authenticated profile could record or zero out a team's side-pool payment
-- election by calling POST /api/v1/tournaments/<id>/side-pools with
-- action set_team_election. Team PAYOUTS were never affected: both their RPC
-- check (0187) and their trigger (0177) remain intact.
--
-- This repairs both layers, so a future trigger swap cannot silently remove
-- authorization again:
--   1. the RPC rejects a non-director with the same not_director code the
--      singles path already returns, which the route surfaces as a clean
--      rejection rather than the 503 a raised exception would produce;
--   2. the trigger is re-bound to the role-checking guard, which also restores
--      the election version-conflict check that 0187 dropped.

create or replace function public.set_event_side_pool_team_election_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_team_entry_id uuid,p_election_id uuid,p_elected boolean,p_amount_received_minor integer,p_payment_method text,p_payment_reference text,p_reason text,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d app.event_side_pool_definition_versions%rowtype; prior app.operation_receipts%rowtype; rid uuid:=extensions.gen_random_uuid(); v integer; response jsonb; h text;
begin
 if p_actor_id is null or p_election_id is null or p_idempotency_key is null or p_amount_received_minor<0 or p_payment_method not in('cash','check') or length(trim(p_reason)) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into d from app.event_side_pool_definition_versions where pool_id=p_pool_id and event_id=p_event_id order by version desc limit 1;
 if not found or not d.active or not exists(select 1 from app.event_team_entries where id=p_team_entry_id and event_id=p_event_id and tournament_id=p_tournament_id) then return jsonb_build_object('status','rejected','code','pool_unavailable'); end if;
 if p_elected and p_amount_received_minor>d.entry_fee_minor then return jsonb_build_object('status','rejected','code','received_exceeds_due'); end if;
 if not p_elected and p_amount_received_minor<>0 then return jsonb_build_object('status','rejected','code','removed_election_requires_zero'); end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('set_event_side_pool_team_election_v1',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_team_entry_id,p_election_id,p_elected,p_amount_received_minor,p_payment_method,p_payment_reference,p_reason)::text,'utf8'),'sha256'),'hex'); perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pool-team-election:'||p_pool_id||':'||p_team_entry_id,0)); select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key; if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
 select coalesce(max(version),0)+1 into v from app.event_side_pool_team_election_versions where election_id=p_election_id; response:=jsonb_build_object('status','side_pool_team_election_recorded','poolId',p_pool_id,'teamEntryId',p_team_entry_id,'electionId',p_election_id,'version',v,'elected',p_elected);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(rid,p_actor_id,p_tournament_id,'set_event_side_pool_team_election_v1',p_election_id,h,p_idempotency_key,'accepted',response,clock_timestamp());
 insert into app.event_side_pool_team_election_versions(election_id,pool_id,tournament_id,event_id,team_entry_id,version,elected,amount_due_minor,amount_received_minor,payment_method,payment_reference,reason,actor_profile_id,operation_receipt_id) values(p_election_id,p_pool_id,p_tournament_id,p_event_id,p_team_entry_id,v,p_elected,case when p_elected then d.entry_fee_minor else 0 end,p_amount_received_minor,p_payment_method,nullif(trim(p_payment_reference),''),trim(p_reason),p_actor_id,rid); return response;
end $$;

revoke all on function public.set_event_side_pool_team_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.set_event_side_pool_team_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)
  to service_role;

drop trigger if exists event_side_pool_team_election_guard on app.event_side_pool_team_election_versions;
create trigger event_side_pool_team_election_guard before insert on app.event_side_pool_team_election_versions for each row execute function app.guard_side_pool_team_election_v3();
