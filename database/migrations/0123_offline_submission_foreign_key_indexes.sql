-- Cover foreign-key lookups introduced by the offline replay foundation.

create index offline_device_keys_actor_profile_id_idx
  on app.offline_device_keys(actor_profile_id);

create index offline_score_capabilities_game_scope_idx
  on app.offline_score_capabilities(canonical_game_id, tournament_id, event_id);

create index offline_score_capabilities_device_actor_session_idx
  on app.offline_score_capabilities(device_key_id, actor_profile_id, session_binding_id);

create index offline_score_replay_conflicts_prior_receipt_id_idx
  on app.offline_score_replay_conflicts(prior_receipt_id)
  where prior_receipt_id is not null;
