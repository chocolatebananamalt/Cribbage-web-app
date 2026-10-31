import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assignedOfflinePageMetadata}from'../src/lib/offline-score-page-binding.ts';
const actor='60000000-0000-4000-8000-000000000001',game='60000000-0000-4000-8000-000000000004';
test('only a current valid assigned context produces the non-secret page marker',()=>{
 assert.deepEqual(assignedOfflinePageMetadata({actorId:actor,gameId:game,progressionStatus:'current'}),{other:{'acc-offline-score-binding':`${actor}:${game}`}});
 for(const progressionStatus of['not_started','upcoming','completed','unknown'])assert.deepEqual(assignedOfflinePageMetadata({actorId:actor,gameId:game,progressionStatus}),{});
 assert.deepEqual(assignedOfflinePageMetadata({actorId:'wrong',gameId:game,progressionStatus:'current'}),{});assert.deepEqual(assignedOfflinePageMetadata({actorId:actor,gameId:'wrong',progressionStatus:'current'}),{});
});
test('page and metadata share request-cached protected assignment, with no recovery-gate relaxation',()=>{
 const source=fs.readFileSync('src/app/tournament/[tournamentId]/game/[gameId]/page.tsx','utf8');
 assert.match(source,/const protectedGameContext = cache/);assert.match(source,/await requireTournamentAccess\(tournamentId\)/);assert.match(source,/result\.context\.actorId !== access\.user\.id/);
 assert.equal((source.match(/await protectedGameContext\(tournamentId, gameId\)/g)||[]).length,2);assert.match(source,/generateMetadata/);
 const boundary=fs.readFileSync('src/components/recovery-document-boundary.tsx','utf8');assert.match(boundary,/state !== "ready"/);
});
