import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {consolationPlan, scoreStructuredPaperGames} from './fixtures/structured-multi-event-lifecycle.mjs';
const id = n => `a1230000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const card = (side, margin) => { const text = `Winner side: ${side}\nSpread points: ${margin}\n`; return {text, sha256:createHash('sha256').update(text).digest('hex'), reference:'TEST ONLY synthetic card'}; };

test('14 fictional nonqualifiers receive eight distinct scheduled games', () => {
  const players=Array.from({length:14},(_,i)=>id(i+1)), matches=consolationPlan(players);
  assert.equal(matches.length,56);
  for(const player of players) assert.equal(matches.filter(m=>m.a===player||m.b===player).length,8);
  for(let round=1;round<=8;round++) {
    const games=matches.filter(m=>m.round===round);
    assert.equal(new Set(games.flatMap(m=>[m.a,m.b])).size,14);
  }
  assert.equal(new Set(matches.map(m=>[m.a,m.b].sort().join(':'))).size,56);
  assert.throws(()=>consolationPlan([...players.slice(0,13),players[0]]));
  const pairs=Array.from({length:7},(_,i)=>[players[2*i],players[2*i+1]]);
  assert.deepEqual(consolationPlan(players,pairs).filter(m=>m.round===1).map(m=>[m.a,m.b]),pairs);
  assert.throws(()=>consolationPlan(players,[...pairs.slice(0,6),pairs[0]]));
});

test('structured scorer checks hashes and invokes capture followed by review', () => {
  let calls=[];
  const m={gameId:id(10),winnerSide:'a',margin:12};
  const args={actor:id(1),checker:id(2),tournamentId:id(3),eventId:id(4),matches:[m],operationId:(kind,i)=>id(({completion:100,capture:200,review:300})[kind]+i),sql:q=>calls.push(q),read:q=>{
    calls.push(q);
    if(q.includes('select exists'))return true;
    if(q.includes('card_scorelines'))return 0;
    if(q.includes('get_synthetic_paper_evidence'))return {artifacts:[{gameId:m.gameId,sideA:card('a',12),sideB:card('a',12)}]};
    if(q.includes('complete_synthetic'))return {status:'pending_review'};
    if(q.includes('review_synthetic'))return {status:'approved'};
    return 1;
  }};
  scoreStructuredPaperGames(args);
  assert.ok(calls.findIndex(x=>x.includes('prepare_synthetic'))<calls.findIndex(x=>x.includes('complete_synthetic')));
  const batch=calls.find(x=>x.includes('complete_synthetic'));
  assert.ok(batch.indexOf('complete_synthetic')<batch.indexOf('review_synthetic'));
  assert.ok(!calls.some(x=>/insert\s+into\s+app\.card_scorelines/i.test(x)));
  const original=args.read;
  args.read=q=>q.includes('get_synthetic_paper_evidence')?{artifacts:[{gameId:m.gameId,sideA:{...card('a',12),sha256:'0'.repeat(64)},sideB:card('a',12)}]}:original(q);
  calls=[]; assert.throws(()=>scoreStructuredPaperGames(args));
  assert.ok(!calls.some(x=>x.includes('complete_synthetic')));
});
