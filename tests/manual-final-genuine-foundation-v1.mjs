// Injected disposable-DB foundation for a native configured Main with Custom
// Q7, Equal Q and Custom Side5. The retained schedule, games and score rows are
// explicitly synthetic test data. Setup, operational activation, qualification
// finalization and Q/Side reviews use the current guarded functions. This helper
// creates no V9 accounting draft/final, payment, payout or provider evidence.
import assert from'node:assert/strict';
import{readEventPrizeWorkspaceV1,buildEventPrizeEnvelopeV1}from'../src/lib/api/event-prize-workspace-v1.ts';
import{serializeEventPrizeSettingsV1}from'../src/lib/api/event-prize-settings-v1.ts';
import{readEventPrizeActivationSourceV1,buildEventPrizeActivationV1,serializeEventPrizeActivationV1}from'../src/lib/api/event-prize-activation-v1.ts';
import{newPlayoffPrizePlanDraftV2}from'../src/lib/playoffs/playoff-prize-plan-v2.ts';
import{createCustomPayoutIntentV1}from'../src/lib/api/custom-payout-intent-v1.ts';
import{newEventPlayoffParametersDraftV1}from'../src/lib/playoffs/event-playoff-parameters-v1.ts';
import{foundationV2}from'./fixtures/q-v2-foundation.mjs';
import{qSetupPrizeWorkspace}from'./fixtures/q-setup-prize-workspace.mjs';
import{actor,tid,uuid}from'./fixtures/q-review-foundation.mjs';
import{publishCustomQPolicyV5,recordCustomQReviewV5}from'./custom-q-accounting-bridge-local-acceptance.mjs';
import{recordCustomSideRecipientReviewV4}from'./custom-side-accounting-bridge-local-acceptance.mjs';

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${quote(JSON.stringify(value))}::jsonb`;
const participant=n=>`f2430000-0000-4000-8000-${String(n).padStart(12,'0')}`;

function publishCustomSidePoliciesV4({sql,actor,tournamentId,eventId,poolId,setupSidePoolVersionId,definitionVersionId,intent,ratio,policyOperationId,recipientOperationId,disclosureReference}){
 const parse=q=>JSON.parse(sql(q)),request={action:'publish',setupSidePoolVersionId,definitionVersionId,method:'side-custom-graduated-policy-v4',ratio,amountMethod:'graduated-custom-ratio-largest-remainder-5usd-v3',disclosureReference,disclosed:true,intent};
 const accepted=parse(`select public.save_side_custom_policy_v4('${actor}','${tournamentId}','${eventId}','${poolId}',${json(request)},'${policyOperationId}');`);assert.equal(accepted.status,'side_custom_policy_published_v4',JSON.stringify(accepted));
 const recipientRequest={amountPolicyId:accepted.policyId,method:'paid-qualifying-cards-no-cutoff-v3',disclosureReference:'Fictional original paid-card recipient disclosure',disclosed:true};
 const recipient=parse(`select public.publish_side_pool_recipient_policy_v3('${actor}','${tournamentId}','${eventId}','${poolId}',${json(recipientRequest)},'${recipientOperationId}');`);assert.equal(recipient.status,'side_pool_recipient_policy_frozen',JSON.stringify(recipient));return{accepted,recipient};
}

export async function buildManualFinalGenuineFoundationV1({sql,checkpoint=()=>{},onReady=async()=>null,digitalTestIdentities=false,resumeContext=null}){
 assert.equal(typeof digitalTestIdentities,'boolean');
 let seed=foundationV2({structuredSchedule:false,pool1People:Array.from({length:16},(_,i)=>i+1),pool2People:[1],pool1Fee:1000,pool1Type:'Graduated (1-in-6)'});
 if(digitalTestIdentities){
  // Change only the initial fixture INSERT literal, before any roster exists.
  // Never convert an existing/started paper scorecard or bypass link guards.
  const paperLiteral="'test only q entrant '||n,'paper'";
  assert.equal(seed.split(paperLiteral).length-1,1);
  seed=seed.replace(paperLiteral,"'test only q entrant '||n,case when n=1 then'digital'else'paper'end");
 }
 const marker='insert into app.ruleset_versions',at=seed.indexOf(marker);assert.ok(at>0);
 let prefix=seed.slice(0,at),suffix=seed.slice(at);
 prefix=prefix.replace("'Synthetic Qualification','open','open'","'Synthetic Qualification','draft','closed'");
 assert.notEqual(prefix,seed.slice(0,at));if(!resumeContext)sql(prefix+'commit;');

 const parse=statement=>JSON.parse(sql(statement));
 const owner=statement=>parse(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';${statement}`);
 const service=statement=>parse(`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';${statement}`);
 const base=resumeContext?.base??owner(`select app.get_custom_q_setup_base_v2('${tid}');`).base;
 const{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;
 const event=payload.events[0];delete event.sourceStatus;event.clientRowId='e1310000-0000-4000-8000-000000000003';event.displayName='Main';event.gameCount=12;event.entryFeeCents=3000;
 event.qPools=[{poolTypeCode:'Graduated (1-in-7)',entryFeeCents:1000,note:'TEST ONLY Custom Q7'},{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:1000,note:'TEST ONLY qualifying Equal Q'}];
 event.sidePools=[{poolTypeCode:'Custom Side Five',entryFeeCents:1000,note:'TEST ONLY Custom Side5'}];
 const qIntent=createCustomPayoutIntentV1('q',7,{...base,eventClientRowId:event.clientRowId,poolSlot:1});
 const sideIntent=createCustomPayoutIntentV1('side',5,{...base,eventClientRowId:event.clientRowId,poolSlot:1});assert.ok(qIntent&&sideIntent);
 let saved,ids,contextSaved,prepared,activation,binding;
 if(resumeContext){({saved,ids,contextSaved,prepared,activation,binding}=resumeContext);}else{
 const setupOperation=uuid('0c71',1),setupEnvelope={kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,payload,idempotencyKey:setupOperation},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[qIntent,sideIntent]};
 const settingsEnvelope={kind:'event-settings-setup-v3',setup:setupEnvelope,eventSettings:[{eventClientRowId:event.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1('main')}]};
 const pw=readEventPrizeWorkspaceV1(owner(`select app.get_event_prize_workspace_source_v1('${tid}');`),actor,tid);assert(pw);
 const plan=newPlayoffPrizePlanDraftV2();plan.method='equal';plan.recipients='all';plan.rounding={regular:'1',qPool:'5',sidePool:'5'};
 const envelope=buildEventPrizeEnvelopeV1(pw,settingsEnvelope,[{eventClientRowId:event.clientRowId,mode:'proposed_v2',draft:plan}],uuid('0c71',4));assert(envelope);
 saved=owner(`select app.save_event_prize_settings_source_v1('${tid}',${quote(serializeEventPrizeSettingsV1(envelope,pw.base))});`);assert.equal(saved?.result?.status,'accepted',JSON.stringify(saved));
 ids=parse(`select jsonb_build_object('revisionId',r.id,'setupVersion',r.version,'eventVersionId',e.id,'q1Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=1),'q2Id',(select id from app.tournament_setup_q_pool_versions where setup_revision_id=r.id and slot=2),'sideSetupId',(select id from app.tournament_setup_side_pool_versions where setup_revision_id=r.id and slot=1))from app.tournament_setup_revisions r join app.tournament_setup_event_versions e on e.setup_revision_id=r.id and e.client_row_id='${event.clientRowId}'where r.tournament_id='${tid}'order by r.version desc limit 1;`);
 const activationSource=owner(`select app.get_event_settings_activation_source_v4('${tid}');`);assert.equal(activationSource.status,'source_available');
 const contextRequest={kind:'event-rule-context-v1',operationId:uuid('0c71',2),expectedReviewId:null,setupRevisionId:activationSource.setupRevisionId,settingsSnapshotId:activationSource.settingsSnapshotId,eventClientRowId:event.clientRowId,context:{sanctioned:false,eventKind:'main',durationDays:1,originalEntrants:null},reason:'Fictional unsanctioned current Main context',approvalReference:'',confirmed:true};
 contextSaved=owner(`select app.save_event_rule_context_v1('${tid}',${json(contextRequest)});`);assert.equal(contextSaved.status,'context_recorded',JSON.stringify(contextSaved));
 const activationView=readEventPrizeActivationSourceV1(owner(`select app.get_event_prize_activation_source_v1('${tid}');`),actor,tid);assert(activationView);
 const activationEnvelope=buildEventPrizeActivationV1(activationView,uuid('0c71',3));assert(activationEnvelope);const activationRaw=serializeEventPrizeActivationV1(activationEnvelope);
 prepared=owner(`select app.prepare_event_prize_activation_v1('${tid}',${quote(activationRaw)});`);assert.equal(prepared?.preparation?.status,'activation_intent_prepared',JSON.stringify(prepared));
 activation=service(`select app.finalize_event_prize_activation_v1('${actor}','${tid}',${quote(activationRaw)});`);assert.equal(activation?.activation?.status,'event_settings_operationally_activated',JSON.stringify(activation));
 binding=owner(`select jsonb_build_object('bindingId',b.id,'eventId',b.event_id,'activationId',b.activation_id,'setupEventVersionId',b.setup_event_version_id,'rulesetVersionId',a.ruleset_version_id)from app.event_settings_operational_bindings_v1 b join app.tournament_setup_activations a on a.id=b.activation_id where b.tournament_id='${tid}'and b.setup_event_version_id='${ids.eventVersionId}';`);assert(binding);
 checkpoint('genuine_modern_setup_activation',{saved,ids,contextSaved,prepared,activation,binding,providerVerified:false});

 }
 for(const[oldId,newId]of[['e1310000-0000-4000-8000-000000000001',ids.revisionId],['e1310000-0000-4000-8000-000000000002',ids.eventVersionId],['c2430000-0000-4000-8000-000000000001',ids.q1Id],['c2430000-0000-4000-8000-000000000002',ids.q2Id],['11310000-0000-4000-8000-000000000001',binding.eventId]])suffix=suffix.replaceAll(oldId,newId);
 const qPolicyRequest={action:'publish',poolVersionId:ids.q1Id,method:'q-custom-graduated-policy-v5',ratio:7,amountMethod:'graduated-custom-ratio-largest-remainder-5usd-v3',disclosureReference:'TEST ONLY exact Custom Q7 native configured foundation',disclosed:true,intent:qIntent};
 const qPolicyOperation=uuid('0c72',1),oldPolicy={action:'publish',poolVersionId:ids.q1Id,method:'graduated-paid-card-rank-v2',ratio:6,scheduleId:'friend-q-p2-10-6-v1',disclosureReference:'TEST ONLY reviewed policy 1',disclosed:true};
 const oldCall=`select public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify(oldPolicy))},'${uuid('0245',1)}');`,customCall=`set request.jwt.claim.role='service_role';select public.save_q_custom_policy_v5('${actor}','${tid}',${json(qPolicyRequest)},'${qPolicyOperation}');`;assert.ok(suffix.includes(oldCall));suffix=suffix.replace(oldCall,customCall);
 const sideIds=parse(`select jsonb_build_object('poolId',m.pool_id,'definitionVersionId',d.id)from app.tournament_setup_side_pool_materializations m join app.event_side_pool_definition_versions d on d.pool_id=m.pool_id and d.tournament_id=m.tournament_id and d.event_id=m.event_id where m.tournament_id='${tid}'and m.event_id='${binding.eventId}'and m.setup_side_pool_version_id='${ids.sideSetupId}'order by d.version desc limit 1;`);assert.match(sideIds.poolId,/^[a-f0-9-]{36}$/);assert.match(sideIds.definitionVersionId,/^[a-f0-9-]{36}$/);
 const sidePolicies=publishCustomSidePoliciesV4({sql,actor,tournamentId:tid,eventId:binding.eventId,poolId:sideIds.poolId,setupSidePoolVersionId:ids.sideSetupId,definitionVersionId:sideIds.definitionVersionId,intent:sideIntent,ratio:5,legacyOperationId:uuid('0c73',1),policyOperationId:uuid('0c73',2),combinedBlockOperationId:uuid('0c73',3),recipientOperationId:uuid('0c73',4),zeroReviewOperationId:uuid('0c73',5),disclosureReference:'TEST ONLY exact Custom Side5 native configured foundation',combinedEnabled:true});
 const electionSql=Array.from({length:16},(_,index)=>{const n=index+1,request={policyId:sidePolicies.accepted.policyId,participantId:participant(n),electionId:uuid('0c74',n),expectedVersion:0,elected:true,receivedMinor:1000,paymentMethod:'cash',paymentReference:'TEST ONLY synthetic Side receipt',reason:parse(`select to_jsonb(app.selected_step_pool_disclosure_v3((select prize_snapshot_id from app.event_prize_policy_activation_pins_v1 where tournament_id='${tid}'order by created_at desc limit 1),(select prize_digest from app.event_prize_policy_activation_pins_v1 where tournament_id='${tid}'order by created_at desc limit 1),'${sideIds.poolId}','side-sheet',500));`)+'Fictional original Side collection acknowledgment'};return`do $e$declare r jsonb;begin r:=public.save_side_pool_graduated_election_v2('${actor}','${tid}','${binding.eventId}','${sideIds.poolId}',${json(request)},'${uuid('0c75',n)}');if r->>'status'is distinct from'side_pool_election_saved_v2'then raise exception'Side election failed %',r;end if;end$e$;`;}).join('\n');
 let digitalLinkSql='';
 if(digitalTestIdentities){
  const requests=Array.from({length:16},(_,i)=>({rosterEntryId:uuid('d243',i+1),profileId:uuid('a245',i+1),activationId:uuid('0c76',i+1),issueOperationId:uuid('0c77',i+1),redeemOperationId:uuid('0c78',i+1),decisionOperationId:uuid('0c79',i+1)}));
  // Local fictional accounts only: fixed disposable digest, service-only issue,
  // redemption and Director decision. This is not a provider session, physical
  // identity witness or independent human acceptance claim.
  digitalLinkSql=`do $digital_links$declare item jsonb;issued jsonb;redeemed jsonb;approved jsonb;begin
   if exists(select 1 from app.event_play_starts where tournament_id='${tid}')
    or(select count(*)from app.tournament_roster_entries where tournament_id='${tid}'and scorecard_type='digital')<>1
    or exists(select 1 from app.roster_account_links where tournament_id='${tid}')
   then raise exception'Digital test links require sixteen initial digital entries and no start/links';end if;
   perform set_config('request.jwt.claim.role','service_role',true);
   perform set_config('request.jwt.claim.sub','${actor}',true);
   perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub','${actor}')::text,true);
   for item in select value from jsonb_array_elements(${json(requests)})loop
    issued:=public.issue_roster_account_activation_v1('${actor}','${tid}',(item->>'rosterEntryId')::uuid,(item->>'activationId')::uuid,decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),clock_timestamp()+interval '30 minutes',(item->>'issueOperationId')::uuid);
    if issued->>'status'is distinct from'issued'then raise exception'Synthetic digital issue failed %',issued;end if;
    redeemed:=public.redeem_roster_account_activation_v1((item->>'profileId')::uuid,(item->>'activationId')::uuid,decode(repeat('22',32),'hex'),(item->>'redeemOperationId')::uuid);
    if redeemed->>'status'is distinct from'pending'then raise exception'Synthetic digital redemption failed %',redeemed;end if;
    approved:=public.decide_roster_account_activation_v1('${actor}','${tid}',(redeemed->>'requestId')::uuid,'approve',redeemed->>'confirmationPhrase',(item->>'decisionOperationId')::uuid);
    if approved->>'status'is distinct from'approved'then raise exception'Synthetic digital approval failed %',approved;end if;
   end loop;
   if(select count(*)from app.roster_account_links where tournament_id='${tid}')<>16
    or(select count(*)from app.event_participants ep join app.tournament_roster_entries r on r.id=ep.roster_entry_id and r.tournament_id=ep.tournament_id
      join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=ep.profile_id
      where ep.tournament_id='${tid}'and ep.event_id='${binding.eventId}'and r.scorecard_type='digital')<>1
   then raise exception'Synthetic digital links do not match all sixteen participants';end if;
  end$digital_links$;
  commit;begin;set role postgres;`;
 }
 assert.ok(suffix.includes('insert into app.initial_seating_publications'));suffix=suffix.replace('insert into app.initial_seating_publications',electionSql+'\n'+digitalLinkSql+'\ninsert into app.initial_seating_publications');
 if(digitalTestIdentities){
  const rawSeating=`insert into app.initial_seating_publications(tournament_id,table_count,seats_per_table,actor_profile_id,operation_receipt_id)values('${tid}',4,4,'${actor}','c1310000-0000-4000-8000-000000000001');update app.tournaments set registration_status='closed' where id='${tid}';`;
  assert.equal(suffix.split(rawSeating).length-1,1);
  const attendance=Array.from({length:16},(_,i)=>({rosterEntryId:uuid('d243',i+1),operationId:uuid('0c80',i+1)}));
  const seatingSql=`do $supported_seating$declare item jsonb;r jsonb;assignments jsonb;published jsonb;begin
   if exists(select 1 from app.event_play_starts where tournament_id='${tid}')
    or not exists(select 1 from app.tournaments where id='${tid}'and status='open'and registration_status='open')
   then raise exception'Synthetic attendance and seating require open registration before Start';end if;
   perform set_config('request.jwt.claim.role','authenticated',true);
   perform set_config('request.jwt.claim.sub','${actor}',true);
   perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub','${actor}')::text,true);
   for item in select value from jsonb_array_elements(${json(attendance)})loop
    r:=public.record_roster_check_in_event_v2('${tid}',(item->>'rosterEntryId')::uuid,'checked_in','TEST ONLY synthetic attendance before initial seating',(item->>'operationId')::uuid);
    if r->>'status'is distinct from'check_in_recorded'then raise exception'Synthetic check-in failed %',r;end if;
   end loop;
   perform set_config('request.jwt.claim.role','service_role',true);
   perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub','${actor}')::text,true);
   r:=public.close_tournament_registration_v2('${actor}','${tid}','${uuid('0c81',1)}');
   if r->>'status'is distinct from'registration_closed'then raise exception'Synthetic registration close failed %',r;end if;
   if public.close_tournament_registration_v2('${actor}','${tid}','${uuid('0c81',1)}')is distinct from r then raise exception'Synthetic registration-close replay changed';end if;
   select jsonb_agg(jsonb_build_object('rosterEntryId',ep.roster_entry_id,'tableSeat',ep.table_seat)order by ep.table_seat)into assignments
    from app.event_participants ep where ep.tournament_id='${tid}'and ep.event_id='${binding.eventId}';
   if jsonb_array_length(assignments)is distinct from 16 then raise exception'Synthetic seating needs sixteen exact two-key assignments';end if;
   perform set_config('request.jwt.claim.role','authenticated',true);
   perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub','${actor}')::text,true);
   published:=public.publish_initial_seating_v2('${tid}',4::smallint,4::smallint,assignments,'${uuid('0c81',2)}');
   if published->>'status'is distinct from'initial_seating_published'then raise exception'Synthetic supported seating failed %',published;end if;
   if public.publish_initial_seating_v2('${tid}',4::smallint,4::smallint,assignments,'${uuid('0c81',2)}')is distinct from published then raise exception'Synthetic seating replay changed';end if;
  end$supported_seating$;
  commit;begin;set role postgres;`;
  suffix=suffix.replace(rawSeating,seatingSql);
 }
 const prizePin=parse(`select jsonb_build_object('id',p.prize_snapshot_id,'digest',p.prize_digest)from app.event_prize_policy_activation_pins_v1 p join app.event_settings_operational_bindings_v1 b on b.intent_actor_id=p.actor_id and b.intent_operation_id=p.operation_id where b.event_id='${binding.eventId}';`);
 const disclosureCache=new Map();const qDisclosure=n=>{if(disclosureCache.has(n))return disclosureCache.get(n);const value=parse(`select to_jsonb(app.selected_step_pool_disclosure_v3('${prizePin.id}','${prizePin.digest}','${n===1?ids.q1Id:ids.q2Id}','${n===1?'q-graduated':'q-equal'}',500));`);disclosureCache.set(n,value);return value;};
 suffix=suffix.replaceAll("': TEST ONLY acknowledgment'", ":PLACEHOLDER:");
 // Two consent expressions are generated for each entrant, in pool order.
 let consentIndex=0;suffix=suffix.replaceAll(':PLACEHOLDER:',()=>quote(': '+qDisclosure((consentIndex++%2)+1)+'Fictional original collection acknowledgment'));
 const retainedMarker=`insert into app.tournament_roles(tournament_id,profile_id,role) values('${tid}','a1310000-0000-4000-8000-000000000006','co_director');`,retainedAt=suffix.indexOf(retainedMarker);assert.ok(retainedAt>0);suffix=suffix.slice(retainedAt);
 assert.equal(/save_setup_prize_schedule|event_prize_declaration|prize_accounting_(draft|final)/.test(suffix),false);
 sql(`begin;set role postgres;${suffix}`);
 const digitalIdentityProof=parse(`select jsonb_build_object(
  'digitalRosterCount',(select count(*)from app.tournament_roster_entries where tournament_id='${tid}'and scorecard_type='digital'),
  'paperRosterCount',(select count(*)from app.tournament_roster_entries where tournament_id='${tid}'and scorecard_type='paper'),
  'linkCount',(select count(*)from app.roster_account_links where tournament_id='${tid}'),
  'matchingParticipantCount',(select count(*)from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id and l.profile_id=ep.profile_id where ep.tournament_id='${tid}'and ep.event_id='${binding.eventId}'),
  'preStartLinkCount',(select count(*)from app.roster_account_links l join app.event_play_starts p on p.tournament_id=l.tournament_id and p.event_id='${binding.eventId}'where l.tournament_id='${tid}'and l.linked_at<p.started_at),
  'approvedRequestCount',(select count(*)from app.roster_account_activation_requests where tournament_id='${tid}'and state='approved'),
  'approvedEventCount',(select count(*)from app.roster_account_activation_events where tournament_id='${tid}'and event_type='approved'));`);
 assert.deepEqual(digitalIdentityProof,digitalTestIdentities?{digitalRosterCount:1,paperRosterCount:15,linkCount:16,matchingParticipantCount:16,preStartLinkCount:16,approvedRequestCount:16,approvedEventCount:16}:{digitalRosterCount:0,paperRosterCount:16,linkCount:0,matchingParticipantCount:0,preStartLinkCount:0,approvedRequestCount:0,approvedEventCount:0});
 checkpoint('preplay_identity_lifecycle',{digitalTestIdentities,...digitalIdentityProof,initialFixtureOnly:true,supportedPreStartLinkLifecycle:digitalTestIdentities,fictionalIdentities:true,independentHumanWitnessEstablished:false,providerVerified:false});
 let seatingProof=null;
 if(digitalTestIdentities){
  seatingProof=parse(`select jsonb_build_object(
   'assignmentCount',(select count(*)from app.initial_seating_assignments where tournament_id='${tid}'),
   'distinctVerificationIds',(select count(distinct verification_id)from app.initial_seating_assignments where tournament_id='${tid}'),
   'matchingParticipantSeats',(select count(*)from app.event_participants ep join app.initial_seating_assignments s on s.tournament_id=ep.tournament_id and s.roster_entry_id=ep.roster_entry_id and s.initial_table_seat=ep.table_seat and s.verification_id=ep.table_seat where ep.tournament_id='${tid}'and ep.event_id='${binding.eventId}'),
   'preStartAssignmentCount',(select count(*)from app.initial_seating_assignments s join app.event_play_starts p on p.tournament_id=s.tournament_id and p.event_id='${binding.eventId}'where s.tournament_id='${tid}'and s.created_at<p.started_at),
   'checkedInRosterCount',(select count(*)from app.tournament_roster_entries r where r.tournament_id='${tid}'and(select c.check_in_state from app.roster_check_in_events c where c.tournament_id=r.tournament_id and c.roster_entry_id=r.id order by c.version desc limit 1)='checked_in'),
   'publicationCount',(select count(*)from app.initial_seating_publications where tournament_id='${tid}'));`);
  assert.deepEqual(seatingProof,{assignmentCount:16,distinctVerificationIds:16,matchingParticipantSeats:16,preStartAssignmentCount:16,checkedInRosterCount:16,publicationCount:1});
  checkpoint('supported_preplay_seating',{...seatingProof,digitalTestIdentities:true,supportedAttendanceCloseSeating:true,manualFixtureSeats:true,randomSeatMovementEstablished:false,providerVerified:false});
 }

 const qPolicy=publishCustomQPolicyV5({sql,actor,tournamentId:tid,eventId:binding.eventId,poolVersionId:ids.q1Id,operationId:qPolicyOperation,request:qPolicyRequest});
 const collection=parse(`select jsonb_build_object('paidEntrants',(select count(*)from app.q_pool_allocation_versions_v1 where tournament_id='${tid}'),'qCustomPaidEntrants',(select count(*)from app.q_pool_allocation_versions_v1 a cross join lateral jsonb_array_elements(a.request->'pools')p where a.tournament_id='${tid}'and p->>'poolVersionId'='${ids.q1Id}'and(p->>'amountMinor')::integer=1000),'qEqualPaidEntrants',(select count(*)from app.q_pool_allocation_versions_v1 a cross join lateral jsonb_array_elements(a.request->'pools')p where a.tournament_id='${tid}'and p->>'poolVersionId'='${ids.q2Id}'and(p->>'amountMinor')::integer=1000),'sidePaidEntrants',(select count(*)from(select distinct on(participant_id)*from app.event_side_pool_election_versions where pool_id='${sideIds.poolId}'order by participant_id,version desc)e where elected and amount_due_minor=1000 and amount_received_minor=1000),'qualifierCount',(select count(*)from app.qualification_result_rows r join app.qualification_result_versions v on v.id=r.result_version_id where v.event_id='${binding.eventId}'and r.qualification_status='qualified'));`);
 assert.deepEqual(collection,{paidEntrants:16,qCustomPaidEntrants:16,qEqualPaidEntrants:1,sidePaidEntrants:16,qualifierCount:4});
 const qReview=recordCustomQReviewV5({sql,actor,tournamentId:tid,eventId:binding.eventId,poolVersionId:ids.q1Id,operationId:uuid('0c72',2),reason:'TEST ONLY current Custom Q7 native configured review'});assert.equal(qReview.source.obligations.some(row=>row.kind==='refund'),false);
 const sideReview=recordCustomSideRecipientReviewV4({sql,actor,tournamentId:tid,eventId:binding.eventId,poolId:sideIds.poolId,operationId:uuid('0c73',6),reason:'TEST ONLY current Custom Side5 native configured review'});
 const nativePlayoffSource=parse(`select app.selected_step_pool_playoff_source_v3('${actor}','${tid}','${binding.eventId}');`);assert.equal(nativePlayoffSource.status,'source_available',JSON.stringify(nativePlayoffSource));assert.equal(nativePlayoffSource.settingsBindingId,binding.bindingId);assert.equal(nativePlayoffSource.source.activation.ruleset_version_id,binding.rulesetVersionId);
 assert.deepEqual(parse(`select jsonb_build_object('v9Drafts',(select count(*)from app.prize_accounting_drafts_v9 where tournament_id='${tid}'),'v9Finals',(select count(*)from app.prize_accounting_finals_v9 where tournament_id='${tid}'));`),{v9Drafts:0,v9Finals:0});
 const ready={actor,tournamentId:tid,eventId:binding.eventId,binding,ids,intents:{q:qIntent,side:sideIntent},policies:{q:qPolicy,side:sidePolicies},collection,reviews:{q:qReview,side:sideReview},nativePlayoffSource,digitalTestIdentities,digitalIdentityProof,seatingProof,syntheticScheduleScores:true,contextSanctioned:false,legacyFinanceWrites:0,moneyMoved:false,providerVerified:false};
 checkpoint('native_optional_finance_ready',ready);
 const callbackResult=await onReady(structuredClone(ready));
 return{...ready,callbackResult,foundationVersion:'native-optional-finance-foundation-v1'};
}

