import test from 'node:test';import assert from 'node:assert/strict';
import {localRecoveryCountCopy} from '../src/lib/local-recovery-count-copy.ts';
for(const [offline,retry,expected]of [
 [0,0,'No offline score entries or retry records are stored locally.'],
 [1,0,'1 offline score entry is still stored locally.'],
 [2,0,'2 offline score entries are still stored locally.'],
 [0,1,'1 retry record is still stored locally.'],
 [0,2,'2 retry records are still stored locally.'],
 [1,1,'1 offline score entry and 1 retry record are still stored locally.'],
 [2,3,'2 offline score entries and 3 retry records are still stored locally.'],
])test(`recovery copy: ${offline} offline, ${retry} retry`,()=>assert.equal(localRecoveryCountCopy(offline,retry),expected));
