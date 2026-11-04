// Fictional disposable backend only. No actual people or game attestations.
import fs from 'node:fs';
export const actor='a1310000-0000-4000-8000-000000000001', tid='b1310000-0000-4000-8000-000000000001', eid='11310000-0000-4000-8000-000000000001';
export const uuid=(p,n)=>`${p}0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const quote=s=>`'${String(s).replaceAll("'","''")}'`;
export const pid=n=>uuid('f243',n);
export const games={
 h2h:[{a:1,b:2,w:1,m:10},{a:3,b:4,w:3,m:20},{a:1,b:3,w:1,m:10},{a:2,b:4,w:2,m:10},{a:1,b:4,w:4,m:10},{a:2,b:3,w:2,m:10}],
 manual:[{a:1,b:2,w:1,m:10},{a:3,b:4,w:3,m:10}],
 multiple:[{a:1,b:2,w:1,m:10},{a:3,b:4,w:3,m:20},{a:1,b:2,w:2,m:10},{a:3,b:4,w:3,m:20}],
 multiway:[{a:1,b:2,w:1,m:10},{a:3,b:4,w:3,m:10},{a:1,b:3,w:3,m:10},{a:2,b:4,w:2,m:10},{a:1,b:4,w:1,m:10},{a:2,b:3,w:2,m:10}],
};
export function seed(kind='h2h'){
 const matches=kind==='h2hUnique'?games.h2h.map((m,i)=>i===0?{...m,m:11}:m):games[kind],rounds=matches.length/2;
 let s=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8').replaceAll('generate_series(1,2)','generate_series(1,4)').replace("'standard_singles',12,3000","'standard_singles',"+rounds+",3000");
 for(let i=1;i<=4;i++)s+=`insert into auth.users(id,email)values('${uuid('a247',i)}','qualification-tie-local-${i}@test.invalid');update app.event_participants set profile_id='${uuid('a247',i)}' where id='${pid(i)}';`;
 s+=`insert into app.initial_seating_publications(tournament_id,table_count,seats_per_table,actor_profile_id,operation_receipt_id)values('${tid}',1,4,'${actor}','c1310000-0000-4000-8000-000000000001');update app.tournaments set registration_status='closed' where id='${tid}';
 insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)values('${uuid('7247',1)}','${tid}','${eid}','director_entry',${rounds},4,${matches.length},repeat('7',64),'${actor}','c1310000-0000-4000-8000-000000000001');`;
 for(let i=1;i<=rounds;i++)s+=`insert into app.rounds(id,tournament_id,event_id,round_number)values('${uuid('5247',i)}','${tid}','${eid}',${i});`;
 s+=`insert into app.event_play_starts(tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,operation_receipt_id,start_source)values('${tid}','${eid}','${uuid('7247',1)}',app.event_participant_snapshot_digest_v1('${eid}'),4,${rounds},${matches.length},'${actor}','c1310000-0000-4000-8000-000000000001','official');`;
 for(const [i,m]of matches.entries()){
  const g=uuid('6247',i+1),a=pid(m.a),b=pid(m.b),awin=m.w===m.a,side=awin?'a':'b';
  s+=`insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version,winner_side,margin)values('${g}','${tid}','${eid}','${uuid('5247',1+Math.floor(i/2))}',1,'${a}','${b}','A-${m.a}','A-${m.b}','verified',1,'${side}',${m.m});
 insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number)values('${uuid('7247',1)}','${tid}','${eid}','${g}',${i+1});
 insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest)values
 ('${uuid('b247',2*i+1)}','${tid}','${eid}','${g}','${uuid('a247',m.a)}','${a}',1,'${side}',${m.m},'manual',repeat('1',64)),
 ('${uuid('b247',2*i+2)}','${tid}','${eid}','${g}','${uuid('a247',m.b)}','${b}',2,'${side}',${m.m},'manual',repeat('1',64));
 insert into app.score_confirmations(tournament_id,event_id,canonical_game_id,submission_id,submission_actor_id,confirmation_actor_id,confirmation_kind)values
 ('${tid}','${eid}','${g}','${uuid('b247',2*i+1)}','${uuid('a247',m.a)}','${uuid('a247',m.b)}','player'),
 ('${tid}','${eid}','${g}','${uuid('b247',2*i+2)}','${uuid('a247',m.b)}','${uuid('a247',m.a)}','player');
 insert into app.card_scorelines(id,tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points)values
 ('${uuid('8247',2*i+1)}','${tid}','${eid}','${g}','${a}','${b}','a','A-${m.a}',${awin},${m.m},${awin?m.m:0},${awin?0:m.m},${awin?2:0}),
 ('${uuid('8247',2*i+2)}','${tid}','${eid}','${g}','${b}','${a}','b','A-${m.b}',${!awin},${m.m},${awin?0:m.m},${awin?m.m:0},${awin?0:2});`;
 }
 return s+'set constraints all immediate;set constraints all deferred;';
}
