-- Cover the foreign-key and recovery lookups introduced by the finalization
-- and replacement lifecycle.  These are private audit tables, but directors
-- need their pre-play recovery history to remain responsive at larger events.

create index event_change_operations_actor_idx
  on app.event_change_operations(actor_profile_id);
create index event_change_operations_original_event_scope_idx
  on app.event_change_operations(original_event_id, tournament_id);
create index event_change_operations_replacement_event_scope_idx
  on app.event_change_operations(replacement_event_id, tournament_id)
  where replacement_event_id is not null;

create index event_replacement_transfer_records_source_event_scope_idx
  on app.event_replacement_transfer_records(source_event_id, tournament_id);
create index event_replacement_transfer_records_replacement_event_scope_idx
  on app.event_replacement_transfer_records(replacement_event_id, tournament_id);
create index event_replacement_transfer_records_payment_event_idx
  on app.event_replacement_transfer_records(payment_event_id)
  where payment_event_id is not null;
create index event_replacement_transfer_records_roster_entry_idx
  on app.event_replacement_transfer_records(roster_entry_id)
  where roster_entry_id is not null;
create index event_replacement_transfer_records_tournament_idx
  on app.event_replacement_transfer_records(tournament_id);
