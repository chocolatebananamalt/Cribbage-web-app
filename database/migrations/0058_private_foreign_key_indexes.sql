-- Support referential-integrity checks for private append-only histories.
-- These indexes are non-destructive and do not grant table access or change
-- any tournament, score, financial, or role behavior.

create index if not exists initial_seating_assignments_publication_scope_idx
  on app.initial_seating_assignments(publication_id, tournament_id);
create index if not exists initial_seating_assignments_roster_scope_idx
  on app.initial_seating_assignments(roster_entry_id, tournament_id);
create index if not exists initial_seating_publications_receipt_scope_idx
  on app.initial_seating_publications(operation_receipt_id, tournament_id);

create index if not exists roster_account_links_receipt_scope_idx
  on app.roster_account_links(operation_receipt_id, tournament_id);
create index if not exists roster_account_links_profile_id_idx
  on app.roster_account_links(profile_id);
create index if not exists roster_account_links_roster_scope_idx
  on app.roster_account_links(roster_entry_id, tournament_id);

create index if not exists roster_check_in_events_receipt_scope_idx
  on app.roster_check_in_events(operation_receipt_id, tournament_id);
create index if not exists roster_check_in_events_roster_scope_idx
  on app.roster_check_in_events(roster_entry_id, tournament_id);

create index if not exists tournament_setup_event_versions_revision_scope_idx
  on app.tournament_setup_event_versions(setup_revision_id, tournament_id);
create index if not exists tournament_setup_official_versions_revision_scope_idx
  on app.tournament_setup_official_versions(setup_revision_id, tournament_id);
create index if not exists tournament_setup_operation_conflicts_receipt_scope_idx
  on app.tournament_setup_operation_conflicts(prior_receipt_id, tournament_id, actor_profile_id);
create index if not exists tournament_setup_q_pool_versions_event_scope_idx
  on app.tournament_setup_q_pool_versions(setup_event_version_id, tournament_id, setup_revision_id);
create index if not exists tournament_setup_revisions_receipt_scope_idx
  on app.tournament_setup_revisions(operation_receipt_id, tournament_id);
create index if not exists tournament_setup_revisions_receipt_actor_scope_idx
  on app.tournament_setup_revisions(operation_receipt_id, tournament_id, actor_profile_id);
