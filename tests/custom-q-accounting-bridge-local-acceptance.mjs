// LOCAL Q-only fixture helpers. The runtime lead owns the disposable database
// lifecycle and must install the reviewed proposal before calling these. A
// tournament containing any Side pool remains outside V6 final accounting.
import assert from 'node:assert/strict';
import {calculateCustomGraduatedAmountsV3}from'../src/lib/results/custom-graduated-amounts-v3.ts';
import {isQCustomPolicyRequestV5}from'../src/lib/api/q-custom-policy-v5.ts';
import {createCustomPayoutIntentV1}from'../src/lib/api/custom-payout-intent-v1.ts';
import {foundationV2}from'./fixtures/q-v2-foundation.mjs';
import {qSetupPrizeWorkspace}from'./fixtures/q-setup-prize-workspace.mjs';
import {actor as fixtureActor,tid as fixtureTournamentId,eid as fixtureEventId,uuid}from'./fixtures/q-review-foundation.mjs';
import {operatingSource,id as sourceId}from'./fixtures/q-operating-source.mjs';

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${quote(JSON.stringify(value))}::jsonb`;

export function verifyCustomQAmountParityV5(sql){
 const cases=[];
 for(const paidCount of[0,1,2,7,28,89,9999,10000])for(const ratio of[1,3,7,100,2147483647])for(const feeMinor of[500,1500,100000000])cases.push({paidCount,feeMinor,ratio});
 const actual=JSON.parse(sql(`select jsonb_agg(app.calculate_custom_graduated_amounts_v3(value)order by ord)from jsonb_array_elements(${json(cases)})with ordinality as x(value,ord);`));
 for(const[i,input]of cases.entries())assert.deepEqual(actual[i],calculateCustomGraduatedAmountsV3(input));
 const negativeBase={eventId:uuid('0a5f',1),sourceDigest:'a'.repeat(64),manifest:{operatingWorkspace:{policies:[{method:'q-custom-graduated-policy-v5'}]}},obligations:[{kind:'refund',rows:[{participantId:uuid('0a5f',2),amountMinor:1000}]}],blockers:[]},bindings=[{policyId:uuid('0a5f',3)}];
 const reviewsBefore=Number(sql('select count(*)from app.q_obligation_reviews_v2;'));
 const noEligible=JSON.parse(sql(`select app.project_q_custom_source_v5(${json(negativeBase)},${json(bindings)},1);`));assert.deepEqual(noEligible.blockers,['q_no_eligible_recipients']);assert.equal(noEligible.obligations,null);
 const typoBase=structuredClone(negativeBase);typoBase.obligations[0].kind='refnud';
 const typo=JSON.parse(sql(`select app.project_q_custom_source_v5(${json(typoBase)},${json(bindings)},1);`));assert.deepEqual(typo.blockers,['source_blocked']);assert.equal(typo.obligations,null);
 const awardBase=structuredClone(negativeBase);awardBase.obligations[0].kind='award';
 const award=JSON.parse(sql(`select app.project_q_custom_source_v5(${json(awardBase)},${json(bindings)},1);`));assert.deepEqual(award.blockers,[]);assert.deepEqual(award.obligations,awardBase.obligations);
 assert.equal(Number(sql('select count(*)from app.q_obligation_reviews_v2;')),reviewsBefore);
 return{amountCases:cases.length,noEligibleRefundsBlocked:true,unsupportedKindBlocked:true,projectionCreatedNoReviews:true};
}

export function publishCustomQPolicyV5({sql,actor,tournamentId,eventId,poolVersionId,operationId,request}){
 assert.ok(isQCustomPolicyRequestV5(request));
 assert.equal(request.poolVersionId,poolVersionId);
 const storedIntent=JSON.parse(sql(`select original_intent from app.setup_custom_payout_intents_v2 where tournament_id='${tournamentId}' and scope='q' and ratio_denominator=${request.ratio} and amount_method=${quote(request.amountMethod)} and original_intent=${json(request.intent)};`));
 assert.deepEqual(storedIntent,request.intent,'Fixture must use the persisted immutable setup intent');
 const call=(body=request,op=operationId,who=actor)=>JSON.parse(sql(`select public.save_q_custom_policy_v5('${who}','${tournamentId}',${json(body)},'${op}');`)||'null');
 const accepted=call();
 assert.equal(accepted.status,'q_policy_published');assert.equal(accepted.poolVersionId,poolVersionId);
 assert.deepEqual(call(),accepted);
 assert.equal(call({...request,disclosureReference:`${request.disclosureReference} changed`}).code,'idempotency_conflict');
 assert.deepEqual(JSON.parse(sql(`select public.get_q_custom_policy_reconciliation_v5('${actor}','${tournamentId}','${operationId}',${json(request)});`)),{authorized:true,result:accepted});
 assert.equal(JSON.parse(sql(`select public.get_q_custom_policy_reconciliation_v5('${actor}','${tournamentId}','${operationId}',${json({...request,disclosureReference:`${request.disclosureReference} changed`})});`)).result.code,'idempotency_conflict');
 assert.equal(sql(`select count(*)from app.q_operating_policies_v2 where tournament_id='${tournamentId}' and event_id='${eventId}' and pool_version_id='${poolVersionId}' and method='q-custom-graduated-policy-v5';`),'1');
 const bindings=JSON.parse(sql(`select app.custom_q_policy_bindings_v5('${tournamentId}','${eventId}');`));
 assert.equal(bindings.length,1);assert.equal(bindings[0].policyId,accepted.policyId);assert.deepEqual(bindings[0].originalIntent,request.intent);
 const roleSql=(role,statement)=>`set role ${role};set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='${role}';${statement}`;
 const serviceReplay=JSON.parse(sql(roleSql('service_role',`select public.save_q_custom_policy_v5('${actor}','${tournamentId}',${json(request)},'${operationId}');`)));assert.deepEqual(serviceReplay,accepted);
 const serviceReconciliation=JSON.parse(sql(roleSql('service_role',`select public.get_q_custom_policy_reconciliation_v5('${actor}','${tournamentId}','${operationId}',${json(request)});`)));assert.deepEqual(serviceReconciliation,{authorized:true,result:accepted});
 const denied=(role,statement)=>{assert.throws(()=>sql(roleSql(role,statement)),/permission denied|42501/i);return true;};
 const roleProof={serviceReplay:true,serviceReconciliation:true};
 for(const role of['anon','authenticated']){
  roleProof[`${role}SaveDenied`]=denied(role,`select public.save_q_custom_policy_v5('${actor}','${tournamentId}',${json(request)},'${operationId}');`);
  roleProof[`${role}ReconciliationDenied`]=denied(role,`select public.get_q_custom_policy_reconciliation_v5('${actor}','${tournamentId}','${operationId}',${json(request)});`);
 }
 roleProof.servicePrivateImplementationDenied=denied('service_role',`select app.save_q_custom_policy_v5_impl('${actor}','${tournamentId}',${json(request)},'${operationId}');`);
 roleProof.servicePrivateReconciliationDenied=denied('service_role',`select app.get_q_custom_policy_reconciliation_v5_impl('${actor}','${tournamentId}','${operationId}',${json(request)});`);
 return{request,accepted,bindings,serviceReplay,serviceReconciliation,roleProof};
}

export function recordCustomQReviewV5({sql,actor,tournamentId,eventId,poolVersionId,operationId,reason}){
 const workspace=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${actor}','${tournamentId}');`));
 assert.deepEqual(workspace.blockers,[]);assert.equal(workspace.eventId,eventId);
 const source=JSON.parse(sql(`select app.q_obligation_sources_v2('${actor}','${tournamentId}');`));
 assert.deepEqual(source.blockers,[]);assert.equal(source.eventId,eventId);
 assert.equal(source.manifest.calculatorVersion,'q-unpaid-dispatch-v5');
 assert.equal(source.manifest.customAlgorithmVersion,'graduated-custom-ratio-largest-remainder-5usd-v3');
 assert.equal(source.manifest.refundPolicy,'no-pool-refunds-v1');
 assert.ok(source.manifest.customPolicyBindings.some(binding=>binding.poolVersionId===poolVersionId));
 const obligation=source.obligations.find(item=>item.poolVersionId===poolVersionId);assert.ok(obligation);
 assert.equal(obligation.status,'unpaid');assert.ok(obligation.rows.length>0);
 assert.equal(obligation.rows.reduce((total,row)=>total+row.amountMinor,0),obligation.fundMinor);
 assert.ok(obligation.rows.every(row=>row.amountMinor>0&&row.amountMinor%500===0));
 const request={expectedVersion:workspace.currentVersion,sourceDigest:workspace.sourceDigest,reason,reviewed:true};
 const result=JSON.parse(sql(`select public.record_q_obligation_review_v2('${actor}','${tournamentId}',${json(request)},'${operationId}');`));
 assert.equal(result.status,'q_obligations_recorded_v2');
 const current=JSON.parse(sql(`select public.get_q_obligation_review_workspace_v2('${actor}','${tournamentId}');`));
 assert.equal(current.current,true);assert.equal(current.currentVersion,workspace.currentVersion+1);
 assert.equal(sql(`select count(*)from app.q_accounting_drafts_v6 where event_id='${eventId}';`),'0');
 assert.equal(sql(`select count(*)from app.q_accounting_finals_v6 where event_id='${eventId}';`),'0');
 return{workspace,source,request,result,current};
}

export function assertCustomQUnpaidFinalV5({sql,actor,tournamentId,eventId,poolVersionId}){
 const workspace=JSON.parse(sql(`select public.get_q_accounting_workspace_v6('${actor}','${tournamentId}','${eventId}');`));
 assert.equal(workspace.finalization.status,'unpaid');assert.equal(workspace.finalization.current,true);
 const source=JSON.parse(sql(`select app.q_obligation_sources_v2('${actor}','${tournamentId}');`));
 const obligation=source.obligations.find(item=>item.poolVersionId===poolVersionId);assert.ok(obligation);
 assert.equal(obligation.rows.reduce((total,row)=>total+row.amountMinor,0),obligation.fundMinor);
 assert.equal(sql(`select count(*)from app.q_accounting_finals_v6 where event_id='${eventId}' and status='unpaid';`),'1');
 return{workspace,source,obligation};
}

/** Complete injected-DB Q-only acceptance. The caller owns one already
 * isolated database and installs all dependencies. This uses disclosed local
 * synthetic setup, activation, player, score and expense foundations; it is
 * not provider, human-play, payment or publication evidence. */
export function verifyCustomQAccountingRuntimeV1({sql,checkpoint=()=>{}}){
 const actor=fixtureActor,tournamentId=fixtureTournamentId;let eventId=fixtureEventId;
 let seed=foundationV2({structuredSchedule:false,pool1People:Array.from({length:16},(_,i)=>i+1),pool2People:[1],pool1Fee:1000,pool1Type:'Graduated (1-in-6)'});
 const marker='insert into app.ruleset_versions',at=seed.indexOf(marker);assert.ok(at>0);
 let prefix=seed.slice(0,at),suffix=seed.slice(at);
 prefix=prefix.replace("'Synthetic Qualification','open','open'","'Synthetic Qualification','draft','closed'");
 assert.notEqual(prefix,seed.slice(0,at));sql(prefix+'commit;');

 const base=JSON.parse(sql(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';select app.get_custom_q_setup_base_v2('${tournamentId}');`)).base;
 assert.ok(base);const{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;
 const event=payload.events[0];delete event.sourceStatus;event.clientRowId='e1310000-0000-4000-8000-000000000003';event.displayName='Main';event.gameCount=12;event.entryFeeCents=3000;event.sidePools=[];
 event.qPools=[{poolTypeCode:'Graduated (1-in-7)',entryFeeCents:1000,note:'TEST ONLY synthetic Custom 7'},{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:1000,note:'TEST ONLY preserved equal Q2'}];
 const intent=createCustomPayoutIntentV1('q',7,{...base,eventClientRowId:event.clientRowId,poolSlot:1});assert.ok(intent);
 const setupOperation=uuid('0a51',1),envelope={kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,payload,idempotencyKey:setupOperation},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[intent]};
 const setup=JSON.parse(sql(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';select app.save_custom_q_setup_draft_v2('${tournamentId}',${json(envelope)});`));
 assert.equal(setup.status,'custom_q_setup_draft_saved');assert.equal(setup.moneyMoved,false);
 const ids=JSON.parse(sql(`select jsonb_build_object('revisionId',r.id,'eventVersionId',e.id,'pool1Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=1),'pool2Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=2)) from app.tournament_setup_revisions r join app.tournament_setup_event_versions e on e.setup_revision_id=r.id and e.client_row_id='${event.clientRowId}' where r.tournament_id='${tournamentId}' order by r.version desc limit 1;`));
 for(const key of['revisionId','eventVersionId','pool1Id','pool2Id'])assert.match(ids[key],/^[a-f0-9-]{36}$/);
 for(const[oldId,newId]of[['e1310000-0000-4000-8000-000000000001',ids.revisionId],['e1310000-0000-4000-8000-000000000002',ids.eventVersionId],['c2430000-0000-4000-8000-000000000001',ids.pool1Id],['c2430000-0000-4000-8000-000000000002',ids.pool2Id]])suffix=suffix.replaceAll(oldId,newId);
 const schedule={kind:'director-selected-prize-schedule-v1',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY reviewed 4:3:2:2 director schedule',roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
 const scheduleRequest={expectedVersion:0,schedule,reviewed:true,reason:'TEST ONLY current custom setup pre-collection schedule'};
 const savedSchedule=JSON.parse(sql(`set request.jwt.claim.role='service_role';select public.save_setup_prize_schedule_v1('${actor}','${tournamentId}','${event.clientRowId}',${json(scheduleRequest)},'${uuid('0a50',1)}');`));assert.equal(savedSchedule.status,'prize_schedule_saved_v1');
 checkpoint('setup',{actor,tournamentId,ids,envelope,setup,savedSchedule});
 const declarationWorkspace=JSON.parse(sql(`select public.get_event_prize_declaration_v2('${actor}','${tournamentId}','${event.clientRowId}');`));
 assert.equal(declarationWorkspace.currentVersion,0);assert.equal(declarationWorkspace.supported,true);assert.match(declarationWorkspace.settingsFingerprint,/^[a-f0-9]{64}$/);
 const declarationSchedule={kind:'regular-prize-cohort-5usd-v3',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY reviewed 4:3:2:2 whole-five-dollar declaration',roundingRule:'automatic-five-dollar-cohort-v3',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
 const declarationRequest={expectedVersion:declarationWorkspace.currentVersion,expectedSettingsFingerprint:declarationWorkspace.settingsFingerprint,schedule:declarationSchedule,reason:'TEST ONLY current custom setup V2 activation declaration',reviewed:true};
 const savedDeclaration=JSON.parse(sql(`select public.save_event_prize_declaration_v2('${actor}','${tournamentId}','${event.clientRowId}',${json(declarationRequest)},'${uuid('0a50',3)}');`));assert.equal(savedDeclaration.status,'event_prize_declaration_saved_v2');assert.equal(savedDeclaration.version,1);
 const declarationPins=JSON.parse(sql(`select app.current_event_prize_activation_pins_v1('${tournamentId}','${ids.revisionId}',${base.setupVersion+1});`));assert.equal(declarationPins.length,1);assert.equal(declarationPins[0].clientRowId,event.clientRowId);
 assert.equal(declarationPins[0].declarationId,savedDeclaration.scheduleId);assert.equal(declarationPins[0].settingsFingerprint,declarationWorkspace.settingsFingerprint);
 const activationRequest={request:{setupRevisionId:ids.revisionId,expectedVersion:base.setupVersion+1,confirmed:true,idempotencyKey:uuid('0a50',2),declarationPins},associationHash:setup.linked.links.associationHash};
 const activated=JSON.parse(sql(`set request.jwt.claim.role='service_role';select public.finalize_linked_tournament_setup_v1('${actor}','${tournamentId}',${json(activationRequest)});`));assert.equal(activated.status,'linked_setup_activated');assert.equal(activated.associationHash,setup.linked.links.associationHash);assert.equal(activated.result.setupRevisionId,ids.revisionId);assert.equal(activated.result.setupVersion,base.setupVersion+1);assert.equal(activated.result.events.length,1);
 eventId=activated.result.events[0].eventId;assert.match(eventId,/^[a-f0-9-]{36}$/);assert.equal(activated.result.events[0].setupEventVersionId,ids.eventVersionId);
 const bindingRequest={...scheduleRequest,expectedVersion:1,reason:'TEST ONLY bind the reviewed legacy V1 schedule after normal pinned activation and before collection'};
 const boundSchedule=JSON.parse(sql(`select public.save_setup_prize_schedule_v1('${actor}','${tournamentId}','${event.clientRowId}',${json(bindingRequest)},'${uuid('0a50',4)}');`));assert.equal(boundSchedule.status,'prize_schedule_saved_v1');assert.equal(boundSchedule.version,2);
 const regularBinding=JSON.parse(sql(`select jsonb_build_object('bindingId',b.id,'bindingVersion',b.binding_version,'bindingSource',b.binding_source,'scheduleVersionId',b.schedule_version_id,'clientRowId',b.client_row_id)from app.event_prize_schedule_bindings_v1 b where b.tournament_id='${tournamentId}'and b.event_id='${eventId}'order by b.binding_version desc limit 1;`));
 assert.equal(regularBinding.bindingSource,'reviewed_revision');assert.equal(regularBinding.scheduleVersionId,boundSchedule.scheduleId);assert.equal(regularBinding.clientRowId,event.clientRowId);
 checkpoint('activation',{actor,tournamentId,eventId,ids,declarationWorkspace,declarationRequest,savedDeclaration,declarationPins,activationRequest,activated,bindingRequest,boundSchedule,regularBinding});
 const retainedMarker=`insert into app.tournament_roles(tournament_id,profile_id,role) values('${tournamentId}','a1310000-0000-4000-8000-000000000006','co_director');`;
 const retainedAt=suffix.indexOf(retainedMarker);assert.ok(retainedAt>0);suffix=suffix.slice(retainedAt).replaceAll(fixtureEventId,eventId);
 const oldPolicy={action:'publish',poolVersionId:ids.pool1Id,method:'graduated-paid-card-rank-v2',ratio:6,scheduleId:'friend-q-p2-10-6-v1',disclosureReference:'TEST ONLY reviewed policy 1',disclosed:true};
 const customPolicy={action:'publish',poolVersionId:ids.pool1Id,method:'q-custom-graduated-policy-v5',ratio:7,amountMethod:'graduated-custom-ratio-largest-remainder-5usd-v3',disclosureReference:'TEST ONLY exact Custom 7 policy, no money movement',disclosed:true,intent};
 const policyOperation=uuid('0245',1),oldCall=`select public.save_q_operating_policy_v2('${actor}','${tournamentId}',${quote(JSON.stringify(oldPolicy))},'${policyOperation}');`;
 const customCall=`set request.jwt.claim.role='service_role';select public.save_q_custom_policy_v5('${actor}','${tournamentId}',${json(customPolicy)},'${policyOperation}');`;
 assert.ok(suffix.includes(oldCall));suffix=suffix.replace(oldCall,customCall);
 sql(`begin;set role postgres;${suffix}`);

 const policy=publishCustomQPolicyV5({sql,actor,tournamentId,eventId,poolVersionId:ids.pool1Id,operationId:policyOperation,request:customPolicy});
 const actualWorkspace=JSON.parse(sql(`select public.get_q_operating_workspace_v2('${actor}','${tournamentId}');`));
 assert.equal(actualWorkspace.policies.find(p=>p.poolVersionId===ids.pool1Id).method,'q-custom-graduated-policy-v5');
 assert.equal(actualWorkspace.membership.entries.filter(e=>e.pools.find(p=>p.poolVersionId===ids.pool1Id)?.paidEntryEligible).length,16);

 const direct=operatingSource(28,1000);Object.assign(direct.policies[0],{method:'q-custom-graduated-policy-v5',ratio:7,scheduleId:'graduated-custom-ratio-largest-remainder-5usd-v3'});
 const calculate=value=>JSON.parse(sql(`select app.calculate_q_obligations_v2(${json(value)});`));
 const directResult=calculate(direct);assert.deepEqual(directResult.blockers,[]);assert.equal(directResult.obligations[0].rows.length,4);assert.equal(directResult.obligations[0].rows.reduce((n,row)=>n+row.amountMinor,0),28000);
 const tie=structuredClone(direct);tie.cards[1]={...tie.cards[0],participantId:sourceId(101),qualificationRank:2};assert.deepEqual(calculate(tie).blockers,['q_cash_tie_unresolved']);
 const unpaid=structuredClone(direct);unpaid.membership.entries[0].pools[0].paidEntryEligible=false;assert.deepEqual(calculate(unpaid).blockers,['funding_unresolved']);
 const legacy=operatingSource(16,1000,'graduated-paid-card-rank-v2');assert.deepEqual(calculate(legacy),JSON.parse(sql(`select app.calculate_q_obligations_pre_custom_v5(${json(legacy)});`)));
 const qualification=JSON.parse(sql(`select to_jsonb(q)from app.qualification_result_versions q where q.event_id='${eventId}' order by q.version desc limit 1;`));assert.ok(qualification);
 checkpoint('policy_source_qualification',{actor,tournamentId,eventId,ids,policy,actualWorkspace,qualification,directResult});

 const review=recordCustomQReviewV5({sql,actor,tournamentId,eventId,poolVersionId:ids.pool1Id,operationId:uuid('0a51',2),reason:'TEST ONLY source-bound Custom 7 Q review'});
 const customAward=review.source.obligations.find(item=>item.poolVersionId===ids.pool1Id);assert.deepEqual(customAward.rows.map(row=>row.amountMinor),[8000,5500,2500]);assert.deepEqual(customAward.rows.map(row=>row.participantId),[uuid('f243',2),uuid('f243',1),uuid('f243',4)]);assert.equal(customAward.fundMinor,16000);
 const equalAward=review.source.obligations.find(item=>item.poolVersionId===ids.pool2Id);assert.equal(equalAward.kind,'award');assert.equal(equalAward.fundMinor,1000);assert.equal(equalAward.rows.length,1);assert.equal(equalAward.rows[0].amountMinor,1000);assert.equal(equalAward.rows[0].participantId,uuid('f243',1));assert.equal(equalAward.rows[0].displayName,'TEST ONLY Q entrant 1');
 const staleReview=JSON.parse(sql(`select public.record_q_obligation_review_v2('${actor}','${tournamentId}',${json({...review.request,expectedVersion:1,sourceDigest:'0'.repeat(64)})},'${uuid('0a51',3)}');`));assert.equal(staleReview.code,'source_changed');
 checkpoint('q_review',{actor,tournamentId,eventId,ids,review,customAward,equalAward,noPoolRefunds:true});
 for(const[i,amount,name]of[[1,4800,'sanctioning'],[2,9600,'meals'],[3,3700,'hall_rental'],[4,2400,'cards']]){
  const recorded=JSON.parse(sql(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tournamentId}',${amount},'USD','TEST ONLY ${name}','${uuid('0a52',i)}');`).split('\n').at(-1));assert.equal(recorded.status,'expense_recorded');
 }
 const checker='a1310000-0000-4000-8000-000000000007';sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tournamentId}','${checker}','cross_checker');`);
 const binding=JSON.parse(sql(`select public.bind_paper_official_identity_v1('${actor}','${tournamentId}','${uuid('0a53',1)}','${checker}','nonparticipant',null,0,'${uuid('0a53',2)}');`));assert.equal(binding.status,'bound');
 sql(`insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id) select '${uuid('0a53',3)}','${tournamentId}','${eventId}',id,'main',300,16,4800,'setup','${ids.revisionId}' from app.event_play_starts where event_id='${eventId}' and not exists(select 1 from app.event_sanctioning_fee_snapshots where event_id='${eventId}');`);
 const qualificationId=sql(`select id from app.qualification_result_versions where event_id='${eventId}';`);
 const participant=n=>`f2430000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const series=[{winnerId:participant(2),loserId:participant(3),evidenceNote:'TEST ONLY synthetic semifinal 1'},{winnerId:participant(1),loserId:participant(4),evidenceNote:'TEST ONLY synthetic semifinal 2'},{winnerId:participant(2),loserId:participant(1),evidenceNote:'TEST ONLY synthetic final'}];
 const playoffs=JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tournamentId}','${eventId}','${qualificationId}',0,${json(series)},'${uuid('0a53',4)}');`));assert.equal(playoffs.status,'playoff_outcomes_recorded');

 const accountingSource=JSON.parse(sql(`select app.q_accounting_source_v6('${actor}','${tournamentId}','${eventId}');`));
 let accounting=JSON.parse(sql(`select public.get_q_accounting_workspace_v6('${actor}','${tournamentId}','${eventId}');`));
 checkpoint('v6_preflight',{actor,tournamentId,eventId,ids,regularBinding,accountingSource,accounting});
 assert.deepEqual(accounting.blockers,[]);assert.equal(accounting.facts.qIncomeMinor,17000);assert.equal(accounting.facts.expenseTotalMinor,20500);assert.equal(accounting.facts.regularAwardMinor,27500);
 assert.deepEqual(accounting.regularSchedule.awards.map(row=>row.totalAwardMinor),[10000,7500,5000,5000]);assert.ok(accounting.regularSchedule.awards.every(row=>row.totalAwardMinor%500===0));
 const classifications=accounting.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:e.description.replace('TEST ONLY ',''),evidenceReference:'TEST ONLY synthetic invoice'}));
 const draftRequest={expectedVersion:0,sourceDigest:accounting.sourceDigest,qReviewId:accounting.qReview.id,scheduleVersionId:accounting.regularSchedule.scheduleVersionId,reason:'TEST ONLY Custom 7 canonical accounting',expenseClassifications:classifications,reviewed:true};
 const saveDraft=(request=draftRequest,operation=uuid('0a54',1),who=actor)=>JSON.parse(sql(`select public.save_q_accounting_draft_v6('${who}','${tournamentId}','${eventId}',${json(request)},'${operation}');`)||'null');
 assert.equal(saveDraft(draftRequest,uuid('0a54',90),checker).code,'not_director');assert.equal(saveDraft({...draftRequest,sourceDigest:'0'.repeat(64)},uuid('0a54',91)).code,'source_changed');
 const draft=saveDraft();assert.equal(draft.status,'q_accounting_draft_saved_v6');assert.deepEqual(saveDraft(),draft);assert.equal(saveDraft(draftRequest,uuid('0a54',2)).code,'stale_version');
 const reconciliation=JSON.parse(sql(`select public.reconcile_q_accounting_v6('${actor}','${tournamentId}','${eventId}','${uuid('0a54',1)}',${json(draftRequest)},'draft');`));assert.deepEqual(reconciliation.result,draft);
 assert.equal(JSON.parse(sql(`select public.finalize_cross_checking_v1('${actor}','${tournamentId}','${uuid('0a54',3)}');`)).status,'cross_checking_finalized');
 const finalRequest={draftId:draft.draftId,draftVersion:1,expectedVersion:0,reason:'TEST ONLY Custom 7 accounting remains unpaid',reviewed:true};
 const saveFinal=(operation=uuid('0a54',4))=>JSON.parse(sql(`select public.finalize_q_accounting_v6('${actor}','${tournamentId}','${eventId}',${json(finalRequest)},'${operation}');`));
 const final=saveFinal();assert.equal(final.status,'q_accounting_finalized_unpaid_v6');assert.deepEqual(saveFinal(),final);assert.equal(saveFinal(uuid('0a54',5)).code,'already_finalized');
 const finalized=assertCustomQUnpaidFinalV5({sql,actor,tournamentId,eventId,poolVersionId:ids.pool1Id});
 checkpoint('v6_draft_final',{actor,tournamentId,eventId,ids,draftRequest,draft,reconciliation,finalRequest,final,finalized});
 assert.equal(sql(`select count(*)from app.tournament_setup_side_pool_versions where tournament_id='${tournamentId}';`),'0');
 assert.equal(sql(`select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('save_q_custom_policy_v5','get_q_custom_policy_reconciliation_v5')and(has_function_privilege('anon',p.oid,'EXECUTE')or has_function_privilege('authenticated',p.oid,'EXECUTE'));`),'0');
 assert.equal(sql(`select count(*)from app.q_accounting_finals_v6 where event_id='${eventId}' and status='unpaid';`),'1');
 return{actor,tournamentId,eventId,ids,envelope,setup,savedSchedule,declarationWorkspace,declarationRequest,savedDeclaration,declarationPins,activationRequest,activated,bindingRequest,boundSchedule,regularBinding,policy,review,customAward,equalAward,noPoolRefunds:true,draftRequest,draft,reconciliation,finalRequest,final,finalized,syntheticFoundations:true,moneyMoved:false,providerVerified:false,combinedQSideSupported:false};
}
