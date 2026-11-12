import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync("src/app/tournament/[tournamentId]/schedule/schedule-client.tsx", "utf8");

test("event start retains one actor scoped exact request until resolved", () => {
  assert.match(client, /event-start:\$\{actorId\}:\$\{tournamentId\}/);
  assert.match(client, /writeSavedStart\(startStorageKey, request\)/);
  assert.match(client, /readSavedStart\(startStorageKey\)/);
  assert.match(client, /Retry Exact Event Start/);
  assert.match(client, /event_retired: "This event is no longer available for play/);
  assert.match(client, /pendingTargetMissing/);
  assert.match(client, /acceptedStartEventId/);
  assert.match(client, /setAcceptedStartEventId\(request\.eventId\)/);
  assert.match(client, /\(pendingStart \|\| activeEvent\.playState === "ready_to_start"\)/);
  assert.match(client, /if \(starting \|\| flight\.current \|\| !ready \|\| acceptedStartEventId === activeEvent\?\.eventId\) return/);
  assert.match(client, /disabled=\{!ready \|\| busy \|\| starting \|\| !!pending \|\| !!pendingStart\}/);
  assert.match(client, /The event start request could not be confirmed/);
  assert.doesNotMatch(client, /event start request is unresolved\. Refresh the event/);
});
