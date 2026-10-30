// Disposable LOCAL fictional fixture. Setup/identities/roster/seating are
// explicit direct synthetic baseline; finance, attendance, publication, start,
// every score/confirmation and qualification use the supported RPCs below.
import fs from 'node:fs';
import { oddFieldFixture } from './odd-field-makeup.mjs';
import { deriveOddFieldMakeupPlan } from '../../src/lib/results/odd-field-makeup.ts';
import { uuid, quote } from './q-review-foundation.mjs';

export function makeSeventeenMainFixture(options={}) {
  const withQ=options.withQ!==false;
  if(options.topSeedTie&&withQ)throw Error('The residual qualification tie fixture is no-Q only; no monetary tie policy is inferred.');
  const ns=s=>s.replaceAll('1310000','5210000').replaceAll('2430000','5230000').replaceAll('@test.invalid','-seventeen@test.invalid');
  const actor=ns('a1310000-0000-4000-8000-000000000001'),tid=ns('b1310000-0000-4000-8000-000000000001'),eid=ns('11310000-0000-4000-8000-000000000001');
  const pid=n=>ns(uuid('f243',n)),rid=n=>ns(uuid('d243',n)),uid=n=>uuid('a252',n),pool=n=>ns(uuid('c243',n));
  const f=oddFieldFixture(),plan=deriveOddFieldMakeupPlan(f.regularMatches,f.verificationIds,f.makeupSeats,5,4);
  const request={regularMatches:f.regularMatches,makeupSeats:f.makeupSeats,anchorCount:0,reason:'TEST ONLY zero-anchor twelve distinct sit-outs paired by ACC Manual12.B; synthetic makeup games',reviewed:true};
  const sqlAssert=(expression,status,label)=>`do $fixture$declare r jsonb;begin r:=${expression};if r->>'status'is distinct from'${status}'then raise exception '${label} %',r;end if;end$fixture$;\n`;
  const service=`set role postgres;select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','${actor}',true),set_config('request.jwt.claims','{"role":"service_role","sub":"${actor}"}',true);\n`;
  let seed=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8').replaceAll('generate_series(1,2)','generate_series(1,17)')
    .replace("'A-'||n","chr(65+(n-1)/4)||'-'||(((n-1)%4)+1)")
    .replace("'paper','a1310000", "'digital','a1310000")
    .replace("null,('d2430000", "('a2520000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('d2430000")
    .replace("'Equal',500","'Equal (Pays All Equally)',500").replace("'Graduated',1000","'Equal (Pays All Equally)',1000");
  seed=ns(seed);
  if(!withQ)seed=seed.replace(/insert into app\.tournament_setup_q_pool_versions[\s\S]+?;/,'');
  let setupSql=`begin;${service}`;
  for(let n=1;n<=17;n++)setupSql+=`insert into auth.users(id,email)values('${uid(n)}','seventeen-player-${n}@test.invalid');\n`;
  setupSql+=seed;
  for(let n=1;n<=17;n++)setupSql+=`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${uid(n)}','player');
    insert into app.roster_account_links(tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)
      values('${tid}','${rid(n)}','${uid(n)}','${actor}','${ns('c1310000-0000-4000-8000-000000000001')}');\n`;
  const schedule={kind:'director-selected-five-qualifier-prize-schedule-v2',amountBasis:'total_award',expectedQualifierCount:5,
    sourceReference:'Local fictional 4:3:2:2:1 test weights, not ACC formula',roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion',
    cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2},{bandStart:5,bandEnd:5,weight:1}]};
  setupSql+=sqlAssert(`public.save_setup_prize_schedule_v1('${actor}','${tid}','${ns('e1310000-0000-4000-8000-000000000003')}',${quote(JSON.stringify({expectedVersion:0,schedule,reason:'Local reviewed precollection schedule',reviewed:true}))},'${uuid('b252',1)}')`,'prize_schedule_saved_v1','precollection schedule');
  if(withQ)for(let n=1;n<=2;n++)setupSql+=sqlAssert(`public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify({action:'publish',poolVersionId:pool(n),method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null,disclosureReference:'TEST ONLY equal paid playoff qualifiers '+n,disclosed:true}))},'${uuid('b252',n+1)}')`,'q_policy_published','Q policy');
  setupSql+='commit;';
  let financeSql=`begin;${service}`;
  for(let n=1;n<=17;n++){
    const p1=withQ&&n<=5,p2=withQ&&n===17,amount=3000+(p1?500:0)+(p2?1000:0);
    const consent=i=>`jsonb_build_object('poolVersionId','${pool(i)}','elected',${i===1?p1:p2},'consentReference',case when ${i===1?p1:p2} then 'Q policy '||(select id from app.q_operating_policies_v2 where pool_version_id='${pool(i)}')::text||': TEST ONLY explicit synthetic acknowledgment' else '' end)`;
    if(withQ)financeSql+=sqlAssert(`public.save_q_pool_membership_v1('${actor}','${tid}',jsonb_build_object('action','membership','rosterEntryId','${rid(n)}','expectedVersion',0,'correction',false,'reason','TEST ONLY election','pools',jsonb_build_array(${consent(1)},${consent(2)})),'${uuid('c252',n)}')`,'q_pool_saved','Q membership');
    financeSql+=sqlAssert(`public.set_roster_payment_obligation_v1('${tid}','${rid(n)}',0,${amount},'TEST ONLY no actual money','${uuid('d252',n)}')`,'payment_obligation_saved','amount owed');
    financeSql+=sqlAssert(`public.record_manual_roster_payment('${tid}','${rid(n)}',0,${amount},'USD','cash',now(),'TEST ONLY synthetic receipt, no actual money','${uuid('e252',n)}')`,'payment_recorded','synthetic receipt');
    if(withQ)financeSql+=sqlAssert(`public.save_q_pool_membership_v1('${actor}','${tid}',jsonb_build_object('action','allocation','rosterEntryId','${rid(n)}','expectedVersion',0,'correction',false,'reason','TEST ONLY named pool allocation','membershipVersionId',(select id from app.q_pool_membership_versions_v1 where roster_entry_id='${rid(n)}'),'receiptId',(select id from app.roster_payment_events where roster_entry_id='${rid(n)}'),'obligationVersion',1,'baseMinor',3000,'pools',jsonb_build_array(jsonb_build_object('poolVersionId','${pool(1)}','amountMinor',${p1?500:0}),jsonb_build_object('poolVersionId','${pool(2)}','amountMinor',${p2?1000:0}))),'${uuid('f252',n)}')`,'q_pool_saved','pool allocation');
  }
  financeSql+='commit;';
  let seatingAttendanceSql=`begin;${service}
    insert into app.initial_seating_publications(id,tournament_id,table_count,seats_per_table,actor_profile_id,operation_receipt_id)values('${uuid('1252',1)}','${tid}',5,4,'${actor}','${ns('c1310000-0000-4000-8000-000000000001')}');
    insert into app.initial_seating_assignments(publication_id,tournament_id,roster_entry_id,initial_table_seat)select '${uuid('1252',1)}','${tid}',id,chr(65+((right(id::text,12)::integer)-1)/4)||'-'||((((right(id::text,12)::integer)-1)%4)+1)from app.tournament_roster_entries where tournament_id='${tid}';
    update app.tournaments set registration_status='closed'where id='${tid}';\n`;
  seatingAttendanceSql+=sqlAssert(`public.open_event_check_in_window_v1('${actor}','${tid}','${eid}','${uuid('2252',1)}')`,'event_check_in_opened','open attendance');
  for(let n=1;n<=17;n++)seatingAttendanceSql+=sqlAssert(`public.desk_check_in_event_v1('${actor}','${tid}','${eid}','${rid(n)}','${uuid('2252',n+1)}')`,'checked_in','day attendance');
  seatingAttendanceSql+=sqlAssert(`public.close_event_check_in_window_v1('${actor}','${tid}','${eid}','${uuid('2252',20)}')`,'event_check_in_closed','close attendance')+'commit;';
  const publishSql=`begin;${service}${sqlAssert(`public.publish_odd_field_makeup_schedule_v1('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${uuid('3252',1)}')`,'odd_field_schedule_published','supported makeup publication')}commit;`;
  const startSql=`begin;${service}${sqlAssert(`public.start_event_play_v1('${actor}','${tid}','${eid}',(select id from app.event_schedule_publications where event_id='${eid}'),app.event_participant_snapshot_digest_v1('${eid}'),17,12,true,'${uuid('4252',1)}')`,'event_started','start seventeen')}commit;`;
  const matches=[...f.regularMatches,...plan.makeupMatches].map((m,index)=>{
    const a=f.verificationIds.indexOf(m.sideAVerificationId)+1,b=f.verificationIds.indexOf(m.sideBVerificationId)+1;
    const winner=Math.min(a,b);
    return {...m,index,a,b,winner,margin:options.topSeedTie&&[1,2].includes(winner)?10:10+index%20};
  });
  let scoreSql=`begin;set role postgres;\n`;
  for(const m of matches){
    const lookup=`(select g.id from app.canonical_games g join app.rounds r on r.id=g.round_id where g.event_id='${eid}'and r.round_number=${m.gameNumber} and g.side_a_participant_id='${pid(m.a)}'and g.side_b_participant_id='${pid(m.b)}')`;
    const context=n=>`select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','${uid(n)}',true),set_config('request.jwt.claims','{"role":"authenticated","sub":"${uid(n)}"}',true);\n`;
    for(const [slot,n]of[[1,m.a],[2,m.b]])scoreSql+=context(n)+sqlAssert(`public.submit_game_score(${lookup},'${uuid('5252',m.index*2+slot)}',${slot}::smallint,'${m.winner===m.a?'a':'b'}',${m.margin},'${uuid('6252',m.index*2+slot)}')`,slot===1?'submitted':'confirmation_pending','independent synthetic score');
    for(const [slot,n]of[[1,m.a],[2,m.b]])scoreSql+=context(n)+sqlAssert(`public.confirm_game_score(${lookup},'${uuid('5252',m.index*2+slot)}','${uuid('7252',m.index*2+slot)}')`,slot===1?'confirmation_pending':'verified','independent synthetic confirmation');
  }
  scoreSql+='set constraints all immediate;commit;';
  const finalizeSql=`begin;${service}${sqlAssert(`public.finalize_standard_singles_qualification_v1('${actor}','${tid}','${eid}','${uuid('8252',1)}')`,'qualification_finalized','five qualifier finalization')}commit;`;
  const expected=Array.from({length:17},(_,i)=>({participantId:pid(i+1),number:i+1,verifiedGames:0,gamePoints:0,gamesWon:0,plusPoints:0,minusPoints:0}));
  for(const m of matches){for(const n of[m.a,m.b]){const row=expected[n-1];row.verifiedGames++;if(n===m.winner){row.gamePoints+=2;row.gamesWon++;row.plusPoints+=m.margin;}else row.minusPoints+=m.margin;}}
  expected.sort((a,b)=>b.gamePoints-a.gamePoints||b.gamesWon-a.gamesWon||(b.plusPoints-b.minusPoints)-(a.plusPoints-a.minusPoints)||b.plusPoints-a.plusPoints);
  const fixture={actor,tid,eid,pid,rid,uid,pool,request,matches,expected,setupSql,financeSql,seatingAttendanceSql,publishSql,startSql,scoreSql,finalizeSql};
  if(withQ)return fixture;
  const noQ=s=>s.replaceAll('5210000',options.topSeedTie?'5610000':'5410000').replaceAll('5230000',options.topSeedTie?'5630000':'5430000').replaceAll('2520000',options.topSeedTie?'2560000':'2540000')
    .replaceAll('seventeen-player-',options.topSeedTie?'seventeen-tie-no-q-player-':'seventeen-no-q-player-').replaceAll('-seventeen@test.invalid',options.topSeedTie?'-seventeen-tie-no-q@test.invalid':'-seventeen-no-q@test.invalid');
  return {...fixture,actor:noQ(actor),tid:noQ(tid),eid:noQ(eid),pid:n=>noQ(pid(n)),rid:n=>noQ(rid(n)),uid:n=>noQ(uid(n)),pool:n=>noQ(pool(n)),
    expected:expected.map(r=>({...r,participantId:noQ(r.participantId)})),...Object.fromEntries(['setupSql','financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql'].map(k=>[k,noQ(fixture[k])]))};
}
