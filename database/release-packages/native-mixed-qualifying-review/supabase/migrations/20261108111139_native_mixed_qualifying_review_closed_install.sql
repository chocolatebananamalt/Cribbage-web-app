-- CLOSED read-only mixed qualifying review. NOT AUTHORIZED FOR INSTALLATION.
-- Official migration runner supplies the sole transaction boundary.
-- No table/data changes, cohort enrollment or application grants.
set local lock_timeout='5s';
set local statement_timeout='30s';

do $review_pre$
declare signature text;
begin
 foreach signature in array array[
 'app.native_mixed_game_own_subject_v1()',
 'app.native_mixed_game_root_current_v1(uuid,uuid,uuid)',
 'app.native_mixed_game_complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)',
 'app.native_mixed_funding_seal_source_v1(uuid,uuid)',
 'app.native_mixed_simulation_hash_v1(jsonb)',
 'app.native_mixed_pilot_permitted_v1(uuid,uuid,uuid,boolean)'
 ]loop
  if to_regprocedure(signature)is null then raise exception 'review prerequisite missing: %',signature;end if;
 end loop;
end
$review_pre$;

-- FROZEN_REVIEW_SOURCE_1_BEGIN ee216fee4313839e99b0176aa5be78bdd3eb163d6540805f3a43d4a0939b7459
-- PRIVATE / DEFAULT-OFF. Practice review only, not official qualification.
-- Depends on native mixed game evidence, Start and funding predecessors.
-- No ordinary qualification, result, ledger, MRP or disbursement writes.

create function app.native_mixed_qualification_review_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.native_mixed_qualification_review_v1(tid uuid,eid uuid,sid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;root jsonb;st app.native_mixed_simulation_starts_v1%rowtype;
 funding jsonb;funding_entries jsonb;game_values jsonb;cards jsonb;heads jsonb;ties jsonb;body jsonb;loop_game jsonb;
begin
 if app.native_mixed_qualification_review_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();
 if actor is null then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director')for share nowait;
 if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select * into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 lock table app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,
  app.paper_official_identity_bindings in share mode nowait;
 game_values:=st.source_capture->'canonicalGames';
 if jsonb_array_length(game_values)<>108 then return jsonb_build_object('status','blocked','code','unsupported_field');end if;
 for loop_game in select value from jsonb_array_elements(game_values)loop
  if app.native_mixed_game_complete_with_start_v1(tid,eid,st,(loop_game->>'gameId')::uuid)is distinct from true then
   return jsonb_build_object('status','blocked','code','practice_games_incomplete');end if;
 end loop;
 -- Fresh private funding proof must still be the funding source sealed into Start.
 -- Do not switch JWT role or project this into the ordinary Finance assembler.
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'or not exists(
  select 1 from app.native_mixed_attendance_seals_v1 seal
  join app.native_mixed_attendance_scopes_v1 a on a.id=seal.scope_id
  where seal.id::text=st.source_capture#>>'{attendance,sealId}'
   and a.tournament_id=tid and a.event_id=eid
   and a.funding_scope_id::text=funding#>>'{scope,scopeId}'
   and a.funding_source_digest=funding->>'sourceDigest')then
  return jsonb_build_object('status','blocked','code','funding_source_changed');end if;
 select jsonb_agg(jsonb_build_object('participantId',x->'participantId','receiptId',x#>'{receipt,receiptId}',
  'amountMinor',x#>'{receipt,amountMinor}','sourceDigest',x->'sourceDigest')order by x->>'participantId')
 into funding_entries from jsonb_array_elements(funding->'entries')x;
 if jsonb_array_length(funding_entries)<>18 then return null;end if;
 -- Completion above proves every raw journal entry, actor, receipt and audit.
 -- Never aggregate the pseudonymized player-display DTO as canonical evidence.
 with results as(
  select g,coalesce(e.entry->'result',e.entry#>'{claims,0,result}')r
  from jsonb_array_elements(game_values)g join app.native_mixed_game_evidence_v1 e
   on e.start_id=sid and e.game_id=(g->>'gameId')::uuid and e.sequence=1
 ),lines as(
  select g->>'sideAParticipantId'pid,g->>'sideBParticipantId'opp,r->>'winnerSide'='a'won,(r->>'margin')::integer margin from results
  union all
  select g->>'sideBParticipantId',g->>'sideAParticipantId',r->>'winnerSide'='b',(r->>'margin')::integer from results
 ),totals as(
  select pid,count(*)games,count(distinct opp)opponents,count(*)filter(where won)wins,
   sum(case when won then case when margin>=31 then 3 else 2 end else 0 end)gp,
   sum(case when won then margin else 0 end)pos,sum(case when won then 0 else margin end)neg
  from lines group by pid
 ),ranked as(
  select t.*,rank()over(order by gp desc,wins desc,pos-neg desc,pos desc)place,
   count(*)over(partition by gp,wins,pos-neg,pos)tie_count
  from totals t
 )select jsonb_agg(jsonb_build_object('participantId',rc.pid,'fixedTournamentId',a->'fixedId',
  'games',rc.games,'distinctOpponents',rc.opponents,'wins',rc.wins,'losses',rc.games-rc.wins,'gamePoints',rc.gp,
  'positiveSpread',rc.pos,'negativeSpread',rc.neg,'netSpread',rc.pos-rc.neg,'rank',rc.place,'tieCount',rc.tie_count)
  order by rc.place,rc.pid)into cards from ranked rc join jsonb_array_elements(st.source_capture->'fixedAssignments')a on a->>'participantId'=rc.pid;
 if jsonb_array_length(cards)<>18 or exists(select 1 from jsonb_array_elements(cards)c
  where (c->>'games')::integer<>12 or(c->>'distinctOpponents')::integer<>12)then
  return jsonb_build_object('status','blocked','code','scorecard_shape_invalid');end if;
 select coalesce(jsonb_agg(x),'[]')into ties from jsonb_array_elements(cards)x where(x->>'tieCount')::integer>1;
 select jsonb_agg(jsonb_build_object('gameId',game_id,'revision',revision,'historyDigest',digest)order by game_id)
 into heads from(select game_id,count(*)revision,app.native_mixed_simulation_hash_v1(jsonb_agg(entry order by sequence))digest
  from app.native_mixed_game_evidence_v1 where start_id=sid group by game_id)h;
 body:=jsonb_build_object('kind','native-mixed-qualification-finance-review-v1','status','review_available',
  'tournamentId',tid,'eventId',eid,'startId',sid,'startSourceDigest',root->>'startSourceDigest',
  'evidenceHeads',heads,'cards',cards,'entrantCount',18,'qualifyingCount',5,
  'qualificationReady',jsonb_array_length(ties)=0,'tieReviewRequired',jsonb_array_length(ties)>0,
  'tieReviewReason',case when jsonb_array_length(ties)>0 then 'Head-to-head where applicable, then a deciding game; no arbitrary selection.'else null end,
  'fundingSourceDigest',funding->>'sourceDigest','simulatedReceipts',funding_entries,
  'simulatedGrossMinor',funding#>'{totals,receiptMinor}','costsMinor',null,'netPrizeFundMinor',null,'awards',null,
  'policyReviewRequired',true,'simulationOnly',true,'officialQualificationRecorded',false,'mrpAwarded',false,
  'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryFinanceSource',false);
 return body||jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body));
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;
alter function app.native_mixed_qualification_review_enabled_v1()owner to postgres;
alter function app.native_mixed_qualification_review_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_qualification_review_enabled_v1(),app.native_mixed_qualification_review_v1(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;


-- FROZEN_REVIEW_SOURCE_1_END

-- FROZEN_REVIEW_SOURCE_2_BEGIN b1896f8050060c22841fd24394185726abadf3c62879d3832abac8ffb38e0961
-- LOCAL / UNEXECUTED / REVOKED. Read-only normal own-session transport.
-- Install AFTER the closed preparation51 package and unchanged
-- native-mixed-qualification-review-v1.sql. No new flag, cohort or grant.
-- Exact available envelope: {kind:'native-mixed-review-provider-v1',actorId,
-- sessionId,tournamentId,eventId,review:<native-mixed-qualification-finance-review-v1>}.
-- Every unavailable/blocked/denied result is SQL NULL, never an empty review.

create function public.get_native_mixed_qualification_review_provider_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;session_value uuid;st app.native_mixed_simulation_starts_v1%rowtype;review_value jsonb;
begin
 if p_tournament_id is null or p_event_id is null or auth.role()is distinct from'authenticated'then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();
 if actor is null then return null;end if;
 -- own_subject validates the signed session claim and locks its live user/session.
 session_value:=(auth.jwt()->>'session_id')::uuid;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor
  and role in('director','co_director')for share nowait;
 if not found then return null;end if;
 if app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,false)is distinct from true then return null;end if;
 -- UNIQUE(tournament_id,event_id) resolves the authoritative immutable Start.
 -- The caller supplies neither a Start ID nor a privileged actor/session claim.
 select * into st from app.native_mixed_simulation_starts_v1
  where tournament_id=p_tournament_id and event_id=p_event_id for share nowait;
 if not found then return null;end if;
 review_value:=app.native_mixed_qualification_review_v1(p_tournament_id,p_event_id,st.id);
 if review_value->>'kind'is distinct from'native-mixed-qualification-finance-review-v1'
  or review_value->>'status'is distinct from'review_available'
  or review_value->>'tournamentId'is distinct from p_tournament_id::text
  or review_value->>'eventId'is distinct from p_event_id::text
  or review_value->>'startId'is distinct from st.id::text
  or review_value->>'startSourceDigest'is distinct from st.source_digest
 then return null;end if;
 -- Expiry and own-session/cohort authorization are checked again after the full
 -- raw-evidence/funding proof. The API also recaptures before releasing a reply.
 if app.native_mixed_game_own_subject_v1()is distinct from actor
  or(auth.jwt()->>'session_id')is distinct from session_value::text
  or app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,false)is distinct from true
 then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor
  and role in('director','co_director')for share nowait;
 if not found then return null;end if;
 return jsonb_build_object('kind','native-mixed-review-provider-v1','actorId',actor,'sessionId',session_value,
  'tournamentId',p_tournament_id,'eventId',p_event_id,'review',review_value);
exception when invalid_text_representation or lock_not_available then return null;end$$;
alter function public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)
 from public,anon,authenticated,service_role;


-- FROZEN_REVIEW_SOURCE_2_END

-- All new entrypoints must be closed before the official runner commits.
do $review_closed$
declare signature text;role_name text;function_oid oid;owner_oid oid;
begin
 foreach signature in array array[
 'app.native_mixed_qualification_review_enabled_v1()',
 'app.native_mixed_qualification_review_v1(uuid,uuid,uuid)',
 'public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)'
 ]loop
  function_oid:=to_regprocedure(signature);
  select proowner into owner_oid from pg_proc where oid=function_oid;
  if function_oid is null or owner_oid is distinct from 'postgres'::regrole::oid then raise exception 'review function owner mismatch: %',signature;end if;
  if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a where p.oid=function_oid and a.grantee=0 and a.privilege_type='EXECUTE')then raise exception 'review PUBLIC permission remains: %',signature;end if;
  foreach role_name in array array['anon','authenticated','service_role']loop
   if has_function_privilege(role_name,function_oid,'EXECUTE')then raise exception 'review permission remains: % %',role_name,signature;end if;
  end loop;
 end loop;
 if app.native_mixed_qualification_review_enabled_v1()is distinct from false then raise exception 'review gate must remain false';end if;
end
$review_closed$;
