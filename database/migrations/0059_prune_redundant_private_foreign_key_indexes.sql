-- Remove only redundant advisory indexes from the empty pilot. Existing unique
-- and leading-column indexes already support the corresponding equality checks.
-- Keep the standalone profile index because no existing index leads with it.

drop index if exists app.initial_seating_assignments_publication_scope_idx;
drop index if exists app.initial_seating_assignments_roster_scope_idx;
drop index if exists app.initial_seating_publications_receipt_scope_idx;
drop index if exists app.roster_account_links_receipt_scope_idx;
drop index if exists app.roster_account_links_roster_scope_idx;
drop index if exists app.roster_check_in_events_receipt_scope_idx;
drop index if exists app.roster_check_in_events_roster_scope_idx;
drop index if exists app.tournament_setup_event_versions_revision_scope_idx;
drop index if exists app.tournament_setup_official_versions_revision_scope_idx;
drop index if exists app.tournament_setup_operation_conflicts_receipt_scope_idx;
drop index if exists app.tournament_setup_q_pool_versions_event_scope_idx;
drop index if exists app.tournament_setup_revisions_receipt_scope_idx;
drop index if exists app.tournament_setup_revisions_receipt_actor_scope_idx;
