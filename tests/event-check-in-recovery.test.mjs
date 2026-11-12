import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCheckInCompletion, removeExpiredCheckInCompletion, checkInCompletionStorageKey as key } from '../src/lib/event-check-in-recovery.ts';
const expired = JSON.stringify({token:'fictional-old',expiresAt:'2026-01-01T00:00:00Z'});
const active = JSON.stringify({token:'fictional-new',expiresAt:'2027-01-01T00:00:00Z'});
const now = Date.parse('2026-10-28T00:00:00Z');
function store(value){return {value,getItem(){return this.value},removeItem(){this.value=null}}}
test('expired valid completion is removed before a new QR, at deadline inclusive',()=>{const s=store(expired);assert.equal(removeExpiredCheckInCompletion(s,expired,now),true);assert.equal(s.value,null);s.value=active;assert.deepEqual(parseCheckInCompletion(s.getItem(key)),JSON.parse(active));const t=store(expired);assert.equal(removeExpiredCheckInCompletion(t,expired,Date.parse(JSON.parse(expired).expiresAt)),true)});
test('malformed, extended and active completions are retained',()=>{for(const raw of ['bad','{}',JSON.stringify({token:'x',expiresAt:'bad'}),JSON.stringify({...JSON.parse(expired),extra:true}),active]){const s=store(raw);assert.equal(removeExpiredCheckInCompletion(s,raw,now),false);assert.equal(s.value,raw)}});
test('an old timer cannot remove replacement raw bytes',()=>{const s=store(active);assert.equal(removeExpiredCheckInCompletion(s,expired,now),false);assert.equal(s.value,active)});
