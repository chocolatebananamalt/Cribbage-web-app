import{verifyPilotDrawReservationCases}from'./helpers/native-mixed-draw-reservation-cases-local.mjs';
// Frozen local fictional acceptance. No hosted API, credential or network.
import fs from'node:fs';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{spawnSync}from'node:child_process';
import{dir,actor,checker,tid,sql,read,json,quote,claims,state,inspect}from'./helpers/native-mixed-pilot-prepguard-acceptance-db.mjs';
import{createNativeMixedPilotDirectorHandlersV1}from'../src/lib/api/native-mixed-pilot-director-handlers-v1.ts';
import{createNativeMixedPreparationHandlersV1}from'../src/lib/api/native-mixed-pilot-preparation-handlers-v1.ts';
import{createNativeMixedDirectorHttpV1}from'../src/lib/api/native-mixed-director-http-v1.ts';
import{NativeMixedDirectorSessionV1}from'../src/lib/seating/native-mixed-director-session-v1.ts';
import{readNativeMixedPreparationV1,authorNativeMixedPreparationOperationV1}from'../src/lib/seating/native-mixed-pilot-preparation-v1.ts';
import{verifyCompatibility}from'./helpers/native-mixed-populated-compatibility-local.mjs';
const flow=JSON.parse(fs.readFileSync(dir+'/flow-results.json')),cache=JSON.parse(fs.readFileSync(dir+'/scoring-results.json')),eid=JSON.parse(fs.readFileSync(dir+'/activation-result.json')).binding.eventId,ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`,session=cache.sessionIds[actor],checks=[];
const persist=()=>{fs.writeFileSync(dir+'/flow-results.json',JSON.stringify(flow,null,2));fs.writeFileSync(dir+'/scoring-results.json',JSON.stringify(cache,null,2));};
for(const file of['native-mixed-pilot-confinement-v1.sql','native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql'])sql('set role postgres;'+fs.readFileSync('database/proposals/'+file,'utf8'));
sql(`set role postgres;select app.authorize_native_mixed_pilot_deployment_v1('${ref}','APPROVED FICTIONAL LOCAL TEST ONLY');select app.record_native_mixed_pilot_scope_v1('${tid}','${eid}',array[${Object.keys(cache.sessionIds).map(quote).join(',')}]::uuid[],0,true,clock_timestamp()+interval'1 hour','APPROVED FICTIONAL LOCAL TEST ONLY','${randomUUID()}');`);
const gateNames=['native_mixed_admission_enabled_v1','native_mixed_funding_enabled_v1','native_mixed_attendance_enabled_v1','native_mixed_attendance_consent_transport_enabled_v1','native_mixed_simulation_publication_enabled_v1','native_mixed_simulation_recovery_enabled_v1','native_mixed_simulation_transition_enabled_v1','native_mixed_simulation_start_enabled_v1','native_mixed_simulation_start_recovery_enabled_v1','native_mixed_game_writer_enabled_v1','native_mixed_game_transport_enabled_v1','native_mixed_game_recovery_enabled_v1'],originals=gateNames.map(n=>read(`select to_jsonb(pg_get_functiondef('app.${n}()'::regprocedure));`));
const signatures=['public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)','public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)','public.get_native_mixed_pilot_preparation_v1(uuid,uuid,uuid,uuid)'];

try{
 sql('set role postgres;'+originals.map(d=>d.replace('select false','select true').replace('SELECT false','SELECT true')).join(';')+';'+signatures.map((s,i)=>`grant execute on function ${s}to ${i===0?'authenticated':'service_role'};`).join(''));
 const call=`select public.get_native_mixed_pilot_preparation_v1('${actor}','${session}','${tid}','${eid}');`,fresh=()=>read(claims(actor)+call);
 assert.equal(fresh().phase,'plan');
 const blocked=read(`begin;set role postgres;insert into app.rounds(tournament_id,event_id,round_number)values('${tid}','${eid}',1);`+claims(actor)+call+'reset role;rollback;');
 assert.equal(blocked.status,'blocked');assert.equal(blocked.code,'existing_attempt_requires_recovery');assert.equal(fresh().phase,'plan');
 verifyCompatibility(sql,dir,true);fs.writeFileSync(dir+'/guard-runtime-results.json',JSON.stringify({currentSqlSha256:(await import('node:crypto')).createHash('sha256').update(fs.readFileSync('database/proposals/native-mixed-pilot-preparation-v1.sql')).digest('hex'),freshPlan:true,ordinaryRoundBlocksFreshPlan:true,rollbackRestoresFreshPlan:true,populatedPreservation:true,hosted:false},null,2));console.log('PASS current preparation SQL: fresh plan, ordinary round blocks, rollback restores source, populated preservation');
}finally{sql('set role postgres;'+originals.join(';')+';'+signatures.map(s=>`revoke all on function ${s}from authenticated,service_role;`).join(''));}