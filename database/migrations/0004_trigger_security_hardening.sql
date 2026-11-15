-- LOCAL FIRST DRAFT ONLY: corrective migration for the pilot-created schema.
-- The pilot 0003 apply exposed deferred trigger execution under the authenticated
-- invoker. These trigger functions must run with the migration owner privileges
-- while retaining an empty search path and no client EXECUTE grants.

alter function app.reject_immutable_history() security definer;
alter function app.reject_immutable_history() set search_path = '';
alter function app.revalidate_game(uuid) security definer;
alter function app.revalidate_game(uuid) set search_path = '';
alter function app.revalidate_game_from_scoreline() security definer;
alter function app.revalidate_game_from_scoreline() set search_path = '';
alter function app.revalidate_game_from_submission() security definer;
alter function app.revalidate_game_from_submission() set search_path = '';
alter function app.revalidate_game_from_confirmation() security definer;
alter function app.revalidate_game_from_confirmation() set search_path = '';
alter function app.assert_two_submissions_before_verified() security definer;
alter function app.assert_two_submissions_before_verified() set search_path = '';
alter function app.assert_digital_event_ruleset() security definer;
alter function app.assert_digital_event_ruleset() set search_path = '';

revoke all on function app.reject_immutable_history() from public, anon, authenticated;
revoke all on function app.revalidate_game(uuid) from public, anon, authenticated;
revoke all on function app.revalidate_game_from_scoreline() from public, anon, authenticated;
revoke all on function app.revalidate_game_from_submission() from public, anon, authenticated;
revoke all on function app.revalidate_game_from_confirmation() from public, anon, authenticated;
revoke all on function app.assert_two_submissions_before_verified() from public, anon, authenticated;
revoke all on function app.assert_digital_event_ruleset() from public, anon, authenticated;
