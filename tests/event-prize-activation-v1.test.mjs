import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {newEventPlayoffParametersDraftV1,resolveEventSeriesDraftV1,resolveEventPlayoffParametersDraftV1} from '../src/lib/playoffs/event-playoff-parameters-v1.ts';
import {newPlayoffPrizePlanDraftV2} from '../src/lib/playoffs/playoff-prize-plan-v2.ts';
import {readEventPrizeActivationSourceV1,buildEventPrizeActivationV1,isEventPrizeActivationV1,serializeEventPrizeActivationV1,parseEventPrizeActivationV1,eventPrizeActivationRequestHashV1,readEventPrizeActivationRecordV1,eventPrizeActivationEnabledV1} from '../src/lib/api/event-prize-activation-v1.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1),tid=id(2);
function source(){
 const events=[{eventClientRowId:id(10),eventKind:'main'},{eventClientRowId:id(11),eventKind:'consolation'}],settings=events.map(e=>({eventClientRowId:e.eventClientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(e.eventKind)}));
 for(const s of settings){s.draft.payoutMode='one-in';s.draft.oneInText='unfinished';s.draft.incrementFactorText='dormant';}
 const snapshot={kind:'event-settings-snapshot-v3',tournamentId:tid,setupRevisionId:id(3),setupVersion:2,settings};
 const workspace={kind:'event-prize-workspace-v1',actorId:actor,tournamentId:tid,base:{tournamentId:tid,setupRevisionId:id(3),setupVersion:2,sourceDigest:'a'.repeat(64)},events,settings:{state:'present',historyExists:true,id:id(4),digest:'b'.repeat(64),snapshot},prizes:{state:'present',historyExists:true,snapshot:{kind:'event-prize-settings-snapshot-v1',tournamentId:tid,setupRevisionId:id(3),setupVersion:2,settingsSnapshotId:id(4),settingsDigest:'b'.repeat(64),prizeSnapshotId:id(5),prizeDigest:'c'.repeat(64),plans:events.map(e=>({...e,mode:'proposed_v2',draft:newPlayoffPrizePlanDraftV2()})),activationAllowed:false,accountingAllowed:false,moneyMoved:false}},activationAllowed:false,accountingAllowed:false,moneyMoved:false};
 const configuredRows=events.map((e,i)=>({...e,setupEventVersionId:id(20+i),draft:structuredClone(settings[i].draft)}));
 const activationSource={kind:'event-settings-activation-source-v4',status:'source_available',actorId:actor,tournamentId:tid,setupRevisionId:id(3),setupVersion:2,settingsSnapshotId:id(4),settingsDigest:'d'.repeat(64),associationHash:'e'.repeat(64),snapshot:structuredClone(snapshot),configuredRows,legacyDeclarationRequiredRows:[],legacyDeclarationPins:[],legacyDeclarationsCurrent:true,perEventContextReviewRequired:true,activationAllowed:false,moneyMoved:false};
 const reviews=events.map((e,i)=>({eventClientRowId:e.eventClientRowId,reviewId:id(30+i),draftDigest:String(i+1).repeat(64),reviewedDraft:structuredClone(settings[i].draft),current:true,context:{sanctioned:false,eventKind:e.eventKind,durationDays:1,originalEntrants:null}}));
 return{kind:'event-prize-activation-source-v1',actorId:actor,tournamentId:tid,workspace,activationSource,reviews,registrationOnly:true,accountingAllowed:false,playoffStartAllowed:false,moneyMoved:false};
}
test('series-only resolution preserves invalid dormant legacy payout and remains independent of V1 resolution',()=>{
 const d=newEventPlayoffParametersDraftV1('main');d.incrementFactorText='unfinished';d.payoutMode='one-in';d.oneInText='';const before=JSON.stringify(d);
 assert(resolveEventSeriesDraftV1(d));assert.equal(resolveEventPlayoffParametersDraftV1(d),null);assert.equal(JSON.stringify(d),before);d.finalMode='separate';d.series.final.choice='custom';assert.equal(resolveEventSeriesDraftV1(d),null);
});
test('current source builds exact outer pins while keeping save hash and activation digest domains distinct',async()=>{
 const s=source(),before=JSON.stringify(s);assert(readEventPrizeActivationSourceV1(s,actor,tid));const e=buildEventPrizeActivationV1(s,id(40));assert(e);assert.equal(e.activation.settingsDigest,'d'.repeat(64));assert.notEqual(e.activation.settingsDigest,s.workspace.prizes.snapshot.settingsDigest);assert.equal(e.prizeDigest,'c'.repeat(64));const raw=serializeEventPrizeActivationV1(e);assert(raw);assert.deepEqual(parseEventPrizeActivationV1(raw),e);assert(Object.isFrozen(parseEventPrizeActivationV1(raw).activation.settingsPins));assert.equal(await eventPrizeActivationRequestHashV1(e),crypto.createHash('sha256').update(raw).digest('hex'));assert.equal(JSON.stringify(s),before);assert.equal(eventPrizeActivationEnabledV1(),false);
});
test('all four complete raw prize methods permit registration review without authorizing accounting or playoff play',()=>{
 for(const method of['graduated','equal','winner-multiplier','winner-takes-all']){const s=source();for(const p of s.workspace.prizes.snapshot.plans){p.draft.method=method;p.draft.rounding={regular:'1',qPool:'10',sidePool:'5'};}const read=readEventPrizeActivationSourceV1(s,actor,tid);assert(read);assert.equal(read.accountingAllowed,false);assert.equal(read.playoffStartAllowed,false);assert.equal(read.moneyMoved,false);assert(buildEventPrizeActivationV1(s,id(40)));}
});
test('mixed plans, stale reviews, unknown fields and malformed source pins fail closed',()=>{
 for(const change of[s=>s.workspace.prizes.snapshot.plans[0]={eventClientRowId:id(10),eventKind:'main',mode:'legacy_checks_required'},s=>s.workspace.settings.snapshot.settings[0]={eventClientRowId:id(10),mode:'legacy_checks_required'},s=>s.reviews[0].reviewId='bad',s=>s.reviews[0].reviewedDraft.finalMode='separate',s=>s.reviews[0].context.eventKind='consolation',s=>s.reviews[0].context.originalEntrants=17,s=>s.activationSource.settingsSnapshotId=id(99),s=>s.activationSource.configuredRows=[],s=>s.workspace.prizes.snapshot.plans[0].draft.incrementFactorText='',s=>s.activationSource.legacyDeclarationRequiredRows=[id(10)],s=>s.accountingAllowed=true]){const s=source();change(s);assert.equal(readEventPrizeActivationSourceV1(s,actor,tid),null);}
 assert.equal(readEventPrizeActivationSourceV1(source(),id(99),tid),null);assert.equal(readEventPrizeActivationSourceV1(source(),actor,id(99)),null);
 const s=source();s.reviews[0].context={sanctioned:true,eventKind:'main',durationDays:1,originalEntrants:null};s.reviews[0].reviewedDraft.series.regular.choice='2-of-3';s.workspace.settings.snapshot.settings[0].draft.series.regular.choice='2-of-3';s.activationSource.snapshot.settings[0].draft.series.regular.choice='2-of-3';s.activationSource.configuredRows[0].draft.series.regular.choice='2-of-3';assert.equal(readEventPrizeActivationSourceV1(s,actor,tid),null);
});
test('outer codec rejects mutations and retains the exact V4 request without manufactured legacy pins',async()=>{
 const e=buildEventPrizeActivationV1(source(),id(40)),raw=serializeEventPrizeActivationV1(e),hash=await eventPrizeActivationRequestHashV1(e);
 for(const change of[x=>x.prizeDigest='f'.repeat(64),x=>x.prizeSnapshotId=id(99),x=>x.activation.settingsPins[0].reviewId=id(99)]){const x=structuredClone(e);change(x);assert.notEqual(await eventPrizeActivationRequestHashV1(x),hash);}
 for(const change of[x=>x.confirmedContext=false,x=>x.activation.request.declarationPins=[],x=>x.extra=true,x=>x.activation.request.idempotencyKey='invalid']){const x=structuredClone(e);change(x);assert.equal(isEventPrizeActivationV1(x),false);}
 assert.equal(parseEventPrizeActivationV1(raw+' '),null);let calls=0;const bad=structuredClone(e);Object.defineProperty(bad,'activation',{enumerable:true,get(){calls++;throw Error();}});assert.equal(serializeEventPrizeActivationV1(bad),null);assert.equal(calls,0);
});
test('owned immutable records bind complete outer request, expected hash, inner preparation and registration receipt',async()=>{
 const e=buildEventPrizeActivationV1(source(),id(40)),raw=serializeEventPrizeActivationV1(e),hash=await eventPrizeActivationRequestHashV1(e);
 const inner={...structuredClone(e.activation),kind:'event-settings-activation-intent-v1',confirmedContext:true};
 const preparation={status:'activation_intent_prepared',actorId:actor,tournamentId:tid,operationId:id(40),request:inner,activationAllowed:false,operationalActivationPerformed:false,officialApprovalClaimed:false,moneyMoved:false};
 const record={kind:'event-prize-activation-record-v1',actorId:actor,tournamentId:tid,operationId:id(40),requestText:raw,requestHash:hash,envelope:e,preparation,activation:null,registrationOnly:true,accountingAllowed:false,playoffStartAllowed:false,moneyMoved:false};assert(readEventPrizeActivationRecordV1(record,actor,tid,raw,hash));
 const native={status:'tournament_setup_activated',setupRevisionId:id(3),setupVersion:2,eventCount:2,events:['main','consolation'].map((eventType,i)=>({activationId:id(50+i),setupEventVersionId:id(20+i),rulesetVersionId:id(60+i),eventId:id(70+i),eventType,name:'Fictional '+eventType,format:'standard_singles',scoringMethod:'digital',gameCount:12})),registrationState:'open'};for(const k of['roundsCreated','participantsEnrolled','seatingUpdated','financeUpdated','resultsUpdated','payoutsCalculated','qualifiersCalculated','accSubmissionCreated'])native[k]=false;
 record.activation={status:'event_settings_operationally_activated',actorId:actor,tournamentId:tid,operationId:id(40),request:inner,officialApprovalClaimed:false,moneyMoved:false,operationalActivationPerformed:true,settingsSnapshotId:id(4),setupRevisionId:id(3),setupVersion:2,activationCount:2,bindingCount:2,result:{status:'linked_setup_activated',associationHash:e.activation.associationHash,result:native}};assert(readEventPrizeActivationRecordV1(record,actor,tid,raw,hash));
 for(const change of[x=>x.actorId=id(99),x=>x.requestHash='f'.repeat(64),x=>x.preparation.request.settingsDigest='f'.repeat(64),x=>x.activation.result.result.registrationState='closed',x=>x.activation.moneyMoved=true,x=>x.accountingAllowed=true]){const x=structuredClone(record);change(x);assert.equal(readEventPrizeActivationRecordV1(x,actor,tid,raw,hash),null);}
});
const sql=fs.readFileSync('database/proposals/event-prize-activation-source-v1.sql','utf8');
test('all install-time patch anchors match current unfrozen prerequisite sources exactly once',()=>{
 const prerequisites=['event-settings-activation-guard-v1.sql','event-settings-operational-activation-v1.sql','operational-event-finance-proposals-v1.sql','event-settings-playoff-gate-v1.sql'].map(f=>fs.readFileSync('database/proposals/'+f,'utf8')).join('\n');const registry=new Map();let count=0;
 for(const m of sql.matchAll(/select app\.install_event_prize_patch_v1\('([^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'(?:,\s*'([^']+)')?\);/g)){
  const[,signature,a,b,newName]=m,old=a.replaceAll("''","'"),replacement=b.replaceAll("''","'");let definition=registry.get(signature);
  if(!definition){const name=signature.split('(')[0],start=prerequisites.indexOf('create function '+name+'(');assert(start>=0,signature);const end=prerequisites.indexOf('$$;',start);assert(end>start);definition=prerequisites.slice(start,end+3);}
  assert.equal(definition.split(old).length,2,signature+' anchor');definition=definition.replace(old,replacement);const destination=newName?newName+signature.slice(signature.indexOf('(')):signature;registry.set(destination,definition);count++;
 }
 assert(count>=12,'all patch statements parsed');assert.match(registry.get('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)'),/event_kind in\('main','consolation'\)order by client_row_id/);
});
test('private SQL preserves explicit authority, role locks, raw outer hash, immutable FK pins and independent recovery',()=>{
 assert.doesNotMatch(sql,/^\s*grant\s/im);assert.doesNotMatch(sql,/set_config\(|request\.jwt|set role/i);assert.match(sql,/deferrable initially deferred/);assert.match(sql,/references app\.event_settings_activation_intents_v1/);assert.match(sql,/for share nowait/);assert.match(sql,/coalesce\(auth\.role\(\),''\)<>'service_role'/);assert.doesNotMatch(sql,/alter table app\.event_settings_operational_bindings_v1/);
 for(const token of['new_prize_accounting_required','new_prize_playoff_integration_required','event_settings_operational_proof_prize_legacy_v1','event_prize_activation_recovery_enabled_v1','prize_source_changed'])assert(sql.includes(token),token);
 const recovery=sql.slice(sql.indexOf('create function app.get_event_prize_activation_operation_v1'),sql.indexOf('create function public.get_event_prize_activation_source_provider_v1'));
 assert.doesNotMatch(recovery,/event_prize_activation_current_v1|event_prize_activation_write_enabled_v1|\binsert\b|\bupdate\b/i);
});
test('source contention propagates to retry instead of being mistaken for a missing policy pin',()=>{
 const current=sql.slice(sql.indexOf('create function app.event_prize_activation_current_v1'),sql.indexOf('-- Create a real series-only'));
 assert.doesNotMatch(current,/exception when lock_not_available then return null/);assert.match(current,/lock table app\.event_prize_heads_v1,app\.event_prize_snapshots_v1 in share mode nowait/);
 const proof=sql.slice(sql.indexOf('create or replace function app.event_settings_operational_proof_v1'),sql.indexOf('-- Bind each Main/Con'));
 assert.match(proof,/exception when lock_not_available then return jsonb_build_object\('status','retry_exact','code','source_busy'\)/);
 const original=fs.readFileSync('database/proposals/event-settings-operational-activation-v1.sql','utf8');assert(original.indexOf("if proof->>'code'in('source_busy','isolation_not_supported')")<original.indexOf('insert into app.event_settings_operational_attempts_v1(actor_id'));
});
test('inner intent removes the JSONB kind key after extracting activation, without ambiguous unknown operators',()=>{
 assert.match(sql,/select\(\(v->'activation'\)-'kind'\)\|\|jsonb_build_object/);assert.doesNotMatch(sql,/v->'activation'-'kind'/);
});
test('actual native activation insert is guarded by proposed V2 policy even when series remains legacy',()=>{
 const guard=sql.slice(sql.indexOf('create function app.require_event_prize_native_activation_v1'),sql.indexOf('-- Existing writer remains the writer'));
 assert.match(guard,/before insert on app\.tournament_setup_activations/);assert.match(guard,/e\.client_row_id::text and x->>'eventKind'=e\.event_kind and x->>'mode'='proposed_v2'/);assert.match(guard,/p->>'setupRevisionId'is distinct from new\.setup_revision_id::text/);assert.match(guard,/app\.event_settings_operational_guarded_shared_v1/);assert.doesNotMatch(guard,/effective_settings|configured/);
});
