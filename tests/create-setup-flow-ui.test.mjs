import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const create = read("src/app/director/tournaments/new/new-tournament-client.tsx");
const createPage = read("src/app/director/tournaments/new/page.tsx");
const setup = read("src/app/tournament/[tournamentId]/setup/setup-client.tsx");
const page = read("src/app/tournament/[tournamentId]/setup/page.tsx");

test("new tournament preserves the exact request across uncertain outcomes", () => {
  assert.match(create, /director-new-tournament-pending:\$\{actorId\}/);
  assert.match(create, /setAppRecoveryItem\(sessionStorage, storageKey/);
  assert.match(createPage, /<NewTournamentClient actorId=\{actorId\}/);
  assert.match(create, /Retry the same request when the connection is available/);
  assert.match(create, /response\.status >= 400 && response\.status < 500/);
  assert.match(create, /hydrated \|\| busy \|\| inFlight\.current/);
  assert.match(create, /inFlight\.current/);
  assert.match(create, /disabled=\{busy \|\| !!pendingRequest \|\| !hydrated\}/);
  assert.match(create, /setHydrated\(true\)/);
  assert.doesNotMatch(create, /That attempt did not confirm/);
});

test("setup seeds only authoritative server tournament data and never invents a time", () => {
  assert.match(page, /getAccessibleTournaments/);
  assert.match(page, /creationSeed=\{tournament \?/);
  assert.match(setup, /blankPayload\(result\.officialChoices, effectiveCreationSeed\)/);
  assert.match(create, /tournament-creation-seed:\$\{actorId\}:\$\{receipt\.tournamentId\}/);
  assert.match(setup, /readCreationSeed\(creationSeedStorageKey, tournamentId\)/);
  assert.match(setup, /isTournamentCreated\(value\) && value\.tournamentId === tournamentId/);
  assert.match(setup, /if \(current\) clearCreationSeed\(creationSeedStorageKey\)/);
  assert.match(setup, /clearCreationSeed\(creationSeedStorageKey\);(?: setCreationSeedActive\(false\);)? clearPending\(storageKey\)/);
  assert.match(setup, /startsAt: creationSeed \? creationDateInputValue\(creationSeed\.plannedDate\)/);
  assert.match(setup, /Start date<input required type="date" value=\{payload\.startsAt\.slice\(0, 10\)\}/);
  assert.match(setup, /Start time<input required type="time" value=\{payload\.startsAt\.slice\(11, 16\)\}/);
  assert.match(setup, /creationSeedActive && !revisionId/);
  assert.match(setup, /setCreationSeedActive\(Boolean\(effectiveCreationSeed && !current\)\)/);
  assert.match(setup, /Planned start date carried forward/);
  assert.match(setup, /setPending\(recovered\);(?: setCreationSeedActive\(false\);)? setPayload\(recovered\.request\.payload\)/);
  assert.doesNotMatch(setup, /loaded\.currentVersion > recovered\.request\.expectedVersion/);
  assert.match(setup, /were saved\. Refresh to load the latest server version/);
});
