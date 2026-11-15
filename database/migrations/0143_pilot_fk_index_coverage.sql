-- Cover every composite foreign key introduced by the activated-setup,
-- Rule 12, playoff, and settlement slices. These indexes do not change
-- application behavior; they keep referential checks and parent updates from
-- degrading as the pilot accumulates tournaments.

create index if not exists independent_card_correction_claims_game_scope_fk_idx
  on app.independent_card_correction_claims
  (correction_id, canonical_game_id, tournament_id, event_id);

create index if not exists independent_card_corrections_affected_participant_scope_fk_idx
  on app.independent_card_corrections
  (affected_participant_id, event_id, tournament_id);

create index if not exists rule12_affected_player_notices_correction_scope_fk_idx
  on app.rule12_affected_player_notices
  (correction_id, canonical_game_id, tournament_id, event_id);

create index if not exists rule12_affected_player_notices_participant_scope_fk_idx
  on app.rule12_affected_player_notices
  (participant_id, profile_id, event_id, tournament_id);

create index if not exists playoff_placement_rows_result_scope_fk_idx
  on app.standard_singles_playoff_placement_rows
  (playoff_result_version_id, tournament_id, event_id, qualification_result_version_id);

create index if not exists playoff_result_conflicts_tournament_fk_idx
  on app.standard_singles_playoff_result_conflicts
  (tournament_id);

create index if not exists playoff_result_versions_supersedes_scope_fk_idx
  on app.standard_singles_playoff_result_versions
  (supersedes_playoff_result_version_id, tournament_id, event_id, qualification_result_version_id);

create index if not exists settlement_mrp_claims_draft_scope_fk_idx
  on app.standard_singles_settlement_mrp_claims
  (settlement_draft_id, tournament_id, event_id, qualification_result_version_id);

create index if not exists settlement_playoff_bindings_draft_scope_fk_idx
  on app.standard_singles_settlement_playoff_bindings
  (settlement_draft_id, tournament_id, event_id, qualification_result_version_id);

create index if not exists tournament_setup_amendments_receipt_scope_fk_idx
  on app.tournament_setup_amendments
  (operation_receipt_id, tournament_id, actor_profile_id);

create index if not exists tournament_setup_amendments_revision_scope_fk_idx
  on app.tournament_setup_amendments
  (setup_revision_id, tournament_id);
