import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("activation keeps registration route gated and falls back to tournament workspace", async () => {
  const client = await readFile("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
  const page = await readFile("src/app/tournament/[tournamentId]/setup/page.tsx", "utf8");
  assert.match(client, /registrationLinkManagementEnabled/);
  assert.match(client, /router\.push\(\(registrationLinkManagementEnabled \?\? false\) \?/);
  assert.match(client, /`\/tournament\/\$\{tournamentId\}\/registration`/);
  assert.match(client, /`\/tournament\/\$\{tournamentId\}`/);
  assert.match(client, /registrationLinkManagementEnabled \? "opening the QR and registration-link workspace\." : "returning to the tournament workspace\."/);
  assert.match(page, /registrationLinkManagementEnabled=\{registrationLinkManagementEnabled\(\)\}/);
});