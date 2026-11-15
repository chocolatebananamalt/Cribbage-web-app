import test from 'node:test';import assert from 'node:assert/strict';
import {scoreEntryDraftKey,readScoreEntryDraft,clearScoreEntryDraft}from'../src/lib/games/score-entry-draft.ts';
import {isAppRecoveryStorageKey}from'../src/lib/client-session-storage.ts';
const identity={actorId:'actor',tournamentId:'tournament',eventId:'event',gameId:'game',side:'a'};
const draft={...identity,version:1,revision:1,winner:'player',marginText:'40'};
const storage=value=>{const map=new Map([[scoreEntryDraftKey(identity)+':1',JSON.stringify(value)]]);return{get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k),map};};
test('unsubmitted choices are isolated by all assignment identities and participate in existing recovery cleanup',()=>{
  assert.equal(isAppRecoveryStorageKey(scoreEntryDraftKey(identity)),true);
  assert.deepEqual(readScoreEntryDraft(storage(draft),identity),draft);
  for(const key of Object.keys(identity)){
    assert.notEqual(scoreEntryDraftKey({...identity,[key]:key==='side'?'b':'other'}),scoreEntryDraftKey(identity));
    assert.equal(readScoreEntryDraft(storage({...draft,[key]:'other'}),identity),null);
  }
});
test('foreign, corrupt or authority-bearing draft values are never restored as choices',()=>{
  for(const value of [null,{}, {...draft,marginText:'-20'},{...draft,marginText:'9999'},{...draft,winner:'a'},{...draft,version:2},{...draft,verified:true},{...draft,submissionId:'other'}])assert.equal(readScoreEntryDraft(storage(value),identity),null);
  assert.equal(readScoreEntryDraft({length:1,key:()=>scoreEntryDraftKey(identity)+':1',getItem:()=>'{bad'},identity),null);
  assert.equal(readScoreEntryDraft({length:1,key:()=>scoreEntryDraftKey(identity)+':1',getItem:()=>{throw Error('unavailable')}},identity),null);
});
test('immutable next snapshot is kept before prior draft cleanup; foreign keys are untouched',()=>{
 const data=storage(draft),latest={...draft,revision:2,marginText:'41'};
 data.map.set(scoreEntryDraftKey(identity)+':2',JSON.stringify(latest));data.map.set('other-site','untouched');
 assert.deepEqual(readScoreEntryDraft(data,identity),latest);
 clearScoreEntryDraft(data,identity,scoreEntryDraftKey(identity)+':2');assert.equal(data.length,2);
 clearScoreEntryDraft(data,identity);assert.equal(data.length,1);assert.equal(data.map.get('other-site'),'untouched');
});
