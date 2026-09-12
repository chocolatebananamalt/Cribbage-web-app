import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../database/migrations/0125_hybrid_scorecard_reconstruction_repair.sql", import.meta.url),
  "utf8",
);

test("scorecard preserves verified lines for roster-only opponents", () => {
  assert.match(migration, /create or replace function public\.get_player_scorecard/);
  assert.match(
    migration,
    /'opponentName', coalesce\(opponent_roster\.claimed_display_name, opponent_profile\.display_name\)/,
  );
  assert.match(
    migration,
    /left join app\.roster_account_links opponent_link[\s\S]+?opponent_link\.profile_id = opponent_participant\.profile_id/,
  );
  assert.match(
    migration,
    /left join app\.tournament_roster_entries opponent_roster[\s\S]+?coalesce\(opponent_participant\.roster_entry_id, opponent_link\.roster_entry_id\)/,
  );
  assert.match(
    migration,
    /left join app\.profiles opponent_profile on opponent_profile\.id = opponent_participant\.profile_id/,
  );
  assert.match(
    migration,
    /opponent_seating\.roster_entry_id = coalesce\(opponent_participant\.roster_entry_id, opponent_link\.roster_entry_id\)/,
  );
  assert.match(migration, /cg\.state in \('verified', 'corrected'\)/);
  assert.match(
    migration,
    /coalesce\(projection\.adjudicated_game_points, cs\.game_points\)/,
  );
  assert.match(
    migration,
    /coalesce\(projection\.adjudicated_plus_points, cs\.plus_points\)/,
  );
  assert.match(
    migration,
    /coalesce\(projection\.adjudicated_minus_points, cs\.minus_points\)/,
  );
  assert.match(
    migration,
    /coalesce\(projection\.adjudicated_is_winner, cs\.is_winner\)/,
  );
  assert.match(
    migration,
    /app\.independent_card_correction_state_events state_event[\s\S]+?state_event\.state = 'applied'/,
  );
  assert.match(
    migration,
    /player_participant\.tournament_id = t\.id and player_participant\.profile_id = auth\.uid\(\)/,
  );
});

test("paper capture resolves roster identity without adding score authority", () => {
  assert.match(
    migration,
    /create or replace function app\.resolve_paper_card_participant_identity/,
  );
  assert.match(
    migration,
    /coalesce\(participant\.profile_id, roster_link\.profile_id\), seating\.verification_id/,
  );
  assert.match(
    migration,
    /seating\.roster_entry_id = coalesce\(participant\.roster_entry_id, roster_link\.roster_entry_id\)/,
  );
  assert.match(
    migration,
    /new\.actor_profile_id is distinct from participant_identity\.profile_id/,
  );
  assert.match(
    migration,
    /new\.actor_profile_id is distinct from opponent_identity\.profile_id/,
  );
  assert.match(migration, /if p_actor_id in \(v_participant_profile_id, v_opponent_profile_id\) then/);
  assert.match(migration, /'uploadProviderConfigured', false/);
  assert.match(migration, /'uploadAuthorized', false/);
  assert.match(migration, /'transcriptionCreated', false/);
  assert.match(migration, /'scoreChanged', false/);
  assert.match(migration, /'gameVerified', false/);
});

test("repaired database functions retain least-privilege grants", () => {
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(
    migration,
    /revoke all on function app\.resolve_paper_card_participant_identity\(uuid, uuid, uuid\)\s+from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.get_player_scorecard\(uuid, uuid\) from public, anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_player_scorecard\(uuid, uuid\) to authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.create_paper_card_capture_v1\([\s\S]+?\) from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_paper_card_capture_v1\([\s\S]+?\) to service_role/,
  );
});
