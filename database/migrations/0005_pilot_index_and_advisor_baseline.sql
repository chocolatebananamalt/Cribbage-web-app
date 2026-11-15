-- LOCAL FIRST DRAFT ONLY: do not apply to Supabase or any shared database yet.
-- Advisor baseline for the already-created pilot schema. These indexes cover
-- foreign-key joins/restrictive deletes identified by the Supabase advisor.
-- The app schema intentionally remains private and policy-free in this pilot:
-- direct anon/authenticated table DML is revoked; only narrowly scoped,
-- security-definer RPCs with auth.uid() checks are executable by authenticated.
-- The app UI is magic-link/OTP only. Supabase's hosted Email provider combines
-- password and magic-link settings, so no password-only switch is assumed.
-- Password authentication remains unsupported by the application and a raw
-- provider account has no tournament authority.

create index if not exists audit_events_actor_profile_id_idx
  on app.audit_events (actor_profile_id);
create index if not exists audit_events_canonical_game_scope_idx
  on app.audit_events (canonical_game_id, tournament_id);
create index if not exists audit_events_operation_receipt_scope_idx
  on app.audit_events (operation_receipt_id, tournament_id);
create index if not exists event_participants_event_scope_idx
  on app.event_participants (event_id, tournament_id);
create index if not exists operation_conflicts_prior_receipt_id_idx
  on app.operation_conflicts (prior_receipt_id);
create index if not exists score_confirmations_confirmation_actor_id_idx
  on app.score_confirmations (confirmation_actor_id);
create index if not exists score_submissions_submitter_scope_idx
  on app.score_submissions (submitter_participant_id, submitter_profile_id, event_id, tournament_id);
create index if not exists score_submissions_submitter_profile_id_idx
  on app.score_submissions (submitter_profile_id);
create index if not exists tournaments_director_profile_id_idx
  on app.tournaments (director_profile_id);
