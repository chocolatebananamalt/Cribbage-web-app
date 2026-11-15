import assert from 'node:assert/strict';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
/** Caller owns fictional disposable DB, installer and cleanup. No provider or
 * sporting evidence is fabricated to make an unavailable estimate look ready. */
export async function acceptPlayoffPrizeNativeLocalV2({sql,call,withHeldLock,actorId,tournamentId,otherId,nextId,writeEvidence=()=>{}}){
 const checks=[],tid=tournamentId;const checkpoint=label=>{checks.push(label);writeEvidence([...checks]);};
 const eid=await sql(`select event_id from app.event_settings_operational_bindings_v1 where tournament_id='${tid}'order by event_id limit 1;`);assert(eid);
 for(const role of['anon','authenticated','service_role'])assert.equal(await sql(`select has_function_privilege('${role}','app.get_playoff_prize_native_source_v2(uuid,uuid)','EXECUTE');`),'f');
 assert.equal((await call(`select app.get_playoff_prize_native_source_v2('${tid}','${eid}');`))?.code,'feature_disabled');checkpoint('native estimate getter has closed grants and disabled flag');
 await sql(`set role postgres;create or replace function app.playoff_prize_native_source_enabled_v2()returns boolean language sql immutable set search_path=''as $$select true$$;`);
 assert.equal(await call(`select app.get_playoff_prize_native_source_v2('${tid}','${eid}');`,otherId),null);checkpoint('native estimate source rejects outsider without disclosure');
 let result=await call(`select app.get_playoff_prize_native_source_v2('${tid}','${eid}');`);assert.equal(result?.code,'current_native_allocation_required',JSON.stringify(result));checkpoint('actual three-event activation/prize binding joins reach authoritative native allocation gate');
 const native=await call(`select app.get_native_event_ledger_sources_v1('${tid}');`);assert.equal(native?.status,'sources_available',JSON.stringify(native));assert.deepEqual(native.facts.receiptEvents,[]);assert.deepEqual(native.facts.expenseEvents,[]);
 const request={kind:'native-ledger-allocation-v1',operationId:nextId(),expectedRevisionId:null,sourceDigest:native.sourceDigest,allocations:[],reason:'Fictional empty native allocation for read-gate verification',reviewed:true};
 const saved=await call(`select app.save_native_ledger_allocation_v1('${tid}',${literal(JSON.stringify(request))}::jsonb);`);assert.equal(saved?.status,'accepted',JSON.stringify(saved));
 result=await call(`select app.get_playoff_prize_native_source_v2('${tid}','${eid}');`);assert.equal(result?.code,'current_qualification_required',JSON.stringify(result));checkpoint('normal empty native allocation save is read back; missing qualification remains blocked without fabricated evidence');
 if(withHeldLock){await withHeldLock('lock table app.event_prize_policy_activation_pins_v1 in row exclusive mode;',async()=>{const r=await call(`select app.get_playoff_prize_native_source_v2('${tid}','${eid}');`);assert.equal(r?.status,'retry_exact',JSON.stringify(r));assert.equal(r?.code,'source_busy');});checkpoint('held new prize pin lock remains retryable source_busy');}
 const raw=await sql(`begin;set role postgres;set request.jwt.claim.sub='${actorId}';delete from app.event_prize_heads_v1 where tournament_id='${tid}';select app.get_playoff_prize_native_source_v2('${tid}','${eid}')::text;rollback;`);assert.equal(JSON.parse(raw.split('\n').filter(Boolean).at(-1)).code,'native_prize_binding_changed');checkpoint('lost current prize head rejects native read and rolled-back probe preserves original');
 assert.equal((await call(`select app.operational_event_finance_source_v1('${tid}','${eid}','${actorId}');`))?.code,'new_prize_accounting_required');checkpoint('existing native Finance/finalization guard still rejects V2');
 return{checks,positiveNativeBasisVerified:false,qualificationUnavailable:true,providerSessionVerified:false,payoutAuthorized:false,moneyMoved:false};
}
