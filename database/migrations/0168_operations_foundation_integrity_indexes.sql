-- Integrity/index follow-up for the event operations foundations.

alter table app.event_side_pool_definition_versions add constraint event_side_pool_category_fee_check
  check(entry_fee_minor=(category_code::integer*100));
create trigger event_side_pools_immutable before update or delete on app.event_side_pools for each row execute function app.reject_immutable_history();
create trigger event_teams_immutable before update or delete on app.event_teams for each row execute function app.reject_immutable_history();
create trigger event_team_members_immutable before update or delete on app.event_team_members for each row execute function app.reject_immutable_history();
create trigger event_team_entries_immutable before update or delete on app.event_team_entries for each row execute function app.reject_immutable_history();
create trigger event_team_financial_contributions_immutable before update or delete on app.event_team_financial_contributions for each row execute function app.reject_immutable_history();

create index event_side_pools_event_scope_idx on app.event_side_pools(event_id,tournament_id);
create index event_side_pool_definitions_pool_scope_idx on app.event_side_pool_definition_versions(pool_id,tournament_id,event_id);
create index event_side_pool_definitions_tournament_idx on app.event_side_pool_definition_versions(tournament_id);
create index event_side_pool_definitions_actor_idx on app.event_side_pool_definition_versions(actor_profile_id);
create index event_side_pool_definitions_receipt_idx on app.event_side_pool_definition_versions(operation_receipt_id,tournament_id);
create index event_side_pool_elections_participant_idx on app.event_side_pool_election_versions(participant_id,event_id,tournament_id);
create index event_side_pool_elections_pool_idx on app.event_side_pool_election_versions(pool_id,tournament_id,event_id);
create index event_side_pool_elections_actor_idx on app.event_side_pool_election_versions(actor_profile_id);
create index event_side_pool_elections_receipt_idx on app.event_side_pool_election_versions(operation_receipt_id,tournament_id);
create index event_side_pool_payouts_participant_idx on app.event_side_pool_payout_versions(participant_id,event_id,tournament_id);
create index event_side_pool_payouts_pool_idx on app.event_side_pool_payout_versions(pool_id,tournament_id,event_id);
create index event_side_pool_payouts_actor_idx on app.event_side_pool_payout_versions(actor_profile_id);
create index event_side_pool_payouts_receipt_idx on app.event_side_pool_payout_versions(operation_receipt_id,tournament_id);
create index event_teams_event_idx on app.event_teams(event_id,tournament_id);
create index event_teams_creator_idx on app.event_teams(created_by_profile_id);
create index event_team_members_roster_idx on app.event_team_members(roster_entry_id,tournament_id);
create index event_team_members_profile_idx on app.event_team_members(profile_id);
create index event_team_contributions_roster_idx on app.event_team_financial_contributions(roster_entry_id,tournament_id);
create index event_participant_status_events_actor_idx on app.event_participant_status_events(actor_profile_id);
create index event_participant_status_events_receipt_idx on app.event_participant_status_events(operation_receipt_id,tournament_id);

notify pgrst,'reload schema';
