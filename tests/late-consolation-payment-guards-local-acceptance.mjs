// Focused local money guards; no qualifying games are replayed.
import assert from'node:assert/strict';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export async function verifyLateConGuards({q,read,actorId,outsiderId,tournamentId,nextOperationId,withPause,writeEvidence=()=>{},prepaid=false}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');const service=sql=>owner(`set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actorId}';set request.jwt.claims='{"role":"service_role","sub":"${actorId}"}';${sql}`);
 const before=owner(`select jsonb_agg(to_jsonb(p)order by roster_entry_id,version)from app.roster_payment_events p where tournament_id='${tournamentId}';`);
 assert.equal(owner(`select to_jsonb(app.consy_addon_payments_enabled_v1());`),false);
 assert.deepEqual(owner(`select jsonb_build_object('tables',(select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relname in('consy_addon_payment_scopes_v1','consy_addon_receipts_v1')and c.relrowsecurity and c.relforcerowsecurity),'execute',has_function_privilege('authenticated','app.record_consy_addon_receipt_v1(uuid,uuid,uuid,jsonb)','EXECUTE'),'select',has_table_privilege('authenticated','app.consy_addon_receipts_v1','SELECT'));`),{tables:2,execute:false,select:false});
 for(const role of ['anon','authenticated','service_role'])for(const signature of ['app.open_consy_addon_scope_v1(uuid,uuid,jsonb)','app.record_consy_addon_receipt_v1(uuid,uuid,uuid,jsonb)','app.get_consy_addon_operation_v1(uuid,uuid,uuid)','app.get_consy_addon_workspace_v1(uuid,uuid)'])assert.equal(owner(`select to_jsonb(has_function_privilege('${role}','${signature}','EXECUTE'));`),false);
 const gates=['consy_addon_payments','linked_consy_native_losses','event_settings_operational_activation'];const original=gates.map(n=>owner(`select to_jsonb(pg_get_functiondef('app.${n}_enabled_v1()'::regprocedure));`));
 try{
 q(gates.map(n=>`create or replace function app.${n}_enabled_v1()returns boolean language sql stable set search_path=''as $$select true$$;alter function app.${n}_enabled_v1()owner to postgres;revoke all on function app.${n}_enabled_v1()from public,anon,authenticated,service_role;`).join('\n'));
 const binding=owner(`select jsonb_build_object('eventId',b.event_id,'activationId',b.id,'setupEventVersionId',b.setup_event_version_id)from app.tournament_setup_activations b join app.events e on e.id=b.event_id where b.tournament_id='${tournamentId}'and e.event_type='consolation';`);const {eventId,...pins}=binding;
 const scopeReq={kind:'consy-addon-scope-v1',operationId:nextOperationId(),...pins,confirmed:true};
 const roster=owner(`select jsonb_agg(jsonb_build_object('id',p.roster_entry_id,'decision',app.linked_consy_eligibility_v1('${tournamentId}','${eventId}',p.roster_entry_id))order by split_part(p.table_seat,'-',2)::integer)from app.event_participants p join app.events e on e.id=p.event_id where p.tournament_id='${tournamentId}'and e.event_type='main';`).filter(x=>x.decision.status==='eligible').map(x=>x.id);assert.equal(roster.length,16);
 const enrollment=service(`select public.enroll_roster_entries_in_event_v3('${actorId}','${tournamentId}','${eventId}',${literal(roster)},'${nextOperationId()}');`);assert.equal(enrollment.status,'event_participants_enrolled');
 assert.equal(owner(`select app.open_consy_addon_scope_v1('${tournamentId}','${eventId}',${literal(scopeReq)});`).status,'scope_opened');
 const get=(id)=>owner(`select app.get_consy_addon_receipt_source_v1('${tournamentId}','${eventId}','${id}');`);
 const request=(id,source)=>({kind:'consy-addon-receipt-v1',operationId:nextOperationId(),rosterEntryId:id,sourceDigest:source.sourceDigest??'0'.repeat(64),amountMinor:1000,currency:'USD',paymentMethod:'cash',receivedAt:new Date(Date.now()-1000).toISOString(),note:'TEST ONLY late Con guard fixture, no actual money',confirmed:true});
 const call=(id,req)=>`select app.record_consy_addon_receipt_v1('${tournamentId}','${eventId}','${id}',${literal(req)});`;
 if(prepaid){
  assert.equal(owner(`select to_jsonb(count(*))from app.event_participants where event_id='${eventId}'and app.event_qr_player_is_paid_and_enrolled('${tournamentId}',event_id,roster_entry_id);`),16);
  const src=get(roster[0]);assert.equal(src.status,'prepaid_recorded');assert.equal(owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`).status,'source_available');assert.equal(owner(call(roster[0],request(roster[0],src))).code,'already_funded_prepaid');
  assert.equal(owner(`select to_jsonb(count(*))from app.consy_addon_receipts_v1;`),0);
 }else{
  const initial=get(roster[0]);assert.equal(initial.status,'source_available');
  const current=owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`),head=owner(`select jsonb_build_object('id',id,'parts',request_payload->'allocations')from app.native_ledger_allocation_revisions_v1 where tournament_id='${tournamentId}'order by version desc limit 1;`);
  const badParts=structuredClone(head.parts);for(const rosterId of roster){const physical=current.facts.receiptEvents.find(r=>r.rosterEntryId===rosterId),base=badParts.find(x=>x.sourceId===physical.sourceId);base.allocations=[{eventId:initial.source.mainEventId,bucket:'regular_entry',poolId:null,amountMinor:2000,classificationReviewed:true},{eventId,bucket:'regular_entry',poolId:null,amountMinor:1000,classificationReviewed:true}];}
  const wrong={kind:'native-ledger-allocation-v1',operationId:nextOperationId(),expectedRevisionId:head.id,sourceDigest:current.sourceDigest,allocations:badParts,reason:'TEST ONLY prove legacy Main reclassification is not actual Con prepayment',reviewed:true};
  const moved=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(wrong)});`);assert.equal(moved.status,'accepted');
  assert.equal(owner(`select to_jsonb(app.event_qr_player_is_paid_and_enrolled('${tournamentId}','${eventId}','${roster[0]}'));`),false);assert.equal(get(roster[0]).code,'main_only_classification_required');assert.equal(owner(`select app.operational_event_finance_source_v1_before_consy_addon('${tournamentId}','${eventId}','${actorId}');`).status,'source_available');const protectedFinance=owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);assert.equal(protectedFinance.status,'blocked');assert.equal(protectedFinance.code,'consy_event_payment_unverified');writeEvidence('late-con-finance-bypass-rejected.json',{all16LegacyPartsCon1000:true,legacyDelegateAvailable:true,protectedFinance});
  const restored=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal({...wrong,operationId:nextOperationId(),expectedRevisionId:moved.revisionId,allocations:head.parts,reason:'TEST ONLY restore original full Main classification before addon'})});`);assert.equal(restored.status,'accepted');
  const src=get(roster[0]),req=request(roster[0],src);assert.equal(src.status,'source_available');
  assert.throws(()=>owner(call(roster[0],req),outsiderId),/consy_addon_not_director/);assert.equal(owner(`select app.get_consy_addon_operation_v1('${tournamentId}','${eventId}','${req.operationId}');`),null);
  q(`create function app.fixture_fail_addon()returns trigger language plpgsql as $$begin raise exception 'fixture_post_nonce_failure';end$$;create trigger zz_fixture_fail_addon before insert on app.consy_addon_receipts_v1 for each row execute function app.fixture_fail_addon();`);
  try{assert.throws(()=>owner(call(roster[0],req)),/fixture_post_nonce_failure/);}finally{q('drop trigger zz_fixture_fail_addon on app.consy_addon_receipts_v1;drop function app.fixture_fail_addon();');}
  assert.equal(owner(`select app.get_consy_addon_operation_v1('${tournamentId}','${eventId}','${req.operationId}');`),null);assert.equal(owner(`select to_jsonb(count(*))from app.consy_addon_receipts_v1;`),0);
  assert.equal(owner(call(roster[0],req)).status,'consolation_addon_recorded');
  q(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tournamentId}','${outsiderId}','co_director');`);
  const next=get(roster[1]),a=request(roster[1],next),b={...a,operationId:nextOperationId()};
  const race=await withPause(call(roster[1],a),()=>owner(call(roster[1],b),outsiderId));assert.equal(race.first.status,'consolation_addon_recorded');assert.equal(race.second.status,'retry_exact');
  assert.equal(owner(call(roster[1],b),outsiderId).code,'already_recorded');assert.equal(owner(`select to_jsonb(count(*))from app.consy_addon_receipts_v1 where roster_entry_id='${roster[1]}';`),1);
  writeEvidence('late-con-race-rollback.json',{rollbackNonceRecovered:true,race,retryRejected:true});
 }
 assert.deepEqual(owner(`select jsonb_agg(to_jsonb(p)order by roster_entry_id,version)from app.roster_payment_events p where tournament_id='${tournamentId}';`),before);
 return{passed:true,prepaid,defaultOff:true,privateAclForcedRls:true,unchangedMainReceipts:true,rollback:!prepaid,competingWriters:!prepaid};
 }finally{q(original.join(';\n'));}
}
