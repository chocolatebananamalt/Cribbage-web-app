-- Cover correction-policy history foreign keys without opening direct access.
create index correction_policy_versions_creator_profile_id_idx
  on app.correction_policy_versions(created_by_profile_id);

create index game_corrections_policy_version_scope_idx
  on app.game_corrections(tournament_id, policy_version);

create index correction_policy_operation_conflicts_actor_profile_id_idx
  on app.correction_policy_operation_conflicts(actor_profile_id);

create index correction_policy_operation_conflicts_tournament_id_idx
  on app.correction_policy_operation_conflicts(tournament_id);

create index correction_policy_operation_conflicts_prior_receipt_id_idx
  on app.correction_policy_operation_conflicts(prior_receipt_id);
