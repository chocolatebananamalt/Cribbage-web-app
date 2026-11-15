-- Keep transient Judge Calls tied to an existing event and give PostgreSQL
-- efficient support for the event and requester foreign-key checks.

alter table app.active_judge_calls
  add constraint active_judge_calls_event_scope_fkey
  foreign key(event_id,tournament_id)
  references app.events(id,tournament_id)
  on delete restrict;

create index active_judge_calls_event_scope_idx
  on app.active_judge_calls(event_id,tournament_id);
create index active_judge_calls_requester_idx
  on app.active_judge_calls(requested_by_profile_id);
