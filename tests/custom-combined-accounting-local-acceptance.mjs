// Complete injected-DB Custom Q7 + Side5 + combined V10 acceptance.
// The caller owns the isolated database. The local fixture uses synthetic
// setup, receipts, games and score evidence; it is not provider, human-play,
// bank, payment, or publication proof.
import assert from 'node:assert/strict';
import {createCustomPayoutIntentV1}from'../src/lib/api/custom-payout-intent-v1.ts';
import {foundationV2}from'./fixtures/q-v2-foundation.mjs';
import {qSetupPrizeWorkspace}from'./fixtures/q-setup-prize-workspace.mjs';
import {actor,tid,uuid}from'./fixtures/q-review-foundation.mjs';
import {publishCustomQPolicyV5}from'./custom-q-accounting-bridge-local-acceptance.mjs';
import {publishCustomSidePoliciesV4}from'./custom-side-accounting-bridge-local-acceptance.mjs';
import {verifyCustomQSideCombinedAccountingV10}from'./custom-q-side-combined-accounting-v10-local-acceptance.mjs';

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${quote(JSON.stringify(value))}::jsonb`;
const participant=n=>`f2430000-0000-4000-8000-${String(n).padStart(12,'0')}`;

export function verifyCustomCombinedAccountingRuntimeV10({sql,checkpoint=()=>{}}){
 let eventId='11310000-0000-4000-8000-000000000001';
 let seed=foundationV2({structuredSchedule:false,pool1People:Array.from({length:16},(_,i)=>i+1),pool2People:[1],pool1Fee:1000,pool1Type:'Graduated (1-in-6)'});
 const marker='insert into app.ruleset_versions',at=seed.indexOf(marker);assert.ok(at>0);
 let prefix=seed.slice(0,at),suffix=seed.slice(at);
 prefix=prefix.replace("'Synthetic Qualification','open','open'","'Synthetic Qualification','draft','closed'");
 assert.notEqual(prefix,seed.slice(0,at));sql(prefix+'commit;');

 const base=JSON.parse(sql(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';select app.get_custom_q_setup_base_v2('${tid}');`)).base;
 const{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;
 const event=payload.events[0];delete event.sourceStatus;event.clientRowId='e1310000-0000-4000-8000-000000000003';event.displayName='Main';event.gameCount=12;event.entryFeeCents=3000;
 event.qPools=[{poolTypeCode:'Graduated (1-in-7)',entryFeeCents:1000,note:'TEST ONLY Custom Q7'},{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:1000,note:'TEST ONLY no-refund qualifying Q'}];
 event.sidePools=[{poolTypeCode:'Custom Side Five',entryFeeCents:1000,note:'TEST ONLY Custom Side5'}];
 const qIntent=createCustomPayoutIntentV1('q',7,{...base,eventClientRowId:event.clientRowId,poolSlot:1});
 const sideIntent=createCustomPayoutIntentV1('side',5,{...base,eventClientRowId:event.clientRowId,poolSlot:1});assert.ok(qIntent&&sideIntent);
 const setupOperation=uuid('0b51',1),envelope={kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,payload,idempotencyKey:setupOperation},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[qIntent,sideIntent]};
 const setup=JSON.parse(sql(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';select app.save_custom_pool_setup_draft_v3('${tid}',${json(envelope)});`));assert.equal(setup.status,'custom_pool_setup_draft_saved_v3');
 const ids=JSON.parse(sql(`select jsonb_build_object('revisionId',r.id,'eventVersionId',e.id,'q1Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=1),'q2Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=2),'sideSetupId',(select id from app.tournament_setup_side_pool_versions where setup_revision_id=r.id and slot=1))from app.tournament_setup_revisions r join app.tournament_setup_event_versions e on e.setup_revision_id=r.id and e.client_row_id='${event.clientRowId}'where r.tournament_id='${tid}'order by r.version desc limit 1;`));
 for(const key of['revisionId','eventVersionId','q1Id','q2Id','sideSetupId'])assert.match(ids[key],/^[a-f0-9-]{36}$/);
 for(const[oldId,newId]of[['e1310000-0000-4000-8000-000000000001',ids.revisionId],['e1310000-0000-4000-8000-000000000002',ids.eventVersionId],['c2430000-0000-4000-8000-000000000001',ids.q1Id],['c2430000-0000-4000-8000-000000000002',ids.q2Id]])suffix=suffix.replaceAll(oldId,newId);
 const schedule={kind:'regular-prize-cohort-5usd-v3',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY reviewed whole-five-dollar schedule',roundingRule:'automatic-five-dollar-cohort-v3',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
 const scheduleRequest={expectedVersion:0,schedule,reviewed:true,reason:'TEST ONLY pre-collection schedule'};
 const savedSchedule=JSON.parse(sql(`set request.jwt.claim.role='service_role';select public.save_setup_prize_schedule_v1('${actor}','${tid}','${event.clientRowId}',${json(scheduleRequest)},'${uuid('0b50',1)}');`));assert.equal(savedSchedule.status,'prize_schedule_saved_v1');
 const declarationWorkspace=JSON.parse(sql(`select public.get_event_prize_declaration_v2('${actor}','${tid}','${event.clientRowId}');`));
 const declarationSchedule={...schedule,sourceReference:'TEST ONLY reviewed whole-five-dollar declaration'};
 const declarationRequest={expectedVersion:0,expectedSettingsFingerprint:declarationWorkspace.settingsFingerprint,schedule:declarationSchedule,reason:'TEST ONLY V10 activation declaration',reviewed:true};
 const savedDeclaration=JSON.parse(sql(`select public.save_event_prize_declaration_v2('${actor}','${tid}','${event.clientRowId}',${json(declarationRequest)},'${uuid('0b50',2)}');`));assert.equal(savedDeclaration.status,'event_prize_declaration_saved_v2');
 const declarationPins=JSON.parse(sql(`select app.current_event_prize_activation_pins_v1('${tid}','${ids.revisionId}',${base.setupVersion+1});`));
 const activationRequest={request:{setupRevisionId:ids.revisionId,expectedVersion:base.setupVersion+1,confirmed:true,idempotencyKey:uuid('0b50',3),declarationPins},associationHash:setup.linked.links.associationHash};
 const activated=JSON.parse(sql(`set request.jwt.claim.role='service_role';select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${json(activationRequest)});`));assert.equal(activated.status,'linked_setup_activated');eventId=activated.result.events[0].eventId;
 const boundSchedule=JSON.parse(sql(`select public.save_setup_prize_schedule_v1('${actor}','${tid}','${event.clientRowId}',${json({...scheduleRequest,expectedVersion:1,reason:'TEST ONLY bind reviewed V1 schedule'})},'${uuid('0b50',4)}');`));assert.equal(boundSchedule.status,'prize_schedule_saved_v1');
 const sideIds=JSON.parse(sql(`select jsonb_build_object('poolId',m.pool_id,'definitionVersionId',d.id)from app.tournament_setup_side_pool_materializations m join app.event_side_pool_definition_versions d on d.pool_id=m.pool_id and d.tournament_id=m.tournament_id and d.event_id=m.event_id where m.tournament_id='${tid}'and m.event_id='${eventId}'and m.setup_side_pool_version_id='${ids.sideSetupId}'order by d.version desc limit 1;`));assert.match(sideIds.poolId,/^[a-f0-9-]{36}$/);
 checkpoint('setup_activation',{actor,tournamentId:tid,eventId,ids,envelope,setup,savedSchedule,savedDeclaration,declarationPins,activated,boundSchedule,sideIds});

 const qPolicyRequest={action:'publish',poolVersionId:ids.q1Id,method:'q-custom-graduated-policy-v5',ratio:7,amountMethod:'graduated-custom-ratio-largest-remainder-5usd-v3',disclosureReference:'TEST ONLY exact Custom Q7',disclosed:true,intent:qIntent};
 const qPolicyOperation=uuid('0b55',1),oldPolicy={action:'publish',poolVersionId:ids.q1Id,method:'graduated-paid-card-rank-v2',ratio:6,scheduleId:'friend-q-p2-10-6-v1',disclosureReference:'TEST ONLY reviewed policy 1',disclosed:true};
 const oldCall=`select public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify(oldPolicy))},'${uuid('0245',1)}');`;
 const customCall=`set request.jwt.claim.role='service_role';select public.save_q_custom_policy_v5('${actor}','${tid}',${json(qPolicyRequest)},'${qPolicyOperation}');`;assert.ok(suffix.includes(oldCall));suffix=suffix.replace(oldCall,customCall);
 const sidePolicies=publishCustomSidePoliciesV4({sql,actor,tournamentId:tid,eventId,poolId:sideIds.poolId,setupSidePoolVersionId:ids.sideSetupId,definitionVersionId:sideIds.definitionVersionId,intent:sideIntent,ratio:5,legacyOperationId:uuid('0b56',1),policyOperationId:uuid('0b56',2),combinedBlockOperationId:uuid('0b56',3),recipientOperationId:uuid('0b56',4),zeroReviewOperationId:uuid('0b56',5),disclosureReference:'TEST ONLY exact Custom Side5',combinedEnabled:true});
 const electionSql=Array.from({length:16},(_,index)=>{const n=index+1,request={policyId:sidePolicies.accepted.policyId,participantId:participant(n),electionId:uuid('0b57',n),expectedVersion:0,elected:true,receivedMinor:1000,paymentMethod:'cash',paymentReference:'TEST ONLY synthetic Side receipt',reason:'TEST ONLY disclosed Side5 election'};return`do $e$declare r jsonb;begin r:=public.save_side_pool_graduated_election_v2('${actor}','${tid}','${eventId}','${sideIds.poolId}',${json(request)},'${uuid('0b58',n)}');if r->>'status'is distinct from'side_pool_election_saved_v2'then raise exception'Side election failed %',r;end if;end$e$;`;}).join('\n');
 assert.ok(suffix.includes('insert into app.initial_seating_publications'));suffix=suffix.replace('insert into app.initial_seating_publications',electionSql+'\ninsert into app.initial_seating_publications');
 const retainedMarker=`insert into app.tournament_roles(tournament_id,profile_id,role) values('${tid}','a1310000-0000-4000-8000-000000000006','co_director');`,retainedAt=suffix.indexOf(retainedMarker);assert.ok(retainedAt>0);suffix=suffix.slice(retainedAt).replaceAll('11310000-0000-4000-8000-000000000001',eventId);
 sql(`begin;set role postgres;${suffix}`);
 const qPolicy=publishCustomQPolicyV5({sql,actor,tournamentId:tid,eventId,poolVersionId:ids.q1Id,operationId:qPolicyOperation,request:qPolicyRequest});
 const collection=JSON.parse(sql(`select jsonb_build_object('paidEntrants',(select count(*)from app.q_pool_allocation_versions_v1 where tournament_id='${tid}'),'qCustomPaidEntrants',(select count(*)from app.q_pool_allocation_versions_v1 a cross join lateral jsonb_array_elements(a.request->'pools')p where a.tournament_id='${tid}'and p->>'poolVersionId'='${ids.q1Id}'and(p->>'amountMinor')::integer=1000),'qEqualPaidEntrants',(select count(*)from app.q_pool_allocation_versions_v1 a cross join lateral jsonb_array_elements(a.request->'pools')p where a.tournament_id='${tid}'and p->>'poolVersionId'='${ids.q2Id}'and(p->>'amountMinor')::integer=1000),'sidePaidEntrants',(select count(*)from(select distinct on(participant_id)*from app.event_side_pool_election_versions where pool_id='${sideIds.poolId}'order by participant_id,version desc)e where elected and amount_due_minor=1000 and amount_received_minor=1000),'qualifierCount',(select count(*)from app.qualification_result_rows r join app.qualification_result_versions v on v.id=r.result_version_id where v.event_id='${eventId}'and r.qualification_status='qualified'));`));
 assert.deepEqual(collection,{paidEntrants:16,qCustomPaidEntrants:16,qEqualPaidEntrants:1,sidePaidEntrants:16,qualifierCount:4});checkpoint('collection_qualification',{qPolicy,sidePolicies,collection,noPoolRefunds:true});

 for(const[n,amount,name]of[[1,4800,'sanctioning'],[2,200,'cards']]){const recorded=JSON.parse(sql(`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_tournament_expense('${tid}',${amount},'USD','TEST ONLY ${name}','${uuid('0b59',n)}');`).split('\n').at(-1));assert.equal(recorded.status,'expense_recorded');}
 const checker='a1310000-0000-4000-8000-000000000007';sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${checker}','cross_checker');`);
 assert.equal(JSON.parse(sql(`select public.bind_paper_official_identity_v1('${actor}','${tid}','${uuid('0b59',3)}','${checker}','nonparticipant',null,0,'${uuid('0b59',4)}');`)).status,'bound');
 sql(`insert into app.event_sanctioning_fee_snapshots(id,tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,setup_revision_id)select'${uuid('0b59',5)}','${tid}','${eventId}',id,'main',300,16,4800,'setup','${ids.revisionId}'from app.event_play_starts where event_id='${eventId}'and not exists(select 1 from app.event_sanctioning_fee_snapshots where event_id='${eventId}');`);
 const qualificationId=sql(`select id from app.qualification_result_versions where event_id='${eventId}';`),series=[{winnerId:participant(2),loserId:participant(3),evidenceNote:'TEST ONLY semifinal 1'},{winnerId:participant(1),loserId:participant(4),evidenceNote:'TEST ONLY semifinal 2'},{winnerId:participant(2),loserId:participant(1),evidenceNote:'TEST ONLY final'}];
 assert.equal(JSON.parse(sql(`select public.record_standard_singles_playoff_outcomes_v3('${actor}','${tid}','${eventId}','${qualificationId}',0,${json(series)},'${uuid('0b59',6)}');`)).status,'playoff_outcomes_recorded');
 assert.equal(JSON.parse(sql(`select public.finalize_cross_checking_v1('${actor}','${tid}','${uuid('0b59',7)}');`)).status,'cross_checking_finalized');
 checkpoint('combined_source_ready',{expensesMinor:5000,qualificationId,series,crossCheckingFinalized:true});

 const combined=verifyCustomQSideCombinedAccountingV10({sql,actor,tournamentId:tid,eventId,q:{poolVersionId:ids.q1Id,policyOperationId:qPolicyOperation,policyRequest:qPolicyRequest,reviewOperationId:uuid('0b55',2),reviewReason:'TEST ONLY source-bound Q7 review',expectedCustomFundMinor:16000,expectedCustomAwards:[8000,5500,2500],expectedCustomParticipants:[participant(2),participant(1),participant(4)],equalPoolVersionId:ids.q2Id,equalParticipantId:participant(1)},side:{poolId:sideIds.poolId,setupSidePoolVersionId:ids.sideSetupId,definitionVersionId:sideIds.definitionVersionId,intent:sideIntent,ratio:5,feeMinor:1000,legacyOperationId:uuid('0b56',1),policyOperationId:uuid('0b56',2),combinedBlockOperationId:uuid('0b56',3),recipientOperationId:uuid('0b56',4),zeroReviewOperationId:uuid('0b56',5),reviewOperationId:uuid('0b56',6),reviewReason:'TEST ONLY source-bound Side5 review',expectedFundMinor:16000,expectedParticipants:[participant(2),participant(1),participant(4),participant(3)]},preparedPolicies:{qPolicy,sidePolicies},collectionEvidence:collection,expenseClassifications:null,operations:{wrongDigest:uuid('0b60',1),draft:uuid('0b60',2),final:uuid('0b60',3),staleExpense:uuid('0b60',4),staleFinal:uuid('0b60',5)},checkpoint});
 assert.equal(combined.noPoolRefunds,true);assert.equal(combined.moneyMoved,false);
 return{...combined,setup:{envelope,result:setup,activation:activated},integrationVersion:'custom-pool-accounting-v10',standaloneSideV9Supported:false,combinedQSideSupportedByV10:true,syntheticFoundations:true,moneyMoved:false,providerVerified:false};
}
