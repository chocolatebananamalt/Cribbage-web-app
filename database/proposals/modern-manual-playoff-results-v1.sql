-- PRIVATE / DEFAULT OFF. Redacted verified sporting summary only. No native
-- digital confirmations are synthesized and this grants no Finance authority.
begin;
create function public.get_modern_manual_playoff_results_v1(tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare actor uuid;q app.qualification_result_versions%rowtype;g app.modern_manual_playoff_generations_v1%rowtype;slot_no integer;r jsonb;s jsonb;matches jsonb:='[]';players jsonb;complete boolean:=true;digest text;begin
 if app.modern_manual_playoff_transport_enabled_v1()is distinct from true then return null;end if;actor:=app.manual_mixed_handoff_actor_v1();if actor is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))then return null;end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null or q.qualifier_count not in(4,5)or app.qualification_resolution_snapshot_current_v1(q.id)is distinct from true then return null;end if;
 if not exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=tid and event_id=eid and qualification_id=q.id)then return null;end if;
 for slot_no in 1..q.qualifier_count-1 loop
  select*into g from app.modern_manual_playoff_generations_v1 where tournament_id=tid and event_id=eid and qualification_id=q.id and slot=slot_no order by version desc limit 1;
  if g.id is null then complete:=false;matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'status','pending'));continue;end if;
  s:=app.modern_manual_playoff_source_v1(g.actor_id,tid,eid,q.id,slot_no);
  if s->>'status'is distinct from'source_available'or s->>'currentGenerationId'is distinct from g.id::text or s->>'sourceDigest'is distinct from g.source_digest then return null;end if;
  r:=app.modern_manual_playoff_current_result_v1(g.actor_id,tid,eid,q.id,slot_no);
  if r is null then complete:=false;matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'status','pending'));continue;end if;
  select jsonb_agg(jsonb_build_object('participantId',p.id,'name',qr.display_name_snapshot,'tournamentPlayerId',a.verification_id)order by case when p.id=(r->>'winnerId')::uuid then 0 else 1 end)into players from app.event_participants p join app.qualification_result_rows qr on qr.participant_id=p.id and qr.result_version_id=q.id join app.initial_seating_assignments a on a.tournament_id=tid and a.roster_entry_id=p.roster_entry_id where p.id in((r->>'winnerId')::uuid,(r->>'loserId')::uuid)and p.tournament_id=tid and p.event_id=eid;
  if jsonb_array_length(players)<>2 then return null;end if;
  matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'status','verified','resultId',r->'resultId','generationId',g.id,'sourceDigest',g.source_digest,'winner',players->0,'loser',players->1));
 end loop;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('modern-manual-playoff-results-v1',tid,eid,q.id,matches)::text,'utf8'),'sha256'),'hex');
 if app.manual_mixed_handoff_actor_v1()is distinct from actor or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))then return null;end if;
 return jsonb_build_object('kind','modern-manual-playoff-results-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'qualificationId',q.id,'qualifierCount',q.qualifier_count,'sourceDigest',digest,'matches',matches,'complete',complete,'sourceCurrent',true,'financeAuthorized',false,'moneyMoved',false);
exception when lock_not_available then return null;end$$;
alter function public.get_modern_manual_playoff_results_v1(uuid,uuid)owner to postgres;
revoke all on function public.get_modern_manual_playoff_results_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
