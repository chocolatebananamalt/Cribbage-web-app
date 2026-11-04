// Disposable local fixture only: all identities, cards and money are synthetic.
import {foundationV2} from './q-v2-foundation.mjs';
import {twentyPlayerMultiPoolPlan} from './twenty-player-multi-pool-plan.mjs';
import {uuid} from './q-review-foundation.mjs';

export const actor='a1310000-0000-4000-8000-000000000001';
export const tid='b1310000-0000-4000-8000-000000000001';
export const main='11310000-0000-4000-8000-000000000001';
export const cons='11310000-0000-4000-8000-000000000002';

export function mainSeed() {
 const plan=twentyPlayerMultiPoolPlan();
 const number=s=>Number(s.slice(-2));
 const games=plan.matches.map(m=>({round:m.gameNumber,a:number(m.a),b:number(m.b),winner:number(m.winner),margin:m.spreadPoints,aSeat:m.sideATableSeat,bSeat:m.sideBTableSeat}));
 let sql=foundationV2({structuredSchedule:true,games});
 sql=sql.replaceAll('generate_series(1,16)','generate_series(1,20)')
  .replace(`values('${tid}',4,4,'${actor}'`, `values('${tid}',5,4,'${actor}'`)
  .replace("'director_entry',12,16,96,", "'director_entry',12,20,120,")
  .replace("'),16,12,96,", "'),20,12,120,")
  .replace('director-selected-prize-schedule-v1','regular-prize-cohort-5usd-v3')
  .replace('floor_each_weighted_share_then_assign_remainder_to_champion','automatic-five-dollar-cohort-v3')
  .replace('"expectedQualifierCount":4','"expectedQualifierCount":5')
  .replace('{"bandStart":3,"bandEnd":4,"weight":2}]','{"bandStart":3,"bandEnd":4,"weight":2},{"bandStart":5,"bandEnd":5,"weight":1}]');
 // Add the four extra account bindings before the game rows are inserted.
 let extra='';
 for(let i=17;i<=20;i++)extra+=`insert into auth.users(id,email)values('${uuid('a245',i)}','fixture-0278-${i}@test.invalid');update app.event_participants set profile_id='${uuid('a245',i)}' where id='${uuid('f243',i)}';`;
 sql=sql.replace('insert into app.initial_seating_publications',extra+'insert into app.initial_seating_publications');
 return sql;
}

export function consolationSeed(entrants,gameCount=8,synthetic=false) {
 if(![12,14].includes(entrants.length))throw Error('Synthetic fixture expects 12 or 14 entrants');
 if(![7,8,9,10].includes(gameCount))throw Error('Unsupported synthetic game count');
 const count=entrants.length,perRound=count/2;
 const receipt='c1310000-0000-4000-8000-000000000001',rev='e1310000-0000-4000-8000-000000000001';
 const setup=uuid('e278',1),rule=uuid('f278',1),activation=uuid('2278',1),pub=uuid('7278',1);
 let sql=`begin;set role postgres;set local request.jwt.claim.role='service_role';
 insert into app.tournament_setup_event_versions(id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,style_code,format_code,game_count,entry_fee_cents,muggins_status) values('${setup}','${tid}','${rev}','${uuid('e278',2)}',2,'consolation','TEST ONLY Consolation','2026-10-03 14:00','Pacific/Honolulu','Standard','standard_singles',${gameCount},1000,'unset');
 insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values('${rule}','${tid}','TEST ONLY ACC rules','standard_singles','ACC Official Tournament Rules 2025','2025-01-01',now());
 insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)values('${cons}','${tid}','${rule}','TEST ONLY Consolation','consolation','standard_singles','digital');
 insert into app.tournament_setup_activations(id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id)values('${activation}','${tid}','${rev}','${setup}','${rule}','${cons}','${actor}','${receipt}');`;
 entrants.forEach((p,i)=>{const roster=p.roster_entry_id?`'${p.roster_entry_id}'`:'null';sql+=`insert into app.event_participants(id,tournament_id,event_id,profile_id,roster_entry_id,table_seat,status)values('${uuid('f278',i+1)}','${tid}','${cons}','${p.profile_id}',${roster},'A-${i+1}','checked_in');`;});
 sql+=`insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)values('${pub}','${tid}','${cons}','director_entry',${gameCount},${count},${gameCount*perRound},repeat('7',64),'${actor}','${receipt}');`;
 for(let i=1;i<=gameCount;i++)sql+=`insert into app.rounds(id,tournament_id,event_id,round_number)values('${uuid('5278',i)}','${tid}','${cons}',${i});`;
 sql+=`insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values('${uuid('c278',1)}','${tid}','${actor}','local_consolation_start_fixture','${cons}',repeat('1',64),'${uuid('d278',1)}','accepted','{}',now());
 insert into app.event_play_starts(tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,operation_receipt_id,start_source)values('${tid}','${cons}','${pub}',app.event_participant_snapshot_digest_v1('${cons}'),${count},${gameCount},${gameCount*perRound},'${actor}','${uuid('c278',1)}','official');`;
 let circle=Array.from({length:count},(_,i)=>i),j=0;
 for(let round=1;round<=gameCount;round++){
  for(let k=0;k<perRound;k++){
   const a=circle[k],b=circle[count-1-k],awin=a<b,margin=10+((round*17+a*7+b*11)%20),g=uuid('6278',++j),pa=uuid('f278',a+1),pb=uuid('f278',b+1),aSeat=`${String.fromCharCode(65+Math.floor(k/2))}-${k%2*2+1}`,bSeat=`${String.fromCharCode(65+Math.floor(k/2))}-${k%2*2+2}`;
   sql+=`insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version,winner_side,margin)values('${g}','${tid}','${cons}','${uuid('5278',round)}',1,'${pa}','${pb}','${aSeat}','${bSeat}','verified',1,'${awin?'a':'b'}',${margin});
   insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest)values('${uuid('b278',j*2-1)}','${tid}','${cons}','${g}','${entrants[a].profile_id}','${pa}',1,'${awin?'a':'b'}',${margin},'manual',repeat('1',64)),('${uuid('b278',j*2)}','${tid}','${cons}','${g}','${entrants[b].profile_id}','${pb}',2,'${awin?'a':'b'}',${margin},'manual',repeat('1',64));
   insert into app.score_confirmations(tournament_id,event_id,canonical_game_id,submission_id,submission_actor_id,confirmation_actor_id,confirmation_kind)values('${tid}','${cons}','${g}','${uuid('b278',j*2-1)}','${entrants[a].profile_id}','${entrants[b].profile_id}','player'),('${tid}','${cons}','${g}','${uuid('b278',j*2)}','${entrants[b].profile_id}','${entrants[a].profile_id}','player');
   insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number)values('${pub}','${tid}','${cons}','${g}',${j});
   insert into app.card_scorelines(id,tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points)values('${uuid('8278',j*2-1)}','${tid}','${cons}','${g}','${pa}','${pb}','a','${aSeat}',${awin},${margin},${awin?margin:0},${awin?0:margin},${awin?2:0}),('${uuid('8278',j*2)}','${tid}','${cons}','${g}','${pb}','${pa}','b','${bSeat}',${!awin},${margin},${awin?0:margin},${awin?margin:0},${awin?0:2});`;
  }
  circle=[circle[0],circle[count-1],...circle.slice(1,count-1)];
 }
 // The pre-enrollment scorelines are deliberately legacy synthetic fixture rows,
 // not structured synthetic paper-card proof or independent-human evidence.
 if(synthetic)sql+=`insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','TEST ONLY disposable isolated fixture') on conflict do nothing;insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${cons}','${tid}','nnhcnvksxgxnpvdqjgpg','TEST ONLY disposable isolated fixture');`;
 sql+=`select public.finalize_standard_singles_qualification_v1('${actor}','${tid}','${cons}','${uuid('9278',1)}');commit;`;
 return sql;
}

