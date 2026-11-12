import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {validateInitialGameSeats} from '../src/lib/initial-game-seats.ts';
import {validateScheduleForEvent} from '../src/lib/api/event-schedule.ts';
import {deriveOddFieldMakeupPlan} from '../src/lib/results/odd-field-makeup.ts';
import {oddFieldFixture,startingSeatAlignedOddFieldFixture} from './fixtures/odd-field-makeup.mjs';

test('new even-field first game matches permanent IDs; later rotations remain free',()=>{
  const rows=[{gameNumber:1,sideAVerificationId:'A-1',sideBVerificationId:'A-2',sideATableSeat:'A-1',sideBTableSeat:'A-2'},
    {gameNumber:2,sideAVerificationId:'A-1',sideBVerificationId:'A-2',sideATableSeat:'B-1',sideBTableSeat:'B-2'}];
  assert.deepEqual(validateInitialGameSeats(rows),[]);
  assert.equal(validateInitialGameSeats([{...rows[0],sideATableSeat:'A-2',sideBTableSeat:'A-1'},rows[1]]).length,1);
});

test('odd first-game sit-out retains ID without constraining the later first played game',()=>{
  const f=startingSeatAlignedOddFieldFixture();
  assert.deepEqual(validateInitialGameSeats(f.regularMatches),[]);
  assert.deepEqual(validateScheduleForEvent(f.regularMatches,12,f.verificationIds,5,4),[]);
  const used=new Set(f.regularMatches.filter(m=>m.gameNumber===1).flatMap(m=>[m.sideAVerificationId,m.sideBVerificationId]));
  const sitout=f.verificationIds.find(id=>!used.has(id));assert.equal(sitout,'E-1');
  const later=f.regularMatches.find(m=>[m.sideAVerificationId,m.sideBVerificationId].includes(sitout));
  assert.ok(later.gameNumber>1);
  assert.notEqual(later.sideAVerificationId===sitout?later.sideATableSeat:later.sideBTableSeat,sitout);
  const plan=deriveOddFieldMakeupPlan(f.regularMatches,f.verificationIds,f.makeupSeats,5,4);
  for(const id of f.verificationIds)assert.equal([...f.regularMatches,...plan.makeupMatches].filter(m=>[m.sideAVerificationId,m.sideBVerificationId].includes(id)).length,12);
});

test('new validation rejects legacy mismatch but historical derivation remains readable',()=>{
  const old=oddFieldFixture();assert.equal(validateInitialGameSeats(old.regularMatches).length,1);
  assert.equal(deriveOddFieldMakeupPlan(old.regularMatches,old.verificationIds,old.makeupSeats,5,4).makeupMatches.length,6);
});

test('migration only patches fresh publishers after historical replay and leaves revisions intact',()=>{
  const sql=fs.readFileSync('database/migrations/0271_initial_game_starting_seats.sql','utf8');
  assert.match(sql,/return v_existing\.response_payload/);assert.match(sql,/return prior\.response_payload/);
  assert.match(sql,/sideAVerificationId.*is distinct from.*sideATableSeat/);
  assert.doesNotMatch(sql,/create.*table|grant execute|create or replace function app\.derive_odd_field|update app\./i);
  assert.doesNotMatch(sql,/preview_event_schedule_amendment|confirm_event_schedule_amendment/);
});
