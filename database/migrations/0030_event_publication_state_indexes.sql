-- Cover the composite event/tournament publication guard foreign key.
create index event_publication_states_event_scope_idx
  on app.event_publication_states(event_id, tournament_id);
