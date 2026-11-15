import assert from 'node:assert/strict';import fs from 'node:fs';import {spawn,spawnSync}from'node:child_process';
import {actor,tid,eid,uuid,quote,pid,seed}from'./fixtures/qualification-tie-foundation.mjs';
import {foundation}from'./fixtures/q-review-foundation.mjs';
const args=['--context','desktop-linux','exec','-i','cribbage-qualification-local','psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','fixture_qualification','-v','ON_ERROR_STOP=1'];
const authPrefix="set role postgres;set request.jwt.claim.role='service_role';\n";
const sql=q=>{const r=spawnSync('docker',args,{input:authPrefix+q,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);return r.stdout.trim();};
const checks=[];let op=0;
const workspace=`public.get_qualification_tie_workspace_v1('${actor}','${tid}','${eid}')`;
const call=(req,who=actor,id=uuid('0247',++op))=>`public.save_qualification_tie_resolution_v1('${who}','${tid}','${eid}',${req},'${id}')`;
const request=(group='0',winner=pid(1),method='head_to_head',extra='')=>`jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->${group}->'candidateIds','winnerId','${winner}','method','${method}','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')${extra}`;
const final=id=>`public.finalize_standard_singles_qualification_v1('${actor}','${tid}','${eid}','${id??uuid('9247',++op)}')`;
const pendingCorrection=()=>`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','a1310000-0000-4000-8000-000000000006','cross_checker');
 r:=public.configure_rule12_correction_policy_v1('${actor}','${tid}',true,1::smallint,(select max(version)from app.correction_policy_versions where tournament_id='${tid}'),'${uuid('e247',1)}');
 if r->>'status' is distinct from 'configured' then raise exception 'correction fixture policy failed %',r;end if;
 r:=public.create_rule12_correction_v2('a1310000-0000-4000-8000-000000000006','${uuid('6247',1)}','${uuid('e247',2)}',1,0,'12.2a','{"outcome":"win","margin":20,"column":"plus","apparentQualifier":true}'::jsonb,'{"outcome":"loss","margin":10,"column":"minus","apparentQualifier":false}'::jsonb,false,null,'TEST ONLY synthetic discrepancy for rejected-history test','${uuid('e247',3)}');
 if r->>'status' is distinct from 'pending' then raise exception 'correction fixture creation failed %',r;end if;`;

function scenario(kind,body){sql(`begin;set role postgres;select set_config('request.jwt.claim.role','service_role',true);${seed(kind)}do $test$declare w jsonb;r jsonb;s jsonb;before_rows jsonb;old_source text;begin ${body}end$test$;set constraints all immediate;rollback;`);}
scenario('h2h',`
 w:=${workspace};if w->'blockers' is distinct from '[]' or w->'groups'->0->>'method' is distinct from 'head_to_head' or w->'groups'->0->>'headToHeadWinnerId' is distinct from '${pid(1)}' then raise exception 'H2H workspace %',w;end if;
 if ${final()}->>'code' is distinct from 'ranking_tie_unresolved' then raise exception 'unresolved finalized';end if;
 if ${call(request('0',pid(2)),actor,uuid('0247',102))}->>'code' is distinct from 'head_to_head_winner_mismatch' then raise exception 'client H2H assertion accepted';end if;
 if ${call(request('0',pid(1),'one_game_playoff'))}->>'code' is distinct from 'method_unavailable' then raise exception 'H2H bypass accepted';end if;
 before_rows:=(select jsonb_agg(to_jsonb(x)order by id)from app.qualification_tie_totals_v1('${tid}','${eid}')x);
 r:=${call(request(),actor,uuid('0247',100))};if r->>'status' is distinct from 'qualification_tie_recorded' then raise exception 'save %',r;end if;
 s:=${call(request(),actor,uuid('0247',100))};if s is distinct from r then raise exception 'replay differed';end if;
 if ${call(request('0',pid(2)),actor,uuid('0247',100))}->>'code' is distinct from 'idempotency_conflict' then raise exception 'conflict not detected';end if;
 if ${call(request(),actor,uuid('0247',101))}->>'code' is distinct from 'resolution_already_recorded' then raise exception 'duplicate pair accepted';end if;

 old_source:=(select jsonb_build_object('receipts',(select count(*)from app.operation_receipts),'audits',(select count(*)from app.audit_events),'resolutions',(select count(*)from app.qualification_tie_resolutions_v1))::text);
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record'));if s is distinct from jsonb_build_object('authorized',true,'result',r)then raise exception 'exact successful reconciliation failed %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000102',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000002','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record'));if s->'result' is distinct from jsonb_build_object('status','rejected','eventId','11310000-0000-4000-8000-000000000001','code','head_to_head_winner_mismatch')then raise exception 'exact rejected reconciliation failed %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('reason','TEST ONLY changed reason'));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed accepted-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('evidenceReference','TEST ONLY changed evidence'));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed accepted-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('participantIds',jsonb_build_array('f2430000-0000-4000-8000-000000000001','f2430000-0000-4000-8000-000000000003')));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed accepted-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('expectedSourceFingerprint',repeat('0',64)));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed accepted-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('winnerId','f2430000-0000-4000-8000-000000000002'));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed accepted-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000100',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('method','one_game_playoff'));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed accepted-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000102',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000002','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record')||jsonb_build_object('reason','TEST ONLY changed rejected reason'));if s->'result'->>'code' is distinct from 'idempotency_conflict' then raise exception 'changed rejected-request reconciliation was not conflict %',s;end if;
 s:=public.get_qualification_tie_reconciliation_v1('a1310000-0000-4000-8000-000000000001','b1310000-0000-4000-8000-000000000001','11310000-0000-4000-8000-000000000001','02470000-0000-4000-8000-000000000999',jsonb_build_object('expectedSourceFingerprint',w->>'sourceFingerprint','participantIds',w->'groups'->0->'candidateIds','winnerId','f2430000-0000-4000-8000-000000000001','method','head_to_head','reason','TEST ONLY observed tie resolution','evidenceReference','TEST ONLY synthetic game record'));if s is distinct from jsonb_build_object('authorized',true,'result',null)then raise exception 'missing reconciliation not empty %',s;end if;
 if old_source is distinct from(select jsonb_build_object('receipts',(select count(*)from app.operation_receipts),'audits',(select count(*)from app.audit_events),'resolutions',(select count(*)from app.qualification_tie_resolutions_v1))::text)then raise exception 'read-only reconciliation mutated history';end if;
 if before_rows is distinct from (select jsonb_agg(to_jsonb(x)order by id)from app.qualification_tie_totals_v1('${tid}','${eid}')x)then raise exception 'totals changed';end if;
 if ${final(uuid('9247',100))}->>'status' is distinct from 'qualification_finalized' then raise exception 'resolved did not finalize';end if;
 if ${call(request(),actor,uuid('0247',100))} is distinct from r then raise exception 'accepted replay lost after finalization';end if;
 if (select count(*)from app.qualification_result_versions where event_id='${eid}') is distinct from 1 or(select participant_id from app.qualification_result_rows where event_id='${eid}' and ranking_ordinal=1) is distinct from '${pid(1)}' or exists(select 1 from app.qualification_result_rows where tied) then raise exception 'ranking result wrong';end if;
 if (select count(*)from app.qualification_tie_resolutions_v1) is distinct from 1 or(select count(*)from app.audit_events where action='qualification_tie_recorded') is distinct from 1 then raise exception 'duplicate records/audit';end if;
 begin update app.qualification_tie_resolutions_v1 set winner_id='${pid(2)}';raise exception 'mutation accepted';exception when raise_exception then if sqlerrm='mutation accepted' then raise;end if;end;
 `);checks.push('real H2H derived winner, unavailable manual bypass rejected, unchanged totals, exact/conflicting replay, immutable once-only finalization');checks.push('exact successful/rejected reconciliation, changed reason/evidence/pair/source/winner/method conflicts, missing operation and no read mutation');
scenario('manual',`
 w:=${workspace};if jsonb_array_length(w->'groups') is distinct from 2 or w->'groups'->0->>'method' is distinct from 'one_game_playoff' or (w->'groups'->0->>'affectsQualificationCut')::boolean is distinct from true then raise exception 'manual cutoff fixture %',w;end if;
 r:=${call(request('0',pid(3),'one_game_playoff'))};if r->>'status' is distinct from 'qualification_tie_recorded' then raise exception 'manual save %',r;end if;
 if ${final()}->>'code' is distinct from 'ranking_tie_unresolved' then raise exception 'other seed tie ignored';end if;
 if ${call(request('1',pid(4),'one_game_playoff'))}->>'status' is distinct from 'qualification_tie_recorded' then raise exception 'lower seed tie save';end if;
 if ${final()}->>'status' is distinct from 'qualification_finalized' then raise exception 'manual finalize';end if;
 if (select participant_id from app.qualification_result_rows where event_id='${eid}' and ranking_ordinal=1) is distinct from '${pid(3)}' or(select participant_id from app.qualification_result_rows where event_id='${eid}' and ranking_ordinal=3) is distinct from '${pid(4)}' then raise exception 'UUID chose ranking';end if;
 if (select sum(game_points)from app.qualification_result_rows where event_id='${eid}') is distinct from 4 or(select sum(verified_games)from app.qualification_result_rows where event_id='${eid}') is distinct from 4 then raise exception 'playoff points leaked';end if;
 `);checks.push('manual separately played winner, cutoff and seed-only pair resolutions, reverse-UUID rank, no extra qualifying game/points');
for(const kind of ['multiple','multiway']){
 scenario(kind,`w:=${workspace};if w->'groups'->0->>'method' is distinct from 'blocked' then raise exception 'ambiguous group not blocked %',w;end if;
 if ${call(request('0',pid(1),'one_game_playoff'))}->>'status' is distinct from 'rejected' then raise exception 'ambiguous recorded';end if;
 if ${final()}->>'code' is distinct from 'ranking_tie_unresolved' then raise exception 'ambiguous finalized';end if;`);
}checks.push('multiple meetings and multiway cycle remain blocked');
scenario('h2h',`
 w:=${workspace};old_source:=w->>'sourceFingerprint';r:=${call(request())};
 before_rows:=(select jsonb_agg(to_jsonb(x)order by id)from app.qualification_tie_totals_v1('${tid}','${eid}')x);
 ${pendingCorrection()}
 r:=public.review_rule12_correction_v2('${actor}','${uuid('e247',2)}','reject','${uuid('e247',4)}');
 if r->>'status' is distinct from 'rejected' or r->>'decision' is distinct from 'reject' then raise exception 'rejected correction fixture failed %',r;end if;
 set constraints all immediate;set constraints all deferred;
 if before_rows is distinct from(select jsonb_agg(to_jsonb(x)order by id)from app.qualification_tie_totals_v1('${tid}','${eid}')x)then raise exception 'rejected correction changed score totals';end if;
 if ${call(request())}->>'code' is distinct from 'stale_source' then raise exception 'stale same-total evidence accepted';end if;
 w:=${workspace};if w->>'sourceFingerprint' is null or w->>'sourceFingerprint'=old_source or w->'groups'->0->'resolution' is distinct from 'null' then raise exception 'old evidence revived';end if;
 if ${final()}->>'code' is distinct from 'ranking_tie_unresolved' then raise exception 'stale finalization accepted';end if;
 r:=${call(request())};
 s:=jsonb_build_object('count',(select count(*)from app.qualification_tie_resolutions_v1 where tournament_id='${tid}' and event_id='${eid}'),'workspace',${workspace});
 if r->>'status' is distinct from 'qualification_tie_recorded' or(s->>'count')::integer is distinct from 2 then raise exception 'fresh append not preserved: outcome=%, count=%, blockers=%, groups=%',r,s->'count',s->'workspace'->'blockers',s->'workspace'->'groups';end if;
 `);checks.push('same-total rejected correction history invalidates resolution, blocks finalization, fresh review appends without deleting history');
scenario('h2h',`
 w:=${workspace};
 if ${call(request(),'a1310000-0000-4000-8000-000000000007')}->>'code' is distinct from 'not_director' then raise exception 'outsider allowed';end if;
 if public.get_qualification_tie_workspace_v1('a1310000-0000-4000-8000-000000000007','${tid}','${eid}')is not null then raise exception 'outsider read';end if;
 if ${call(request('0',pid(1),'head_to_head',`||jsonb_build_object('participantIds',jsonb_build_array('${pid(1)}','${uuid('f999',2)}'))`))}->>'code' is distinct from 'invalid_pair' then raise exception 'foreign participant allowed';end if;
 if public.save_qualification_tie_resolution_v1('${actor}','${tid}','${uuid('1999',1)}','{}','${uuid('0247',200)}')->>'code' is distinct from 'event_unavailable' then raise exception 'foreign event allowed';end if;
 r:=${call("'[]'::jsonb")};s:=${call("'true'::jsonb")};
 if r->>'code' is distinct from 'invalid_request' or s->>'code' is distinct from 'invalid_request' then raise exception 'malformed did not reject: array=%, scalar=%',r,s;end if;
 if has_function_privilege('authenticated','public.save_qualification_tie_resolution_v1(uuid,uuid,uuid,jsonb,uuid)','EXECUTE')or has_function_privilege('service_role','app.qualification_resolved_rankings_v1(uuid,uuid)','EXECUTE')or has_table_privilege('service_role','app.qualification_tie_resolutions_v1','SELECT')then raise exception 'access expanded';end if;
 `);checks.push('unauthorized/cross-event/pair/malformed rejection and service-only RPC/private helper/table ACLs');
scenario('h2h',`
 w:=${workspace};insert into app.event_disputes(id,tournament_id,event_id,canonical_game_id,opened_by_profile_id,summary,open_operation_receipt_id)values('${uuid('d247',1)}','${tid}','${eid}','${uuid('6247',1)}','${actor}','TEST ONLY dispute','c1310000-0000-4000-8000-000000000001');
 insert into app.event_dispute_state_events(dispute_id,tournament_id,event_id,canonical_game_id,transition_sequence,state,actor_profile_id,actor_role,operation_receipt_id)values('${uuid('d247',1)}','${tid}','${eid}','${uuid('6247',1)}',1,'open','${actor}','director','c1310000-0000-4000-8000-000000000001');
 r:=${call(request())};s:=${final()};
 if r->>'code' is distinct from 'dispute_open' or s->>'code' is distinct from 'dispute_open' then raise exception 'dispute bypass: save=%, finalize=%',r,s;end if;
 `);
scenario('h2h',`
 w:=${workspace};${pendingCorrection()}
 r:=${call(request())};s:=${final()};
 if r->>'code' is distinct from 'correction_pending' or s->>'code' is distinct from 'correction_pending' then raise exception 'correction bypass: save=%, finalize=%',r,s;end if;
 `);checks.push('existing dispute and pending correction guards preserved at save and finalization');
// Independent legacy digest oracle, not the new helper recomputed against itself.
scenario('h2hUnique',`
 if jsonb_array_length(${workspace}->'groups') is distinct from 0 then raise exception 'legacy control has ties';end if;
 with totals as (
 select p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),'')) display_name,
 count(l.line_id)::integer verified_games,coalesce(sum(l.game_points),0)::integer game_points,
 count(*)filter(where l.is_winner)::integer games_won,coalesce(sum(l.plus_points),0)::integer plus_points,coalesce(sum(l.minus_points),0)::integer minus_points
 from app.event_participants p left join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 left join app.profiles pr on pr.id=p.profile_id left join lateral(select * from app.current_effective_scorelines('${tid}','${eid}')x where x.participant_id=p.id)l on true
 where p.tournament_id='${tid}' and p.event_id='${eid}' group by p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),''))
 ),ranked as(select totals.*,row_number()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc,id)::integer ordinal,
 rank()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc)::integer numeric_rank,
 count(*)over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied from totals)
 select jsonb_agg(to_jsonb(ranked)order by ordinal)into before_rows from ranked;
 if before_rows is distinct from (select jsonb_agg(to_jsonb(resolved_row)order by ordinal)from app.qualification_resolved_rankings_v1('${tid}','${eid}')resolved_row)then raise exception 'legacy digest row drift';end if;
 old_source:=encode(extensions.digest(convert_to(before_rows::text,'utf8'),'sha256'),'hex');
 r:=${final()};
 s:=(select jsonb_build_object('count',count(*),'digest',min(standings_digest))from app.qualification_result_versions where event_id='${eid}');
 if r->>'status' is distinct from 'qualification_finalized' or (s->>'count')::integer is distinct from 1 or old_source is distinct from s->>'digest' then raise exception 'legacy digest changed: outcome=%, expected=%, actual=%',r,old_source,s;end if;
 `);checks.push('independent raw legacy no-tie JSON/digest oracle equals new persisted digest exactly');
// Complete sixteen-player financial/qualification foundation proves downstream source binding.
const sourceGames=JSON.parse(fs.readFileSync('tests/fixtures/q-review-games.json','utf8')).matches;
const changed=sourceGames.map(x=>({...x}));changed[changed.findIndex(x=>x.winner===1)].margin+=11;
let sixteen=foundation({games:changed});sixteen=sixteen.replace(/select public\.finalize_standard_singles_qualification_v1\([^;]+;/,'');
sql(sixteen);
let w=JSON.parse(sql(`select ${workspace};`));assert.equal(w.groups.length,1);assert.equal(w.groups[0].method,'one_game_playoff');assert.deepEqual(w.groups[0].candidateIds,[pid(1),pid(2)]);
const req={expectedSourceFingerprint:w.sourceFingerprint,participantIds:w.groups[0].candidateIds,winnerId:pid(2),method:'one_game_playoff',reason:'TEST ONLY independent synthetic playoff winner',evidenceReference:'TEST ONLY no actual match'};
assert.equal(JSON.parse(sql('select '+call(quote(JSON.stringify(req)))+';')).status,'qualification_tie_recorded');
assert.equal(JSON.parse(sql('select '+final()+';')).status,'qualification_finalized');
const q=JSON.parse(sql(`select app.q_obligation_sources_v1('${actor}','${tid}');`));assert.ok(!q.blockers.includes('qualification_scores_changed'));assert.ok(q.obligations,'resolved qualification remains valid Q source');
assert.equal(sql('select count(*)from app.qualification_result_rows where tied;'),'0');checks.push('real sixteen-player downstream Q recomputation accepts source-bound resolved qualification, preserves source counts');
// Current migration regression: old unpaid review stays duplicate-safe after a
// real qualification tie resolution. Independent connections, same authorized actor.
const qw=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v1('${actor}','${tid}');`));
assert.deepEqual(qw.blockers,[]);assert.equal(qw.currentVersion,0);
const financialSnapshot=()=>sql(`select jsonb_build_object('payments',(select jsonb_agg(to_jsonb(x)order by id)from app.roster_payment_events x where tournament_id='${tid}'),'allocations',(select jsonb_agg(to_jsonb(x)order by id)from app.q_pool_allocation_versions_v1 x where tournament_id='${tid}'))::text;`);
const moneyBefore=financialSnapshot(),qr={expectedVersion:0,sourceDigest:qw.sourceDigest,reason:'TEST ONLY post-tie unpaid review',reviewed:true};
const reviewCall=(op,r=qr,who=actor,tournament=tid)=>`public.record_q_obligation_review_v1('${who}','${tournament}',${quote(JSON.stringify(r))},'${op}')`;
const qhold=start(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${eid}',0));select 'HELD';select pg_sleep(4);commit;`);await until(()=>qhold.out().includes('HELD'));
const qops=[uuid('b247',1),uuid('b247',2)];
const qruns=qops.map((op,i)=>start(`set application_name='post-tie-q-review-${i}';select ${reviewCall(op)};`));
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('post-tie-q-review-0','post-tie-q-review-1')and wait_event_type='Lock';")==='2');await qhold.done;
const qout=(await Promise.all(qruns.map(r=>r.done))).map(JSON.parse);assert.equal(qout.filter(r=>r.status==='q_obligations_recorded').length,1);assert.equal(qout.filter(r=>r.code==='stale_version').length,1);
const acceptedIndex=qout.findIndex(r=>r.status==='q_obligations_recorded'),qaccepted=qout[acceptedIndex],qop=qops[acceptedIndex];
assert.deepEqual(JSON.parse(sql('select '+reviewCall(qop)+';')),qaccepted);
assert.equal(JSON.parse(sql('select '+reviewCall(qop,{...qr,reason:'changed'})+';')).code,'idempotency_conflict');
assert.equal(JSON.parse(sql('select '+reviewCall(uuid('b247',3),{...qr,expectedVersion:1})+';')).code,'already_reviewed');
assert.equal(JSON.parse(sql(`select public.get_q_obligation_review_reconciliation_v1('${actor}','${tid}','${qop}');`)).result.reviewId,qaccepted.reviewId);
assert.equal(sql(`select count(*)from app.q_obligation_reviews_v1 where tournament_id='${tid}';`),'1');
const savedLiabilities=JSON.parse(sql(`select obligations from app.q_obligation_reviews_v1 where tournament_id='${tid}';`));
assert.deepEqual(savedLiabilities,q.obligations);
const savedAmounts=savedLiabilities.flatMap(p=>p.rows.map(r=>r.amountMinor));
assert.deepEqual(savedAmounts.slice().sort((a,b)=>a-b),[666,667,667,1000]);
assert.equal(savedAmounts.reduce((sum,n)=>sum+n,0),3000);
assert.equal(sql(`select bool_and(status='unpaid')from app.q_obligation_reviews_v1 where tournament_id='${tid}';`),'t');
assert.equal(sql(`select count(*)from app.audit_events where tournament_id='${tid}' and action='q_obligations_recorded_unpaid';`),'1');
assert.equal(financialSnapshot(),moneyBefore);
checks.push('post-tie unpaid Q review: observed overlapping connections, one immutable review/audit, exact replay, different-ID duplicate and changed request blocked, lost-response reconciliation, unchanged receipt/allocation amounts');
// Real overlap: opposing decisions wait on the same event lock; exactly one may append.
const seedRace=seed('manual').replaceAll('1310000','1330000').replaceAll('2430000','2440000').replaceAll('2470000','2480000').replaceAll('@test.invalid','-race@test.invalid');
sql('begin;set role postgres;'+seedRace+'commit;');
const raceActor=actor.replace('1310000','1330000'),raceTid=tid.replace('1310000','1330000'),raceEid=eid.replace('1310000','1330000');
const raceW=JSON.parse(sql(`select public.get_qualification_tie_workspace_v1('${raceActor}','${raceTid}','${raceEid}');`));
function start(q){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',c=>c?reject(Error(err)):resolve(out.trim()));});p.stdin.end(authPrefix+q);return{done,out:()=>out};}
async function until(check){for(let i=0;i<80;i++){if(check())return;await new Promise(r=>setTimeout(r,40));}throw Error('Expected overlap not observed');}
const raceReq={...req,expectedSourceFingerprint:raceW.sourceFingerprint,participantIds:raceW.groups[0].candidateIds,winnerId:raceW.groups[0].candidateIds[0]};
const held=start(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${raceEid}',0));select 'HELD';select pg_sleep(4);commit;`);await until(()=>held.out().includes('HELD'));
const raceCall=(r,n)=>`public.save_qualification_tie_resolution_v1('${raceActor}','${raceTid}','${raceEid}',${quote(JSON.stringify(r))},'${uuid('d247',n)}')`;
const a=start(`set application_name='qualification-race-a';select ${raceCall(raceReq,10)};`),b=start(`set application_name='qualification-race-b';select ${raceCall({...raceReq,winnerId:raceReq.participantIds[1]},11)};`);
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('qualification-race-a','qualification-race-b')and wait_event_type='Lock';")==='2');await held.done;
const opposed=(await Promise.all([a.done,b.done])).map(JSON.parse);assert.equal(opposed.filter(x=>x.status==='qualification_tie_recorded').length,1);assert.equal(opposed.filter(x=>x.code==='resolution_already_recorded').length,1);
assert.equal(sql(`select count(*)from app.qualification_tie_resolutions_v1 where event_id='${raceEid}';`),'1');
checks.push('observed two overlapping opposing decision transactions, one immutable winner and one structured rejection');
const lastGroup=JSON.parse(sql(`select public.get_qualification_tie_workspace_v1('${raceActor}','${raceTid}','${raceEid}');`)).groups[1];
const lastReq={...raceReq,participantIds:lastGroup.candidateIds,winnerId:lastGroup.candidateIds[1]};
const heldFinal=start(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${raceEid}',0));select 'HELD';select pg_sleep(4);commit;`);await until(()=>heldFinal.out().includes('HELD'));
const saveLast=start(`set application_name='qualification-final-race-save';select ${raceCall(lastReq,12)};`);
const finalizeLast=start(`set application_name='qualification-final-race-final';select public.finalize_standard_singles_qualification_v1('${raceActor}','${raceTid}','${raceEid}','${uuid('9247',900)}');`);
await until(()=>sql("select count(*)from pg_stat_activity where application_name in('qualification-final-race-save','qualification-final-race-final')and wait_event_type='Lock';")==='2');await heldFinal.done;
const finalOverlap=(await Promise.all([saveLast.done,finalizeLast.done])).map(JSON.parse);assert.equal(finalOverlap[0].status,'qualification_tie_recorded');
assert.ok(finalOverlap[1].status==='qualification_finalized'||finalOverlap[1].code==='ranking_tie_unresolved');
if(finalOverlap[1].status!=='qualification_finalized')assert.equal(JSON.parse(sql(`select public.finalize_standard_singles_qualification_v1('${raceActor}','${raceTid}','${raceEid}','${uuid('9247',901)}');`)).status,'qualification_finalized');
assert.equal(sql(`select count(*)from app.qualification_result_versions where event_id='${raceEid}';`),'1');
checks.push('observed final resolution/finalization overlap serializes, unresolved snapshot never finalizes, exactly one result');
// Receipt replay is not an authority grant after role removal.
sql(`delete from app.tournament_roles where tournament_id='${raceTid}' and profile_id='${raceActor}' and role='director';`);
const winnerResult=opposed.find(x=>x.status==='qualification_tie_recorded');
assert.equal(JSON.parse(sql(`select ${raceCall({...raceReq,winnerId:winnerResult.winnerId},winnerResult.winnerId===raceReq.winnerId?10:11)};`)).code,'not_director');
checks.push('revoked director cannot retrieve accepted write replay');
assert.equal(sql(`select coalesce(public.get_qualification_tie_reconciliation_v1('${raceActor}','${raceTid}','${raceEid}','${uuid('d247',winnerResult.winnerId===raceReq.winnerId?10:11)}',${quote(JSON.stringify({...raceReq,winnerId:winnerResult.winnerId}))})::text,'NULL');`),'NULL');
checks.push('revoked director cannot reconcile accepted receipt');

fs.writeFileSync('test-results/qualification-tie-sql-result.json',JSON.stringify({checks,opposed,finalOverlap},null,2));console.log(JSON.stringify({checks}));
