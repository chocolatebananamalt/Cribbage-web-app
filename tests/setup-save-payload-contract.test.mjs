import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const route = readFileSync("src/app/api/v1/tournaments/[id]/setup/route.ts", "utf8");
const client = readFileSync("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
const setupLib = readFileSync("src/lib/api/setup.ts", "utf8");

// On 2026-09-19 no tournament setup could be saved at all. save_tournament_setup_version
// requires tournamentDirectorPublicName to be PRESENT, and strips it itself before the
// legacy writer, which rejects it as an unknown key. The route deleted the key, so the
// RPC's presence check failed on every single save and returned invalid_setup_payload.
test("the setup route must not delete tournamentDirectorPublicName from the payload", () => {
  assert.ok(
    !/deleteProperty\(\s*corePayload\s*,\s*["']tournamentDirectorPublicName["']\s*\)/.test(route),
    "save_tournament_setup_version requires tournamentDirectorPublicName to be present and strips it itself; deleting it here rejects every save",
  );
});

// The wrapper accepted two adapter keys and stripped only one, which is what made the
// two validators impossible to satisfy at the same time.
test("the setup save wrapper strips every adapter key it adds", () => {
  const migrations = readdirSync("database/migrations").filter((name) => name.endsWith(".sql")).sort();
  const latest = migrations
    .map((name) => readFileSync(`database/migrations/${name}`, "utf8"))
    .filter((sql) => /create (or replace )?function public\.save_tournament_setup_version\(/.test(sql))
    .at(-1);
  assert.ok(latest, "no migration defines public.save_tournament_setup_version");
  const call = /save_tournament_setup_version_before_state_territory\(([\s\S]*?)\);/.exec(latest);
  assert.ok(call, "the wrapper must delegate to the pre-adapter writer");
  for (const key of ["stateTerritory", "tournamentDirectorPublicName"]) {
    assert.ok(
      call[1].includes(`-'${key}'`),
      `the wrapper adds '${key}' to its own accepted keys, so it must strip it before the legacy writer, which rejects unknown keys`,
    );
  }
});

// A rejection used to read "The setup was not changed." for all eleven distinct reasons.
test("every setup rejection code has its own director-facing sentence", () => {
  const declared = /const setupRejectionCodes = new Set\(\[([\s\S]*?)\]\)/.exec(setupLib);
  assert.ok(declared, "setupRejectionCodes must exist");
  const codes = [...declared[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  assert.ok(codes.length >= 11, `expected the full rejection code set, found ${codes.length}`);
  const messages = /const setupRejectionMessages: Record<string, string> = \{([\s\S]*?)\n\};/.exec(setupLib);
  assert.ok(messages, "setupRejectionMessages must exist");
  for (const code of codes) {
    assert.ok(new RegExp(`\n  ${code}:`).test(messages[1]), `rejection code ${code} has no message of its own`);
  }
  assert.ok(!/The setup was not changed\./.test(client), "the workspace must show the server's reason, not one generic line");
});

// A rejected save reloaded the workspace, which replaced the form with the last saved
// version and destroyed every field the director had typed.
test("a rejected setup save keeps the director's unsaved work on screen", () => {
  const branch = /if \(response\.status === 409 && isRejectedSetup\(data\)\)[^\n]*/.exec(client);
  assert.ok(branch, "the rejection branch must exist");
  assert.ok(!/await load\(\)/.test(branch[0]), "reloading on a rejection wipes the setup the director just typed");
});
