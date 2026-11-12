// LOCAL ONLY: normal check-in, seating, reviewed publication and start.
import assert from 'node:assert/strict';
const json=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
export function publishAndStartStructuredEvent({sql,read,actor,tournamentId,eventId,participants,matches,gameCount,operationId,checkerProfileId,initialSeating}) {
 const op=(name,index=0)=>operationId(name,index);
 const check=(v,status)=>{assert.equal(v?.status,status,JSON.stringify(v));return v;};
 if(initialSeating){
  sql(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tournamentId}','${checkerProfileId}','cross_checker');`);
  check(read(`select public.bind_paper_official_identity_v1('${actor}','${tournamentId}','${op('bindingId')}','${checkerProfileId}','nonparticipant',null,0,'${op('bind')}');`),'bound');
  for(let i=0;i<participants.length;i++)check(read(`select public.record_roster_check_in_event_v2('${tournamentId}','${participants[i].rosterEntryId}','checked_in','TEST ONLY SYNTHETIC: fictional attendance','${op('roster',i)}');`),'check_in_recorded');
  check(read(`select public.close_tournament_registration_v2('${actor}','${tournamentId}','${op('registration')}');`),'registration_closed');
  const assignments=participants.map(x=>({rosterEntryId:x.rosterEntryId,tableSeat:x.verificationId}));
  check(read(`select public.publish_initial_seating_v2('${tournamentId}',5::smallint,4::smallint,${json(assignments)},'${op('seating')}');`),'initial_seating_published');
 }
 check(read(`select public.open_event_check_in_window_v1('${actor}','${tournamentId}','${eventId}','${op('open')}');`),'event_check_in_opened');
 for(let i=0;i<participants.length;i++)check(read(`select public.desk_check_in_event_v1('${actor}','${tournamentId}','${eventId}','${participants[i].rosterEntryId}','${op('checkin',i)}');`),'checked_in');
 check(read(`select public.close_event_check_in_window_v1('${actor}','${tournamentId}','${eventId}','${op('close')}');`),'event_check_in_closed');
 const schedule=matches.map(({gameNumber,sideAVerificationId,sideBVerificationId,sideATableSeat,sideBTableSeat})=>({gameNumber,sideAVerificationId,sideBVerificationId,sideATableSeat,sideBTableSeat}));
 const published=check(read(`select public.publish_director_reviewed_event_schedule_v1('${actor}','${tournamentId}','${eventId}',${json(schedule)},true,'${op('publish')}');`),'event_schedule_published');
 check(read(`select public.start_event_play_v1('${actor}','${tournamentId}','${eventId}','${published.publicationId}',app.event_participant_snapshot_digest_v1('${eventId}'),${participants.length},${gameCount},true,'${op('start')}');`),'event_started');
}
