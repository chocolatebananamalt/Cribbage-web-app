import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isUuid } from "../src/lib/api/validation.ts";
import { isAccessibleTournamentList } from "../src/lib/api/tournament-chooser.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const legacyPostgresId = "10000000-0000-0000-0000-000000000001";
const rfcId = "257e8c68-8299-4a20-bce1-93902f41cc7a";

test("the chooser and protected routes accept the same canonical PostgreSQL tournament IDs", () => {
  assert.equal(isUuid(legacyPostgresId), true);
  assert.equal(isUuid(rfcId), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("10000000-0000-0000-0000-00000000000z"), false);

  assert.equal(isAccessibleTournamentList([{
    tournamentId: legacyPostgresId,
    tournamentName: "Genesis Rehearsal",
    tournamentDate: "09-15-2026",
    tournamentStatus: "open",
    effectiveRole: "director",
  }]), true);
});

test("Setup and its protected read endpoint use the shared tournament-ID validator", () => {
  const setupPage = read("src/app/tournament/[tournamentId]/setup/page.tsx");
  const setupRoute = read("src/app/api/v1/tournaments/[id]/setup/route.ts");

  assert.match(setupPage, /from ".*lib\/api\/validation"/);
  assert.match(setupPage, /if \(!isUuid\(tournamentId\)\) notFound\(\)/);
  assert.match(setupRoute, /from ".*lib\/api\/validation"/);
  assert.match(setupRoute, /if \(!isUuid\(id\)\)/);
});
