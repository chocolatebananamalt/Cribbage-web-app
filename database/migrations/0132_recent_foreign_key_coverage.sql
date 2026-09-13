-- Cover recent compound and single-column foreign keys used by deletion checks
-- and scoped tournament reads. These indexes do not expose app tables.

create index if not exists device_recoveries_game_scope_idx on app.device_failure_recoveries(canonical_game_id, tournament_id, event_id);
create index if not exists device_recoveries_receipt_scope_idx on app.device_failure_recoveries(operation_receipt_id, tournament_id);
create index if not exists device_recoveries_round_scope_idx on app.device_failure_recoveries(round_id, tournament_id, event_id);
create index if not exists device_recovery_evidence_case_game_idx on app.device_failure_recovery_evidence(recovery_id, canonical_game_id);
create index if not exists device_recovery_evidence_case_scope_idx on app.device_failure_recovery_evidence(recovery_id, tournament_id, event_id);
create index if not exists device_recovery_conflicts_tournament_idx on app.device_failure_recovery_operation_conflicts(tournament_id);
create index if not exists device_recovery_projection_case_game_idx on app.device_failure_recovery_projections(recovery_id, canonical_game_id);
create index if not exists device_recovery_projection_case_scope_idx on app.device_failure_recovery_projections(recovery_id, tournament_id, event_id);
create index if not exists device_recovery_state_receipt_scope_idx on app.device_failure_recovery_state_events(operation_receipt_id, tournament_id);
create index if not exists device_recovery_state_case_game_idx on app.device_failure_recovery_state_events(recovery_id, canonical_game_id);
create index if not exists device_recovery_state_case_scope_idx on app.device_failure_recovery_state_events(recovery_id, tournament_id, event_id);

create index if not exists event_schedule_games_game_scope_idx on app.event_schedule_games(canonical_game_id, tournament_id, event_id);
create index if not exists event_schedule_games_publication_scope_idx on app.event_schedule_games(publication_id, tournament_id, event_id);
create index if not exists event_schedule_publications_event_scope_idx on app.event_schedule_publications(event_id, tournament_id);
create index if not exists event_schedule_publications_receipt_scope_idx on app.event_schedule_publications(operation_receipt_id, tournament_id);
create index if not exists event_schedule_publications_tournament_idx on app.event_schedule_publications(tournament_id);

create index if not exists qualification_conflicts_tournament_idx on app.qualification_finalization_conflicts(tournament_id);
create index if not exists qualification_rows_result_scope_idx on app.qualification_result_rows(result_version_id, tournament_id, event_id);
create index if not exists qualification_versions_event_scope_idx on app.qualification_result_versions(event_id, tournament_id);
create index if not exists qualification_versions_hnq_scope_idx on app.qualification_result_versions(high_non_qualifier_participant_id, event_id, tournament_id);
create index if not exists qualification_versions_receipt_scope_idx on app.qualification_result_versions(operation_receipt_id, tournament_id);
create index if not exists qualification_versions_ruleset_scope_idx on app.qualification_result_versions(ruleset_version_id, tournament_id);
create index if not exists qualification_versions_schedule_scope_idx on app.qualification_result_versions(schedule_publication_id, tournament_id, event_id);
create index if not exists qualification_versions_supersedes_idx on app.qualification_result_versions(supersedes_result_version_id);

create index if not exists roster_activation_events_actor_idx on app.roster_account_activation_events(actor_profile_id);
create index if not exists roster_activation_events_request_idx on app.roster_account_activation_events(request_id);
create index if not exists roster_activation_events_tournament_idx on app.roster_account_activation_events(tournament_id);
create index if not exists roster_activation_requests_profile_idx on app.roster_account_activation_requests(profile_id);
create index if not exists roster_activations_issuer_idx on app.roster_account_activations(issued_by_profile_id);
