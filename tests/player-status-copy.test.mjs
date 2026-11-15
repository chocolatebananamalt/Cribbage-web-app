import test from 'node:test';
import assert from 'node:assert/strict';
import {playerStatusCopy} from '../src/lib/games/player-status-copy.ts';
test('player wording does not turn a saved or offline entry into a completed game',()=>{
  for(const message of ['Saved Offline, Waiting to Sync','Offline entry synchronized. Refreshing the server scorecard status.','Your entry is saved. Required verification is still pending.','Your confirmation is saved. The game will verify after the other player confirms their own entry.']){
    assert.doesNotMatch(playerStatusCopy(message),/Game complete/);
  }
  assert.equal(playerStatusCopy('Game verified. The authoritative scorecard is updated.'),'Game complete. Your scorecard is updated.');
});
test('unknown recovery and rejection explanations remain intact',()=>{
  for(const message of ['The entries do not match. This game needs cross-checking.','Your saved offline entry is still on this device. Sign in as the same player to sync it.','No result can be recorded'])assert.equal(playerStatusCopy(message),message);
});
