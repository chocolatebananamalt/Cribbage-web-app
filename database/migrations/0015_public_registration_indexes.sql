-- Completes the foreign-key covering index set after the initial pilot scan.
create index if not exists registration_claims_registration_link_id_idx
  on app.registration_claims (registration_link_id);
