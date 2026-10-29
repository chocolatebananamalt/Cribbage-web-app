// Disposable LOCAL synthetic foundation. Financial and qualification operations use real RPCs.
import fs from 'node:fs';
export const actor='a1310000-0000-4000-8000-000000000001',tid='b1310000-0000-4000-8000-000000000001',eid='11310000-0000-4000-8000-000000000001';
export const uuid=(prefix,n)=>`${prefix}0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const quote=s=>`'${String(s).replaceAll("'","''")}'`;
export function foundation(){
 let seed=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8').replace("'Equal',500","'Equal (Pays All Equally)',500").replace("'Graduated',1000","'Equal (Pays All Equally)',1000").replaceAll('generate_series(1,2)','generate_series(1,16)').replace("'A-'||n","chr(65+(n-1)/4)||'-'||(((n-1)%4)+1)");
 const games=JSON.parse(fs.readFileSync('tests/fixtures/q-review-games.json','utf8')).matches;
 let sql=`begin;set role postgres;${seed}\n`;
 for(let i=1;i<=2;i++)sql+=`select public.publish_q_pool_policy_v1('${actor}','${tid}',${quote(JSON.stringify({poolVersionId:uuid('c243',i),method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY reviewed policy '+i,disclosed:true}))},'${uuid('0245',i)}');\n`;
 sql+='commit;begin;set role postgres;'; // post-disclosure receipt timestamp, no backdating
 sql+=`select set_config('request.jwt.claim.sub','${actor}',true),set_config('request.jwt.claim.role','authenticated',true);\n`;
 for(let i=1;i<=16;i++){
  const r=uuid('d243',i),p1=[1,2,4,16].includes(i),p2=i===15,amount=3000+(p1?500:0)+(p2?1000:0);
  const poolExpr=n=>`jsonb_build_object('poolVersionId','${uuid('c243',n)}','elected',${n===1?p1:p2},'consentReference',case when ${n===1?p1:p2} then 'Q policy '||(select id from app.q_pool_policies_v1 where pool_version_id='${uuid('c243',n)}')::text||': TEST ONLY acknowledgment' else '' end)`;
  sql+=`select public.save_q_pool_membership_v1('${actor}','${tid}',jsonb_build_object('action','membership','rosterEntryId','${r}','expectedVersion',0,'correction',false,'reason','TEST ONLY election','pools',jsonb_build_array(${poolExpr(1)},${poolExpr(2)})),extensions.gen_random_uuid());
select public.set_roster_payment_obligation_v1('${tid}','${r}',0,${amount},'TEST ONLY synthetic',extensions.gen_random_uuid());
select public.record_manual_roster_payment('${tid}','${r}',0,${amount},'USD','cash',now(),'TEST ONLY no actual money',extensions.gen_random_uuid());
select public.save_q_pool_membership_v1('${actor}','${tid}',jsonb_build_object('action','allocation','rosterEntryId','${r}','expectedVersion',0,'correction',false,'reason','TEST ONLY allocated','membershipVersionId',(select id from app.q_pool_membership_versions_v1 where roster_entry_id='${r}'),'receiptId',(select id from app.roster_payment_events where roster_entry_id='${r}'),'obligationVersion',1,'baseMinor',3000,'pools',jsonb_build_array(jsonb_build_object('poolVersionId','${uuid('c243',1)}','amountMinor',${p1?500:0}),jsonb_build_object('poolVersionId','${uuid('c243',2)}','amountMinor',${p2?1000:0}))),extensions.gen_random_uuid());\n`;
 }
 for(let i=1;i<=16;i++)sql+=`insert into auth.users(id,email)values('${uuid('a245',i)}','local-qreview-${i}@test.invalid');update app.event_participants set profile_id='${uuid('a245',i)}' where id='${uuid('f243',i)}';`;
 sql+=`insert into app.initial_seating_publications(tournament_id,table_count,seats_per_table,actor_profile_id,operation_receipt_id)values('${tid}',4,4,'${actor}','c1310000-0000-4000-8000-000000000001');update app.tournaments set registration_status='closed' where id='${tid}';
insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)values('${uuid('7245',1)}','${tid}','${eid}','director_entry',12,16,96,repeat('7',64),'${actor}','c1310000-0000-4000-8000-000000000001');\n`;
 for(let i=1;i<=12;i++)sql+=`insert into app.rounds(id,tournament_id,event_id,round_number)values('${uuid('5245',i)}','${tid}','${eid}',${i});\n`;
 sql+=`insert into app.event_play_starts(tournament_id,event_id,schedule_publication_id,participant_snapshot_digest,participant_count,game_count,schedule_match_count,started_by_profile_id,operation_receipt_id,start_source)values('${tid}','${eid}','${uuid('7245',1)}',app.event_participant_snapshot_digest_v1('${eid}'),16,12,96,'${actor}','c1310000-0000-4000-8000-000000000001','official');`;
 for(let [j,m]of games.entries()){
  const g=uuid('6245',j+1),a=uuid('f243',m.a),b=uuid('f243',m.b),awin=m.winner===m.a;
  sql+=`insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot,state,version,winner_side,margin)values('${g}','${tid}','${eid}','${uuid('5245',m.round)}',1,'${a}','${b}','${m.aSeat}','${m.bSeat}','verified',1,'${awin?'a':'b'}',${m.margin});
insert into app.score_submissions(id,tournament_id,event_id,canonical_game_id,submitter_profile_id,submitter_participant_id,submission_slot,winner_side,margin,source_method,payload_digest)values
('${uuid('b245',j*2+1)}','${tid}','${eid}','${g}','${uuid('a245',m.a)}','${a}',1,'${awin?'a':'b'}',${m.margin},'manual',repeat('1',64)),
('${uuid('b245',j*2+2)}','${tid}','${eid}','${g}','${uuid('a245',m.b)}','${b}',2,'${awin?'a':'b'}',${m.margin},'manual',repeat('1',64));
insert into app.score_confirmations(tournament_id,event_id,canonical_game_id,submission_id,submission_actor_id,confirmation_actor_id,confirmation_kind)values
('${tid}','${eid}','${g}','${uuid('b245',j*2+1)}','${uuid('a245',m.a)}','${uuid('a245',m.b)}','player'),
('${tid}','${eid}','${g}','${uuid('b245',j*2+2)}','${uuid('a245',m.b)}','${uuid('a245',m.a)}','player');
insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number)values('${uuid('7245',1)}','${tid}','${eid}','${g}',${j+1});
insert into app.card_scorelines(id,tournament_id,event_id,canonical_game_id,participant_id,opponent_participant_id,side,table_seat_snapshot,is_winner,margin,plus_points,minus_points,game_points)values
('${uuid('8245',j*2+1)}','${tid}','${eid}','${g}','${a}','${b}','a','${m.aSeat}',${awin},${m.margin},${awin?m.margin:0},${awin?0:m.margin},${awin?2:0}),
('${uuid('8245',j*2+2)}','${tid}','${eid}','${g}','${b}','${a}','b','${m.bSeat}',${!awin},${m.margin},${awin?0:m.margin},${awin?m.margin:0},${awin?0:2});\n`;
 }
 sql+=`select set_config('request.jwt.claim.role','service_role',true);select public.finalize_standard_singles_qualification_v1('${actor}','${tid}','${eid}','${uuid('9245',1)}');commit;`;
 return sql;
}
