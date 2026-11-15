import assert from 'node:assert/strict';
import {quote,uuid} from './fixtures/q-review-foundation.mjs';
export function verifyOddFieldBeforePublication({sql,fixture:f}){
 const {actor,tid,eid}=f;const write=(r,op,a=actor,t=tid)=>JSON.parse(sql(`select public.publish_odd_field_makeup_schedule_v1('${a}','${t}','${eid}',${quote(JSON.stringify(r))},'${op}');`));
 const invalid=[r=>r.anchorCount=1,r=>r.reviewed=false,r=>r.reason='',r=>r.regularMatches.pop(),r=>r.regularMatches[0].gameNumber=13,
  r=>r.makeupSeats[1]=r.makeupSeats[0],r=>r.makeupSeats.pop(),r=>r.extraScore=2];
 for(const[i,change]of invalid.entries()){const r=structuredClone(f.request);change(r);assert.equal(write(r,uuid('f252',100+i)).status,'rejected');}
 assert.equal(write(f.request,uuid('f252',120),f.uid(1)).code,'not_director');
 assert.equal(sql(`select count(*)from app.event_schedule_publications where event_id='${eid}';`),'0');
 console.log('PASS odd field rejects malformed/phantom score/anchor/seat/partial schedule and unauthorized inputs before publication');
}
export function verifyOddFieldAfterPublication({sql,fixture:f}){
 const {actor,tid,eid}=f;
 const result=JSON.parse(sql(`select public.publish_odd_field_makeup_schedule_v1('${actor}','${tid}','${eid}',${quote(JSON.stringify(f.request))},'${uuid('3252',1)}');`));
 assert.equal(result.status,'odd_field_schedule_published');assert.equal(result.matchCount,102);assert.equal(result.gameCount,12);
 assert.equal(sql(`select count(*)from app.event_schedule_publications where event_id='${eid}';`),'1');
 const ws=JSON.parse(sql(`select public.get_odd_field_makeup_workspace_v1('${actor}','${tid}','${eid}');`));
 assert.equal(ws.current,true);assert.equal(ws.makeups.length,6);assert.deepEqual(ws.makeups.map(r=>[r.sideACardGameNumber,r.sideBCardGameNumber]),[[1,12],[2,11],[3,10],[4,9],[5,8],[6,7]]);
 for(const m of ws.makeups){
  const game=JSON.parse(sql(`select public.get_game_scorecard_number_context_v1('${actor}','${tid}','${m.canonicalGameId}');`));
  assert.ok(game);assert.equal(game.isMakeup,true);assert.notEqual(game.sideACardGameNumber,game.sideBCardGameNumber);
 }
 console.log('PASS odd field exact replay one publication, six real makeup pairs with separate original scorecard lines');
 return ws;
}

export function verifyOddFieldPlayerCards({sql,fixture:f,complete}) {
 for(let n=1;n<=17;n++) {
  const user=f.uid(n);
  const card=JSON.parse(sql(`set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${user}';set request.jwt.claims='{"role":"authenticated","sub":"${user}"}';select public.get_player_scorecard('${f.tid}','${f.eid}');`));
  assert.ok(card,'Actual linked player must receive their own card');
  const rows=complete?card.lines:card.pendingGames;
  assert.deepEqual(rows.map(r=>r.roundNumber),Array.from({length:12},(_,i)=>i+1));
  assert.equal((complete?card.pendingGames:card.lines).length,0);
  if(complete){const expected=f.expected.find(r=>r.number===n);assert.equal(card.totals.gamePoints,expected.gamePoints);assert.equal(card.totals.plusPoints,expected.plusPoints);assert.equal(card.totals.minusPoints,expected.minusPoints);}
 }
 console.log(`PASS actual authenticated player card readers:17 own cards, original1..12 ${complete?'verified':'pending'} lines; no phantom game13`);
}
