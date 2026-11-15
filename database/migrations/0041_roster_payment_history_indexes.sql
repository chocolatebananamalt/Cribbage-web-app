-- Covers the composite roster/tournament foreign key used by the immutable
-- manual-payment ledger. This keeps restrictive FK checks and scoped payment
-- history reads from degrading as a tournament roster grows.

create index roster_payment_events_roster_entry_scope_idx
  on app.roster_payment_events(roster_entry_id, tournament_id);
