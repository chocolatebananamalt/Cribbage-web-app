import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingSubmissionRecovery,clearPendingScoreSubmission,scoreSubmissionStorageKey} from '../src/lib/score-retry-envelope.ts';
const pending={version:1,kind:'submission',actorId:'actor',tournamentId:'t',gameId:'g',playerSide:'a',submissionId:'own-request',idempotencyKey:'operation',submissionSlot:1,winnerSide:'a',margin:15};
const saved={id:pending.submissionId,winnerSide:pending.winnerSide,margin:pending.margin};
test('only exact saved submission identity and result retire the pending request',()=>{
 assert.deepEqual(pendingSubmissionRecovery(pending,{...saved,id:'different-request'}),{action:'conflict',envelope:pending});
 for(const change of [{winnerSide:'b'},{margin:16},{id:''}])assert.equal(pendingSubmissionRecovery(pending,{...saved,...change}).action,'conflict');
 assert.deepEqual(pendingSubmissionRecovery(pending,saved),{action:'clear'});
 assert.deepEqual(pendingSubmissionRecovery(pending,null),{action:'retry',envelope:pending});
 assert.deepEqual(pendingSubmissionRecovery(null,saved),{action:'none'});
});
test('cleanup preserves replaced, foreign, malformed and unreadable bytes',()=>{
 const key=scoreSubmissionStorageKey('actor','t','g','a');
 for(const raw of ['{broken',JSON.stringify({...pending,actorId:'foreign'}),JSON.stringify({...pending,idempotencyKey:'replacement'}),JSON.stringify({...pending,margin:16})]){
  const values=new Map([[key,raw],['foreign','KEEP']]);const storage={getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k)};
  assert.equal(clearPendingScoreSubmission(storage,pending),false);assert.equal(values.get(key),raw);assert.equal(values.get('foreign'),'KEEP');
 }
 const values=new Map([[key,JSON.stringify(pending)],['foreign','KEEP']]);assert.equal(clearPendingScoreSubmission({getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k)},pending),true);assert.equal(values.has(key),false);assert.equal(values.get('foreign'),'KEEP');
 assert.equal(clearPendingScoreSubmission({getItem(){throw Error('denied')},removeItem(){assert.fail('remove denied data')}},pending),false);
 let reads=0;const raw=JSON.stringify(pending),replacement=JSON.stringify({...pending,idempotencyKey:'later-action'});
 assert.equal(clearPendingScoreSubmission({getItem(){return ++reads===1?raw:replacement},removeItem(){assert.fail('remove replaced raw')}},pending),false);
 assert.equal(clearPendingScoreSubmission({getItem(){return raw},removeItem(){throw Error('denied')}},pending),false);
});
