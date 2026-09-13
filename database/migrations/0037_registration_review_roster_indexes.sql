-- Cover every registration-review and roster foreign key reported by the
-- Supabase advisor. These indexes do not grant access or change business state.

create index registration_claim_decisions_actor_profile_id_idx
  on app.registration_claim_decisions(actor_profile_id);
create index registration_claim_decisions_claim_scope_idx
  on app.registration_claim_decisions(claim_id, tournament_id);
create index registration_claim_decisions_duplicate_claim_scope_idx
  on app.registration_claim_decisions(duplicate_of_claim_id, tournament_id);
create index registration_claim_decisions_operation_receipt_scope_idx
  on app.registration_claim_decisions(operation_receipt_id, tournament_id);
create index registration_claim_operation_conflicts_actor_profile_id_idx
  on app.registration_claim_operation_conflicts(actor_profile_id);
create index registration_claim_operation_conflicts_tournament_id_idx
  on app.registration_claim_operation_conflicts(tournament_id);
create index registration_claim_operation_conflicts_prior_receipt_id_idx
  on app.registration_claim_operation_conflicts(prior_receipt_id);

create index tournament_roster_entries_approval_decision_scope_idx
  on app.tournament_roster_entries(
    approval_decision_id, tournament_id, source_claim_id, approval_decision
  );
create index tournament_roster_entries_source_claim_scope_idx
  on app.tournament_roster_entries(source_claim_id, tournament_id);
create index tournament_roster_entries_operation_receipt_scope_idx
  on app.tournament_roster_entries(operation_receipt_id, tournament_id);
