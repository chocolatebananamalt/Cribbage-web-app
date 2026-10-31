import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pending manual roster entry says adding while request is active", async () => {
  const source = await readFile("src/app/tournament/[tournamentId]/roster/roster-client.tsx", "utf8");
  assert.match(source, /busy \? "Adding player…" : "Retry manual entry"/);
});

test("pending seating request says saving while request is active", async () => {
  const source = await readFile("src/app/tournament/[tournamentId]/seating/seating-client.tsx", "utf8");
  assert.match(source, /busy \? "Saving…" : "Retry the same protected request"/);
});