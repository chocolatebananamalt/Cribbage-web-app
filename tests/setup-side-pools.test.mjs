import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isSetupEvent } from "../src/lib/api/setup.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const event = (sidePools = []) => ({ clientRowId: "30000000-0000-4000-8000-000000000003", eventKind: "satellite", displayName: "Practice", startsAt: "2026-10-03T18:00", timezone: "Pacific/Honolulu", styleCode: "Canadian Doubles", formatCode: "canadian_doubles", gameCount: 3, entryFeeCents: 2000, feeIncludesNote: "", payoutNote: "Top 4", qualificationNote: "", eligibilityNote: "", mugginsStatus: "unset", qPools: [], sidePools });

test("setup validates zero through six named Side Pools and rejects a seventh or normalized duplicate", () => {
  const pools = Array.from({ length: 6 }, (_, index) => ({ poolTypeCode: `Pool ${index + 1}`, entryFeeCents: 1000, note: "" }));
  assert.equal(isSetupEvent(event(pools)), true);
  assert.equal(isSetupEvent(event([...pools, { poolTypeCode: "Pool 7", entryFeeCents: 1000, note: "" }])), false);
  assert.equal(isSetupEvent(event([{ poolTypeCode: "Early Bird", entryFeeCents: 1000, note: "" }, { poolTypeCode: " early bird ", entryFeeCents: 2000, note: "" }])), false);
});

test("side-pool setup definitions are private, versioned, materialized after activation, and never confuse Q Pools", () => {
  const sql = read("database/migrations/0198_setup_side_pool_definitions_and_recovery.sql");
  for (const token of ["tournament_setup_side_pool_versions", "tournament_setup_side_pool_materializations", "slot between 1 and 6", "lower(trim(pool_type_code))", "configure_tournament_setup_side_pools_v1", "materialize_tournament_setup_side_pools_v1", "side_pool_limit", "setup_lifecycle_closed"]) assert.match(sql, new RegExp(token.replaceAll("(", "\\(").replaceAll(")", "\\)")));
  assert.match(sql, /alter table app\.tournament_setup_side_pool_versions enable row level security/);
  assert.match(sql, /revoke all on function public\.configure_tournament_setup_side_pools_v1[\s\S]*from public,anon,authenticated/);
  assert.match(sql, /grant execute on function public\.materialize_tournament_setup_side_pools_v1[\s\S]*to service_role/);
});

test("side-pool writes remain server-mediated and legacy team recovery remains protected", () => {
  const saveRoute = read("src/app/api/v1/tournaments/[id]/setup/route.ts");
  const amendmentRoute = read("src/app/api/v1/tournaments/[id]/setup/amendments/route.ts");
  const activationRoute = read("src/app/api/v1/tournaments/[id]/setup/activation/route.ts");
  const teamRoute = read("src/app/api/v1/tournaments/[id]/team-scoring/enable/route.ts");
  assert.match(saveRoute, /configure_tournament_setup_side_pools_v1/);
  assert.match(amendmentRoute, /configure_tournament_setup_side_pools_v1/);
  assert.match(amendmentRoute, /materialize_tournament_setup_side_pools_v1/);
  assert.match(activationRoute, /materialize_tournament_setup_side_pools_v1/);
  assert.match(teamRoute, /isSameOriginRequest/);
  assert.match(teamRoute, /requireVerifiedSubject/);
  assert.match(teamRoute, /enable_supported_team_scoring_v1/);
});

test("a legacy paper team upgrade appends an Appendix-B ruleset instead of rewriting history", () => {
  const sql = read("database/migrations/0200_legacy_team_ruleset_upgrade.sql");
  assert.match(sql, /ACC Official Tournament Rules 2025 Appendix B/);
  assert.match(sql, /create trigger ruleset_enable_supported_doubles before insert on app\.ruleset_versions/);
  assert.match(sql, /event_row\.scoring_method<>'manual'/);
  assert.match(sql, /insert into app\.ruleset_versions/);
  assert.match(sql, /update app\.events set scoring_method='digital',ruleset_version_id=ruleset_id_value/);
  assert.match(sql, /supported_team_scoring_enabled/);
  assert.doesNotMatch(sql, /update app\.ruleset_versions set/);
});

test("retired events remain audited history but do not appear as current active setup events", () => {
  const sql = read("database/migrations/0202_setup_activation_hides_retired_events.sql");
  assert.match(sql, /event\.operational_state = 'active'/);
  assert.match(sql, /event\.operational_state='active'/);
  assert.match(sql, /get_tournament_setup_activation_state_v3/);
});
