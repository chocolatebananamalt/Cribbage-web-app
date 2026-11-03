import test from 'node:test';
import assert from 'node:assert/strict';
import {formatSetupSavedAt} from '../src/lib/setup-save-status.ts';
test('saved timestamp uses persisted instant and explicit tournament zone, not current clock',()=>{
 assert.match(formatSetupSavedAt('2026-11-03T21:07:29.148637Z','Pacific/Honolulu'),/Nov 3, 2026.*11:07:29 AM HST/);
 assert.match(formatSetupSavedAt('2026-11-03T21:07:29Z','UTC'),/9:07:29 PM UTC/);
 assert.equal(formatSetupSavedAt('2026-11-03T21:07:29Z','Pacific/Honolulu'),formatSetupSavedAt('2026-11-03T11:07:29-10:00','Pacific/Honolulu'));
});
test('unavailable or unzoned timestamps never manufacture a save time',()=>{
 for(const value of [null,'','garbage','2026-11-03T21:07:29'])assert.equal(formatSetupSavedAt(value,'UTC'),null);
 assert.equal(formatSetupSavedAt('2026-11-03T21:07:29Z','not-a-zone'),null);
});
