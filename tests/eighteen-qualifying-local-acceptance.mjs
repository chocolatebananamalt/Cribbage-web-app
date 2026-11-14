// LOCAL synthetic compatibility proof, not a random draw or ACC movement certification.
import assert from 'node:assert/strict';
import {makeSeventeenMainFixture} from './fixtures/seventeen-main-foundation.mjs';
import {uuid,quote} from './fixtures/q-review-foundation.mjs';
import {validateScheduleForEvent} from '../src/lib/api/event-schedule.ts';
export function eighteenFixture(){
 const f=makeSeventeenMainFixture({withQ:false});
 let ring=Array.from({length:18},(_,i)=>i+1);const raw=[];
 for(let round=1;round<=12;round++){
  for(let board=0;board<9;board++)raw.push({gameNumber:round,a:ring[board],b:ring[17-board],board});
  ring=[ring[0],ring[17],...ring.slice(1,17)];
 }
 // Relabel initial circle pairings into actual first-round seats; one stationary
 // anchor is the unchanged first ring position. This is a candidate schedule.
 const seat=n=>`${String.fromCharCode(65+Math.floor((n-1)/4))}-${(n-1)%4+1}`;
 const initial=new Map();for(const m of raw.filter(m=>m.gameNumber===1)){initial.set(m.a,m.board*2+1);initial.set(m.b,m.board*2+2);}
 const matches=raw.map(m=>({gameNumber:m.gameNumber,sideAVerificationId:seat(initial.get(m.a)),sideBVerificationId:seat(initial.get(m.b)),sideATableSeat:seat(m.board*2+1),sideBTableSeat:seat(m.board*2+2)}));
 const pairKeys=matches.map(m=>[m.sideAVerificationId,m.sideBVerificationId].sort().join(':'));
 assert.equal(new Set(pairKeys).size,108);
 const participants=Array.from({length:18},(_,i)=>({verificationId:seat(i+1)}));
 assert.deepEqual(validateScheduleForEvent(matches,12,participants.map(p=>p.verificationId),5,4),[]);
 const receipt='c5410000-0000-4000-8000-000000000001';
 f.setupSql=f.setupSql.replace('begin;',`begin;insert into auth.users(id,email)values('${f.uid(18)}','eighteen-player-18@test.invalid');`).replaceAll('generate_series(1,17)','generate_series(1,18)');
 const extra=`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${f.uid(18)}','player');insert into app.roster_account_links(tournament_id,roster_entry_id,profile_id,actor_profile_id,operation_receipt_id)values('${f.tid}','${f.rid(18)}','${f.uid(18)}','${f.actor}','${receipt}');`;
 f.setupSql=f.setupSql.replace(/commit;$/,extra+'commit;');
 f.financeSql=f.financeSql.replace(/commit;$/,`select public.set_roster_payment_obligation_v1('${f.tid}','${f.rid(18)}',0,3000,'TEST ONLY synthetic no real money','${uuid('d254',18)}');select public.record_manual_roster_payment('${f.tid}','${f.rid(18)}',0,3000,'USD','cash',now(),'TEST ONLY synthetic no real money','${uuid('e254',18)}');commit;`);
 const closeAnchor='do $fixture$declare r jsonb;begin r:=public.close_event_check_in_window_v1';
 assert.ok(f.seatingAttendanceSql.includes(closeAnchor));
 f.seatingAttendanceSql=f.seatingAttendanceSql.replace(closeAnchor,`select public.desk_check_in_event_v1('${f.actor}','${f.tid}','${f.eid}','${f.rid(18)}','${uuid('2293',18)}');`+closeAnchor);
 f.publishSql=`begin;set role postgres;set request.jwt.claim.role='service_role';select public.publish_director_reviewed_event_schedule_v1('${f.actor}','${f.tid}','${f.eid}',${quote(JSON.stringify(matches))}::jsonb,true,'${uuid('3293',1)}');commit;`;
 f.startSql=f.startSql.replace(',17,12,true',',18,12,true');
 return{...f,matches,seat};
}
export async function verifyEighteenQualifying({sql,read,preparedSetup=false}){
 const f=eighteenFixture();for(const key of [...(preparedSetup?[]:['setupSql']),'financeSql','seatingAttendanceSql','publishSql','startSql'])sql(f[key]);
 const games=read(`select jsonb_agg(jsonb_build_object('id',g.id,'round',r.round_number,'a',g.side_a_participant_id,'b',g.side_b_participant_id)order by r.round_number,g.side_a_table_seat_snapshot)from app.canonical_games g join app.rounds r on r.id=g.round_id where g.event_id='${f.eid}';`);
 assert.equal(games.length,108);const expected=new Map(Array.from({length:18},(_,i)=>[f.pid(i+1),{games:0,gamePoints:0,plus:0,minus:0}]));
 const seen=new Set();const margins=[1,31,61,91];
 for(const [index,g]of games.entries()){
  const pair=[g.a,g.b].sort().join(':');assert.ok(!seen.has(pair));seen.add(pair);
  const win=g.a<g.b?'a':'b',margin=margins[index%4];
  for(const [slot,p]of [[1,g.a],[2,g.b]]){
   const n=Number(p.slice(-12));const sub=uuid('5293',index*2+slot);
   const result=read(`select public.submit_game_score('${g.id}','${sub}',${slot}::smallint,'${win}',${margin},'${uuid('6293',index*2+slot)}');`,f.uid(n),'authenticated');assert.equal(result.status,slot===1?'submitted':'confirmation_pending');
  }
  for(const [slot,p]of [[1,g.a],[2,g.b]]){const result=read(`select public.confirm_game_score('${g.id}','${uuid('5293',index*2+slot)}','${uuid('7293',index*2+slot)}');`,f.uid(Number(p.slice(-12))),'authenticated');assert.equal(result.status,slot===1?'confirmation_pending':'verified');}
  for(const [side,p]of [['a',g.a],['b',g.b]]){const row=expected.get(p);row.games++;if(side===win){row.gamePoints+=margin>30?3:2;row.plus+=margin;}else row.minus+=margin;}
 }
 const totals=read(`select jsonb_agg(to_jsonb(t))from(select participant_id id,count(*) games,sum(game_points) points,sum(plus_points) plus,sum(minus_points) minus from app.card_scorelines where event_id='${f.eid}'group by participant_id)t;`);
 for(const row of totals){const e=expected.get(row.id);assert.equal(row.games,12);assert.equal(row.points,e.gamePoints);assert.equal(row.plus,e.plus);assert.equal(row.minus,e.minus);}
 const q=read(`select public.finalize_standard_singles_qualification_v1('${f.actor}','${f.tid}','${f.eid}','${uuid('8293',1)}');`);assert.equal(q.status,'qualification_finalized');
 const counts=read(`select jsonb_build_object('games',(select count(*)from app.canonical_games where event_id='${f.eid}'),'verified',(select count(*)from app.canonical_games where event_id='${f.eid}'and state='verified'),'scorelines',(select count(*)from app.card_scorelines where event_id='${f.eid}'),'submissions',(select count(*)from app.score_submissions s join app.canonical_games g on g.id=s.canonical_game_id where g.event_id='${f.eid}'),'confirmations',(select count(*)from app.score_confirmations c join app.canonical_games g on g.id=c.canonical_game_id where g.event_id='${f.eid}'));`);
 assert.deepEqual(counts,{games:108,verified:108,scorelines:216,submissions:216,confirmations:216});
 return{...counts,uniqueOpponentPairs:seen.size,participants:18,gamesEach:12,scope:'Synthetic all-digital backend compatibility only; not mixed mock, random draw, physical rotation, playoffs or financial finalization.'};
}
