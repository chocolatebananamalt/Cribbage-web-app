// Disposable fictional data. Exercise the real setup writer before activation.
import assert from 'node:assert/strict';
export async function verifySetupPrizeSide({sql,read,startSession,prepareLegacy=false,legacy=null}) {
 const actor='a2680000-0000-4000-8000-000000000001',outsider='a2680000-0000-4000-8000-000000000002';
 const id=(prefix,n)=>`${prefix}2680000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb",checks=[];
 const status=(r,s)=>assert.equal(r?.status,s,JSON.stringify(r));
 if(prepareLegacy)sql(`insert into auth.users(id,email)values('${actor}','setup-side-director@test.invalid'),('${outsider}','setup-side-outsider@test.invalid');`);
 const schedule={kind:'regular-prize-cohort-5usd-v3',amountBasis:'total_award',expectedQualifierCount:5,sourceReference:'TEST ONLY explicitly reviewed fictional weights',roundingRule:'automatic-five-dollar-cohort-v3',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2},{bandStart:5,bandEnd:5,weight:1}]};
 const request=(version=0)=>({expectedVersion:version,schedule,reviewed:true,reason:'TEST ONLY precollection declaration'});
 const fresh=(n,{fee=3000,q=1,side=1,games=12,graduated=false}={})=>{
  const tid=id('b',n),row=id('c',n);
  sql(`insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY setup ${n}','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`);
  const payload={tournamentName:`TEST ONLY setup ${n}`,city:'Honolulu',venue:'TEST ONLY Hall \u2014 1 Test Lane \u00b7 96801',venueName:'TEST ONLY Hall',venueStreet:'1 Test Lane',venuePostalCode:'96801',stateTerritory:'Hawaii',startsAt:'2027-02-03T09:00',endsAt:'2027-02-03T18:00',timezone:'Pacific/Honolulu',tournamentDirectorPublicName:'Test Director',tournamentDirectorFirstName:'Test',tournamentDirectorLastName:'Director',tournamentContactPhone:'',tournamentContactEmail:'',tournamentMailingAddress:'',mainSanctioningFeeRateCents:300,consolationSanctioningFeeRateCents:100,mainSanctioningFeeOverrideReason:'',mainSanctioningFeeOverrideReference:'',consolationSanctioningFeeOverrideReason:'',consolationSanctioningFeeOverrideReference:'',officials:[{profileId:actor,role:'director'}],events:[{clientRowId:row,eventKind:'main',displayName:'Main',startsAt:'2027-02-03T09:00',timezone:'Pacific/Honolulu',styleCode:'Standard',formatCode:'standard_singles',gameCount:games,entryFeeCents:fee,feeIncludesNote:'',payoutNote:'',qualificationNote:'',eligibilityNote:'',mugginsStatus:'unset',qPools:Array.from({length:q},(_,i)=>({poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:1000,note:''})),sidePools:Array.from({length:side},(_,i)=>({poolTypeCode:`TEST ONLY Side ${i+1}`,entryFeeCents:1000,note:''}))}]};
  if(graduated){for(const pool of payload.events[0].qPools)pool.poolTypeCode='Graduated (1-in-6)';for(const pool of payload.events[0].sidePools)pool.poolTypeCode='TEST ONLY Graduated Side (1-in-6)';}
  const save=(v=0,p=payload,op=id('d',n))=>{
   // The real API strips Side definitions from the immutable legacy writer,
   // then invokes its existing scoped configuration RPC for this revision.
   const base={...p,events:p.events.map(({sidePools,...e})=>e)};
   const result=read(`select set_config('request.jwt.claim.sub','${actor}',false);select public.save_tournament_setup_version('${tid}',${v},${json(base)},'${op}');`);
   if(result.status==='setup_draft_saved')status(read(`select public.configure_tournament_setup_side_pools_v1('${actor}','${tid}','${result.revisionId}',${json(p.events)});`),'setup_side_pools_configured');
   return result;
  };
  const saved=save();status(saved,'setup_draft_saved');
  const revision=()=>read(`select to_jsonb(id)from app.tournament_setup_revisions where tournament_id='${tid}'order by version desc limit 1;`);
  const declare=(req=request(),op=id('e',n),who=actor)=>read(`select public.save_setup_prize_schedule_v1('${who}','${tid}','${row}',${json(req)},'${op}');`);
  const activate=(op=id('f',n),version=1)=>{
   const result=read(`select public.activate_tournament_setup_v2('${actor}','${tid}','${revision()}',${version},'${op}');`);
   if(result.status==='tournament_setup_activated')status(read(`select public.materialize_tournament_setup_side_pools_v1('${actor}','${tid}','${revision()}');`),'setup_side_pools_materialized');
   return result;
  };
  return {tid,row,payload,save,declare,activate,revision};
 };
 if(prepareLegacy){
  const f=fresh(90,{q:0,side:0});const old={...schedule,kind:'director-selected-five-qualifier-prize-schedule-v2',roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion'};
  status(f.declare({...request(),schedule:old}),'prize_schedule_saved_v1');const activation=f.activate();status(activation,'tournament_setup_activated');
  status(read(`select public.finalize_tournament_setup_and_open_registration_v1('${actor}','${f.tid}','${f.revision()}',1,true,'${id('f',90)}');`),'tournament_setup_activated');
  return {tid:f.tid,revision:f.revision(),activation,eventId:read(`select to_jsonb(event_id)from app.tournament_setup_activations where tournament_id='${f.tid}';`),snapshot:read(`select to_jsonb(md5(jsonb_agg(to_jsonb(b)order by id)::text))from app.event_prize_schedule_bindings_v1 b where tournament_id='${f.tid}';`)};
 }
 assert.ok(legacy);assert.deepEqual(read(`select public.activate_tournament_setup_v2('${actor}','${legacy.tid}','${legacy.revision}',1,'${id('f',90)}');`),legacy.activation);
 assert.equal(read(`select to_jsonb(md5(jsonb_agg(to_jsonb(b)order by id)::text))from app.event_prize_schedule_bindings_v1 b where tournament_id='${legacy.tid}';`),legacy.snapshot);
 checks.push('pre268 nonV3 activation history and exact accepted replay preserved');
 const paid=fresh(1);
 assert.deepEqual(read(`select jsonb_build_array(s.entry_fee_cents,(select entry_fee_cents from app.tournament_setup_q_pool_versions where setup_event_version_id=s.id),(select entry_fee_cents from app.tournament_setup_side_pool_versions where setup_event_version_id=s.id))from app.tournament_setup_event_versions s where tournament_id='${paid.tid}';`),[3000,1000,1000]);
 assert.equal(read(`select public.get_setup_prize_schedule_v1('${actor}','${paid.tid}','${paid.row}');`).settingsCurrent,true);
 const declaration=paid.declare();status(declaration,'prize_schedule_saved_v1');assert.deepEqual(paid.declare(),declaration);
 assert.equal(paid.declare({...request(),reason:'changed'}).code,'idempotency_conflict');
 assert.equal(paid.declare(request(),id('e',101),outsider).code,'not_director');
 assert.equal(read(`select public.save_setup_prize_schedule_v1('${actor}','${paid.tid}','${id('c',999)}',${json(request())},'${id('e',102)}');`).code,'source_unavailable');
 const activation=paid.activate();status(activation,'tournament_setup_activated');assert.deepEqual(paid.activate(),activation);
 assert.equal(read(`select count(*)::integer from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 s on s.id=b.schedule_version_id where b.tournament_id='${paid.tid}'and b.binding_source='activation'and app.valid_regular_prize_schedule_v3(s.schedule_payload);`),1);
 checks.push('public setup persists base3000/Q1000/Side1000, V3 save, binding, replay, authorization and conflict');
 const missing=fresh(2);assert.equal(missing.activate().code,'schedule_revision_required');assert.equal(read(`select count(*)::integer from app.tournament_setup_activations where tournament_id='${missing.tid}';`),0);
 const stale=fresh(3);status(stale.declare(),'prize_schedule_saved_v1');const changed=structuredClone(stale.payload);changed.events[0].entryFeeCents=3500;status(stale.save(1,changed,id('d',103)),'setup_draft_saved');assert.equal(stale.activate(id('f',103),2).code,'schedule_revision_required');
 const nonV3=fresh(4);const old={...schedule,kind:'director-selected-five-qualifier-prize-schedule-v2',roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion'};status(nonV3.declare({...request(),schedule:old}),'prize_schedule_saved_v1');assert.equal(nonV3.activate().code,'schedule_revision_required');
 const free=fresh(5,{fee:0,q:0,side:0});status(free.activate(),'tournament_setup_activated');assert.equal(read(`select count(*)::integer from app.event_prize_schedule_bindings_v1 where tournament_id='${free.tid}';`),0);
 const unsupported=fresh(6,{games:9});assert.equal(unsupported.declare().code,'unsupported_prize_schedule_scope');
 checks.push('missing/stale/nonV3 paid declarations rejected atomically; genuinely free activation allowed; unsupported scope rejected');
 // A real local receipt is intentionally recorded only after declaration/activation.
 const receipt=id('a',201),rid=id('a',202),pid=id('a',205),eid=read(`select to_jsonb(event_id)from app.tournament_setup_activations where tournament_id='${paid.tid}';`);
 sql(`insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('${rid}','${paid.tid}','director_manual','TEST ONLY planned payer','test only planned payer','paper','${actor}',(select operation_receipt_id from app.tournament_setup_revisions where id='${paid.revision()}'));`);
 sql(`insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,status)values('${pid}','${paid.tid}','${eid}','${rid}','registered');`);
 const qp=read(`select to_jsonb(id)from app.tournament_setup_q_pool_versions where tournament_id='${paid.tid}';`);
 const policy=read(`select public.save_q_operating_policy_v2('${actor}','${paid.tid}',${json({action:'publish',poolVersionId:qp,method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null,disclosureReference:'TEST ONLY fictional precollection policy',disclosed:true})},'${id('a',220)}');`);status(policy,'q_policy_published');
 const qPolicyId=read(`select to_jsonb(id)from app.q_operating_policies_v2 where pool_version_id='${qp}';`);
 status(read(`select public.save_q_pool_membership_v1('${actor}','${paid.tid}',${json({action:'membership',rosterEntryId:rid,expectedVersion:0,correction:false,reason:'TEST ONLY explicit Q election',pools:[{poolVersionId:qp,elected:true,consentReference:`Q policy ${qPolicyId}: TEST ONLY disclosed acknowledgment`}]})},'${id('a',221)}');`),'q_pool_saved');
 status(read(`select set_config('request.jwt.claim.sub','${actor}',false);select public.set_roster_payment_obligation_v1('${paid.tid}','${rid}',0,4000,'TEST ONLY base30 Q10','${receipt}');`),'payment_obligation_saved');
 status(read(`select public.record_manual_roster_payment('${paid.tid}','${rid}',0,4000,'USD','cash',now(),'TEST ONLY fictional receipt, no actual money','${id('a',203)}');`),'payment_recorded');
 status(read(`select public.save_q_pool_membership_v1('${actor}','${paid.tid}',jsonb_build_object('action','allocation','rosterEntryId','${rid}','expectedVersion',0,'correction',false,'reason','TEST ONLY separate base30 Q10 allocation','membershipVersionId',(select id from app.q_pool_membership_versions_v1 where roster_entry_id='${rid}'),'receiptId',(select id from app.roster_payment_events where roster_entry_id='${rid}'),'obligationVersion',1,'baseMinor',3000,'pools',jsonb_build_array(jsonb_build_object('poolVersionId','${qp}','amountMinor',1000))),'${id('a',222)}');`),'q_pool_saved');
 assert.equal(paid.declare(request(1),id('e',204)).code,'schedule_revision_closed');assert.deepEqual(paid.declare(),declaration);
 checks.push('planned base/Q receipt after activation closes new declarations while accepted replay remains exact');
 const sidePool=read(`select to_jsonb(pool_id)from app.tournament_setup_side_pool_materializations where tournament_id='${paid.tid}';`);

 status(read(`select public.set_event_side_pool_election_v1('${actor}','${paid.tid}','${eid}','${sidePool}','${pid}','${id('a',206)}',true,1000,'cash','TEST ONLY synthetic receipt','TEST ONLY fictional Side receipt','${id('a',207)}');`),'side_pool_election_recorded');
 assert.deepEqual(read(`select jsonb_build_array((select amount_minor from app.roster_payment_events where roster_entry_id='${rid}'),(select amount_received_minor from app.event_side_pool_election_versions where participant_id='${pid}'));`),[4000,1000]);
 const sideOnly=fresh(8,{q:0});status(sideOnly.declare(),'prize_schedule_saved_v1');status(sideOnly.activate(),'tournament_setup_activated');
 const se=read(`select to_jsonb(event_id)from app.tournament_setup_activations where tournament_id='${sideOnly.tid}';`),sp=read(`select to_jsonb(pool_id)from app.tournament_setup_side_pool_materializations where tournament_id='${sideOnly.tid}';`),sr=id('a',208),si=id('a',209);
 sql(`insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('${sr}','${sideOnly.tid}','director_manual','TEST ONLY Side voter','test only side voter','paper','${actor}',(select operation_receipt_id from app.tournament_setup_revisions where id='${sideOnly.revision()}'));insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,status)values('${si}','${sideOnly.tid}','${se}','${sr}','registered');`);
 status(read(`select public.set_event_side_pool_election_v1('${actor}','${sideOnly.tid}','${se}','${sp}','${si}','${id('a',210)}',true,0,'cash','','TEST ONLY unpaid Side election','${id('a',211)}');`),'side_pool_election_recorded');
 assert.equal(sideOnly.declare(request(1),id('e',212)).code,'schedule_revision_closed');
 checks.push('separate planned Side1000 receipt persisted; Side-only unpaid election closes declarations before any roster receipt');
 // Observe the actual tournament row lock, rather than merely simultaneous calls.
 const race=fresh(7),tag='setup_prize_side_race';
 const a=startSession(`begin;select 1 from app.tournaments where id='${race.tid}'for update;select pg_sleep(1);commit;`,tag+'_a');
 await new Promise(r=>setTimeout(r,100));
 const b=startSession(`select public.save_setup_prize_schedule_v1('${actor}','${race.tid}','${race.row}',${json(request())},'${id('e',7)}');`,tag+'_b');
 let observed=false;for(let i=0;i<20;i++){if(read(`select exists(select 1 from pg_stat_activity where application_name='${tag}_b'and wait_event_type='Lock');`)){observed=true;break;}await new Promise(r=>setTimeout(r,30));}
 const outputs=await Promise.all([a.done,b.done]);assert.ok(observed,'actual tournament row wait');status(JSON.parse(outputs[1].split('\n').filter(x=>x.startsWith('{')).at(-1)),'prize_schedule_saved_v1');
 checks.push('independent SQL session observed waiting on tournament serialization');
 const sideRace=startSession(`begin;select public.set_event_side_pool_election_v1('${actor}','${sideOnly.tid}','${se}','${sp}','${si}','${id('a',210)}',true,1000,'cash','TEST ONLY synthetic Side payment','TEST ONLY Side receipt serialization','${id('a',230)}');select pg_sleep(1);commit;`,tag+'_side');
 await new Promise(r=>setTimeout(r,100));
 const scheduleRace=startSession(`select public.save_setup_prize_schedule_v1('${actor}','${sideOnly.tid}','${sideOnly.row}',${json(request(1))},'${id('e',231)}');`,tag+'_schedule');
 observed=false;for(let i=0;i<20;i++){if(read(`select exists(select 1 from pg_stat_activity where application_name='${tag}_schedule'and wait_event_type='Lock');`)){observed=true;break;}await new Promise(r=>setTimeout(r,30));}
 const sideOutputs=await Promise.all([sideRace.done,scheduleRace.done]);assert.ok(observed,'legacy Side receipt locks schedule save');
 status(JSON.parse(sideOutputs[0].split('\n').filter(x=>x.startsWith('{')).at(-1)),'side_pool_election_recorded');assert.equal(JSON.parse(sideOutputs[1].split('\n').filter(x=>x.startsWith('{')).at(-1)).code,'schedule_revision_closed');
 checks.push('public legacy Side receipt versus schedule revision race observed and rejected after collection');
 const replacement=read(`select public.change_event_lifecycle_v1('${actor}','${legacy.tid}','${legacy.eventId}','replace','TEST ONLY reviewed historical replacement','${id('a',290)}');`);
 status(replacement,'event_replaced');
 assert.equal(read(`select s.schedule_payload->>'kind'from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 s on s.id=b.schedule_version_id where b.event_id='${replacement.replacementEventId}';`.replace("select s.schedule_payload->>'kind'","select to_jsonb(s.schedule_payload->>'kind')")),'director-selected-five-qualifier-prize-schedule-v2');
 assert.equal(read(`select to_jsonb(md5(jsonb_agg(to_jsonb(b)order by id)::text))from app.event_prize_schedule_bindings_v1 b where event_id='${legacy.eventId}';`),legacy.snapshot);
 checks.push('public historical event replacement keeps nonV3 declaration and original binding history');
 const exactScenarios=[];
 for(const withPools of[false,true]){
  const number=withPools?17:16,f=fresh(number,{q:withPools?1:0,side:withPools?1:0,graduated:withPools});
  const before=read(`select jsonb_build_object('baseFeeMinor',s.entry_fee_cents,'qFees',(select coalesce(jsonb_agg(entry_fee_cents order by slot),'[]')from app.tournament_setup_q_pool_versions where setup_event_version_id=s.id),'sideFees',(select coalesce(jsonb_agg(entry_fee_cents order by slot),'[]')from app.tournament_setup_side_pool_versions where setup_event_version_id=s.id))from app.tournament_setup_event_versions s where tournament_id='${f.tid}';`);
  assert.deepEqual(before,{baseFeeMinor:3000,qFees:withPools?[1000]:[],sideFees:withPools?[1000]:[]});
  status(f.declare(),'prize_schedule_saved_v1');status(f.activate(),'tournament_setup_activated');
  const event=read(`select to_jsonb(event_id)from app.tournament_setup_activations where tournament_id='${f.tid}';`);
  assert.deepEqual(read(`select jsonb_build_array((select count(*)from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 s on s.id=b.schedule_version_id where b.tournament_id='${f.tid}'and app.valid_regular_prize_schedule_v3(s.schedule_payload)and s.settings_fingerprint=app.prize_schedule_settings_fingerprint_v1(app.prize_schedule_settings_v1('${f.tid}',b.client_row_id))),(select count(*)from app.roster_payment_events where tournament_id='${f.tid}'),(select count(*)from app.q_pool_membership_versions_v1 where tournament_id='${f.tid}'),(select count(*)from app.event_side_pool_election_versions where tournament_id='${f.tid}'),(select count(*)from app.canonical_games where tournament_id='${f.tid}'));`),[1,0,0,0,0]);
  // Same fictional roster/participant foundation pattern as seventeen-main;
  // no setup, policy, election, payment or allocation is seeded directly.
  const roster=n=>id('a',number*1000+n),participant=n=>id('b',number*1000+n),op=n=>id('c',number*1000+n);
  let seed='begin;';for(let n=1;n<=17;n++)seed+=`insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('${roster(n)}','${f.tid}','director_manual','TEST ONLY scenario ${number} player ${n}','test only scenario ${number} player ${n}','paper','${actor}',(select operation_receipt_id from app.tournament_setup_revisions where id='${f.revision()}'));insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,status)values('${participant(n)}','${f.tid}','${event}','${roster(n)}','registered');`;
  sql(seed+'set constraints all immediate;commit;');
  assert.deepEqual(read(`select jsonb_build_array((select count(*)from app.tournament_roster_entries where tournament_id='${f.tid}'),(select count(*)from app.event_participants where tournament_id='${f.tid}'));`),[17,17]);
  let pool=null,qPolicy=null,side=null,sidePolicy=null;
  if(withPools){
   pool=read(`select to_jsonb(id)from app.tournament_setup_q_pool_versions where tournament_id='${f.tid}';`);
   const qRequest={action:'publish',poolVersionId:pool,method:'acc-weighted-largest-remainder-5usd-v1',ratio:6,scheduleId:'acc-weighted-largest-remainder-5usd-v1',disclosureReference:'TEST ONLY selected graduated 1-in-6 exact planned scenario',disclosed:true};
   status(read(`select public.save_q_operating_policy_v3('${actor}','${f.tid}',${json(qRequest)},'${op(100)}');`),'q_policy_published');
   qPolicy=read(`select to_jsonb(id)from app.q_operating_policies_v2 where pool_version_id='${pool}'and method='acc-weighted-largest-remainder-5usd-v1'and ratio=6;`);assert.ok(qPolicy);
   side=read(`select to_jsonb(pool_id)from app.tournament_setup_side_pool_materializations where tournament_id='${f.tid}';`);
   const definition=read(`select to_jsonb(id)from app.event_side_pool_definition_versions where pool_id='${side}';`);
   const amount=read(`select public.save_side_pool_graduated_policy_v2('${actor}','${f.tid}','${event}','${side}',${json({method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio:6,definitionVersionId:definition,disclosureReference:'TEST ONLY selected graduated Side 1-in-6 before all elections',disclosed:true})},'${op(101)}');`);status(amount,'side_pool_graduated_policy_frozen');sidePolicy=amount.policyId;
   status(read(`select public.publish_side_pool_recipient_policy_v3('${actor}','${f.tid}','${event}','${side}',${json({amountPolicyId:sidePolicy,method:'paid-qualifying-cards-no-cutoff-v3',disclosureReference:'TEST ONLY paid qualifying cards independently ranked before all elections',disclosed:true})},'${op(102)}');`),'side_pool_recipient_policy_frozen');
   assert.deepEqual(read(`select jsonb_build_array((select count(*)from app.roster_payment_events where tournament_id='${f.tid}'),(select count(*)from app.q_pool_membership_versions_v1 where tournament_id='${f.tid}'),(select count(*)from app.event_side_pool_election_versions where tournament_id='${f.tid}'));`),[0,0,0]);
  }
  const check=(expression,expected)=>`do $planned$declare result jsonb;begin result:=${expression};if result->>'status'is distinct from'${expected}'then raise exception 'planned scenario ${number}: %',result;end if;end$planned$;`;
  let finance=`begin;set request.jwt.claim.sub='${actor}';`;
  for(let n=1;n<=17;n++){
   if(withPools)finance+=check(`public.save_q_pool_membership_v1('${actor}','${f.tid}',${json({action:'membership',rosterEntryId:roster(n),expectedVersion:0,correction:false,reason:'TEST ONLY explicit planned Q election',pools:[{poolVersionId:pool,elected:true,consentReference:`Q policy ${qPolicy}: TEST ONLY selected graduated 1-in-6 acknowledgment`}]})},'${op(200+n)}')`,'q_pool_saved');
   finance+=check(`public.set_roster_payment_obligation_v1('${f.tid}','${roster(n)}',0,${withPools?4000:3000},'TEST ONLY planned obligation, no actual money','${op(300+n)}')`,'payment_obligation_saved');
   finance+=check(`public.record_manual_roster_payment('${f.tid}','${roster(n)}',0,${withPools?4000:3000},'USD','cash',now(),'TEST ONLY planned synthetic receipt, no actual money','${op(400+n)}')`,'payment_recorded');
   if(withPools){
    finance+=check(`public.save_q_pool_membership_v1('${actor}','${f.tid}',jsonb_build_object('action','allocation','rosterEntryId','${roster(n)}','expectedVersion',0,'correction',false,'reason','TEST ONLY separate base30 Q10 planned allocation','membershipVersionId',(select id from app.q_pool_membership_versions_v1 where roster_entry_id='${roster(n)}'),'receiptId',(select id from app.roster_payment_events where roster_entry_id='${roster(n)}'),'obligationVersion',1,'baseMinor',3000,'pools',jsonb_build_array(jsonb_build_object('poolVersionId','${pool}','amountMinor',1000))),'${op(500+n)}')`,'q_pool_saved');
    finance+=check(`public.save_side_pool_graduated_election_v2('${actor}','${f.tid}','${event}','${side}',${json({policyId:sidePolicy,participantId:participant(n),electionId:op(600+n),expectedVersion:0,elected:true,receivedMinor:1000,paymentMethod:'cash',paymentReference:'TEST ONLY planned synthetic Side receipt',reason:'TEST ONLY explicit selected policy acknowledgment, no actual money'})},'${op(700+n)}')`,'side_pool_election_saved_v2');
   }
  }
  sql(finance+'set constraints all immediate;commit;');
  const totals=read(`select jsonb_build_object('rosterCount',(select count(*)from app.tournament_roster_entries where tournament_id='${f.tid}'),'participantCount',(select count(*)from app.event_participants where tournament_id='${f.tid}'),'receiptCount',(select count(*)from app.roster_payment_events where tournament_id='${f.tid}'),'receiptMinor',(select sum(amount_minor)from app.roster_payment_events where tournament_id='${f.tid}'),'membershipCount',(select count(*)from app.q_pool_membership_versions_v1 where tournament_id='${f.tid}'),'allocationCount',(select count(*)from app.q_pool_allocation_versions_v1 where tournament_id='${f.tid}'),'baseAllocatedMinor',(select coalesce(sum((request->>'baseMinor')::bigint),0)from app.q_pool_allocation_versions_v1 where tournament_id='${f.tid}'),'qAllocatedMinor',(select coalesce(sum((p->>'amountMinor')::bigint),0)from app.q_pool_allocation_versions_v1 a cross join lateral jsonb_array_elements(a.request->'pools')p where a.tournament_id='${f.tid}'),'sideElectionCount',(select count(*)from app.event_side_pool_election_versions where tournament_id='${f.tid}'),'sideReceivedMinor',(select coalesce(sum(amount_received_minor),0)from app.event_side_pool_election_versions where tournament_id='${f.tid}'),'scoreCount',(select count(*)from app.canonical_games where tournament_id='${f.tid}'));`);
  assert.deepEqual(totals,{rosterCount:17,participantCount:17,receiptCount:17,receiptMinor:withPools?68000:51000,membershipCount:withPools?17:0,allocationCount:withPools?17:0,baseAllocatedMinor:withPools?51000:0,qAllocatedMinor:withPools?17000:0,sideElectionCount:withPools?17:0,sideReceivedMinor:withPools?17000:0,scoreCount:0});
  assert.equal(totals.receiptMinor+totals.sideReceivedMinor,withPools?85000:51000);
  assert.equal(read(`select count(*)::integer from app.roster_payment_events where tournament_id='${f.tid}'and amount_minor=${withPools?4000:3000};`),17);
  if(withPools)assert.equal(read(`select count(*)::integer from app.event_side_pool_election_versions where tournament_id='${f.tid}'and elected and amount_due_minor=1000 and amount_received_minor=1000;`),17);
  exactScenarios.push({tournamentId:f.tid,eventId:event,fees:before,...totals,totalMinor:totals.receiptMinor+totals.sideReceivedMinor,actualMoneyMoved:false});
  checks.push(withPools?'exact 17-player graduated 1-in-6 Q+Side: 68000 base/Q receipts, 51000 base + 17000 Q allocation, separate 17000 Side receipts = 85000; V3 and policies precede collection':'exact 17-player NoQ: base30 saved and V3 bound before 17 receipts totaling51000; no Q/Side/scoring');
 }
 return {checks,eventId:eid,exactScenarios,actualMoneyMoved:false};
}
