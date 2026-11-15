-- Keep correction/audit history lookups and foreign-key enforcement predictable
-- as a tournament accumulates corrections. These indexes add no client access.
create index if not exists game_corrections_canonical_scope_idx
  on app.game_corrections (canonical_game_id, tournament_id, event_id);
create index if not exists game_corrections_editor_profile_id_idx
  on app.game_corrections (editor_profile_id);
create index if not exists correction_state_events_correction_scope_idx
  on app.correction_state_events (correction_id, canonical_game_id, tournament_id, event_id);
create index if not exists correction_state_events_actor_profile_id_idx
  on app.correction_state_events (actor_profile_id);
create index if not exists correction_operation_conflicts_actor_profile_id_idx
  on app.correction_operation_conflicts (actor_profile_id);
create index if not exists correction_operation_conflicts_prior_receipt_id_idx
  on app.correction_operation_conflicts (prior_receipt_id);
