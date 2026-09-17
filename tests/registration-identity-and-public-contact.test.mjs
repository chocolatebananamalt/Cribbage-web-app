import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");
const csv = await import(pathToFileURL(path.join(root, "src/lib/roster/csv.ts")).href);

test("CSV requires separate names, a canonical ACC number, and Digital or Paper", () => {
  const rows = csv.parseRosterCsv("First Name,Last Name,Email,ACC #,Scorecard Type\nMaryn,Example,,HI9001,Paper\nIan,Example,,HI9002Y,\n");
  assert.deepEqual(rows, [
    { firstName: "Maryn", lastName: "Example", email: "", accNumber: "HI9001", scorecardType: "paper" },
    { firstName: "Ian", lastName: "Example", email: "", accNumber: "HI9002Y", scorecardType: "digital" },
  ]);
  assert.throws(() => csv.parseRosterCsv("Player Name,ACC #\nMaryn Example,HI9001\n"), /First Name and Last Name/);
  assert.throws(() => csv.parseRosterCsv("First Name,Last Name,ACC #\nMaryn,Example,hi9001\n"), /Row 2 has an invalid ACC #/);
  assert.throws(() => csv.parseRosterCsv("First Name,Last Name,ACC #\nMaryn,Example,HI 9001\n"), /Row 2 has an invalid ACC #/);
  assert.throws(() => csv.parseRosterCsv("First Name,Last Name,ACC #\nMaryn,Example,HI9001YY\n"), /Row 2 has an invalid ACC #/);
  assert.throws(() => csv.parseRosterCsv("First Name,Last Name,Scorecard Type\nMaryn,Example,Cardboard\n"), /Digital or Paper/);
});

test("all new roster paths use name parts and the requested scorecard wording", async () => {
  const [manualRoute, csvRoute, rosterClient, registrationForm, rosterApi] = await Promise.all([
    read("src/app/api/v1/tournaments/[id]/roster-manual/route.ts"),
    read("src/app/api/v1/tournaments/[id]/roster-csv/route.ts"),
    read("src/app/tournament/[tournamentId]/roster/roster-client.tsx"),
    read("src/app/register/registration-form.tsx"),
    read("src/lib/api/roster.ts"),
  ]);
  assert.match(manualRoute, /create_manual_roster_entry_v3/);
  assert.match(csvRoute, /import_roster_csv_v3/);
  for (const source of [rosterClient, registrationForm]) {
    assert.match(source, /Scorecard Type/);
    assert.match(source, />Digital</);
    assert.match(source, />Paper</);
  }
  assert.match(rosterClient, /First name/);
  assert.match(rosterClient, /Last name/);
  assert.doesNotMatch(rosterClient, /label>Player name/);
  assert.match(rosterApi, /firstName: string; lastName: string/);
});

test("the public contact is tournament-scoped, primary-director-only, and does not expose a profile", async () => {
  const [migration, setupRoute, contactRoute, setupClient] = await Promise.all([
    read("database/migrations/0204_registration_identity_and_public_director_contact.sql"),
    read("src/app/api/v1/tournaments/[id]/setup/route.ts"),
    read("src/app/api/v1/tournaments/[id]/public-contact/route.ts"),
    read("src/app/tournament/[tournamentId]/setup/setup-client.tsx"),
  ]);
  assert.match(migration, /create table app\.tournament_public_contact_versions/);
  assert.match(migration, /tournament\.director_profile_id<>v_actor/);
  assert.match(migration, /left join lateral\(select \* from app\.tournament_public_contact_versions/);
  const publicReaderStart = migration.indexOf("create or replace function public.get_public_registration_payment_options_v1");
  const publicReader = migration.slice(publicReaderStart, migration.indexOf("$$;", publicReaderStart));
  assert.doesNotMatch(publicReader, /join app\.profiles/);
  assert.match(setupRoute, /Reflect\.deleteProperty\(corePayload, "tournamentDirectorPublicName"\)/);
  assert.match(setupRoute, /configure_tournament_public_contact_from_setup_v1/);
  assert.match(contactRoute, /correct_tournament_public_contact_v1/);
  assert.match(setupClient, /Tournament Director name \(shown to players\)/);
  assert.match(setupClient, /Update public Director name/);
});
