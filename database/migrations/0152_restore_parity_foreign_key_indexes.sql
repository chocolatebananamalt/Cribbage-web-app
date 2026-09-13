-- Restore-parity repair for relationship indexes that an older disposable
-- validation chain could omit before migrations 0132/0143 were introduced.
-- These statements are idempotent and are no-ops on the current pilot.

create index if not exists initial_seating_assignments_publication_tournament_idx
  on app.initial_seating_assignments(publication_id,tournament_id);
create index if not exists initial_seating_assignments_roster_tournament_idx
  on app.initial_seating_assignments(roster_entry_id,tournament_id);
create index if not exists initial_seating_publications_receipt_tournament_idx
  on app.initial_seating_publications(operation_receipt_id,tournament_id);
create index if not exists registration_claims_link_tournament_idx
  on app.registration_claims(registration_link_id,tournament_id);
create index if not exists registration_link_conflicts_actor_idx
  on app.registration_link_operation_conflicts(actor_profile_id);
create index if not exists registration_link_conflicts_receipt_idx
  on app.registration_link_operation_conflicts(prior_receipt_id);
create index if not exists registration_link_conflicts_receipt_tournament_idx
  on app.registration_link_operation_conflicts(prior_receipt_id,prior_receipt_tournament_id);
create index if not exists registration_link_conflicts_tournament_idx
  on app.registration_link_operation_conflicts(tournament_id);
create index if not exists registration_link_heads_link_tournament_idx
  on app.tournament_registration_link_heads(registration_link_id,tournament_id);
create index if not exists registration_link_lifecycle_events_actor_idx
  on app.registration_link_lifecycle_events(actor_profile_id);
create index if not exists registration_link_lifecycle_events_link_tournament_idx
  on app.registration_link_lifecycle_events(registration_link_id,tournament_id);
create index if not exists registration_link_lifecycle_events_receipt_tournament_idx
  on app.registration_link_lifecycle_events(operation_receipt_id,tournament_id);
create index if not exists registration_link_lifecycle_events_tournament_idx
  on app.registration_link_lifecycle_events(tournament_id);
create index if not exists registration_links_tournament_idx
  on app.tournament_registration_links(tournament_id);
create index if not exists roster_account_links_receipt_tournament_idx
  on app.roster_account_links(operation_receipt_id,tournament_id);
create index if not exists roster_account_links_roster_tournament_idx
  on app.roster_account_links(roster_entry_id,tournament_id);
create index if not exists roster_check_in_events_receipt_tournament_idx
  on app.roster_check_in_events(operation_receipt_id,tournament_id);
create index if not exists roster_check_in_events_roster_tournament_idx
  on app.roster_check_in_events(roster_entry_id,tournament_id);
create index if not exists setup_conflicts_receipt_tournament_actor_idx
  on app.tournament_setup_operation_conflicts(prior_receipt_id,tournament_id,actor_profile_id);
create index if not exists setup_event_versions_revision_tournament_idx
  on app.tournament_setup_event_versions(setup_revision_id,tournament_id);
create index if not exists setup_official_versions_revision_tournament_idx
  on app.tournament_setup_official_versions(setup_revision_id,tournament_id);
create index if not exists setup_q_pool_versions_event_tournament_revision_idx
  on app.tournament_setup_q_pool_versions(setup_event_version_id,tournament_id,setup_revision_id);
create index if not exists setup_revisions_receipt_tournament_actor_idx
  on app.tournament_setup_revisions(operation_receipt_id,tournament_id,actor_profile_id);
create index if not exists setup_revisions_receipt_tournament_idx
  on app.tournament_setup_revisions(operation_receipt_id,tournament_id);
