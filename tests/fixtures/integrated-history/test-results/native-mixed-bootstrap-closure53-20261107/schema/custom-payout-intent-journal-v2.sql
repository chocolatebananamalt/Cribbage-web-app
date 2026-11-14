-- UNEXECUTED local storage candidate, not a migration or usable save endpoint.
-- No existing writer, activation guard, method, row, permission or receipt is
-- changed. A future single-transaction writer must validate the whole envelope,
-- lock current tournament/role/setup, perform CAS and populate these bindings.
begin;
create table app.setup_custom_payout_batches_v2(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 setup_revision_id uuid not null, base_setup_revision_id uuid,
 base_setup_version integer not null check(base_setup_version>=0),
 base_source_digest text not null check(base_source_digest~'^[a-f0-9]{64}$'),
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 core_receipt_id uuid not null,request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 check((base_setup_version=0 and base_setup_revision_id is null)or(base_setup_version>0 and base_setup_revision_id is not null)),
 check(jsonb_typeof(request_payload)='object'and request_payload->>'kind'is not distinct from'setup-custom-payouts-v2'),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('setup-custom-payouts-v2',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex')),
 unique(tournament_id,setup_revision_id),unique(actor_id,operation_id),
 unique(id,tournament_id,setup_revision_id),
 foreign key(setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id),
 foreign key(base_setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id),
 foreign key(core_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);
create table app.setup_custom_payout_intents_v2(
 id uuid primary key default extensions.gen_random_uuid(),batch_id uuid not null,
 tournament_id uuid not null,setup_revision_id uuid not null,setup_event_version_id uuid not null,
 scope text not null check(scope in('q','side','satellite')),pool_slot smallint,
 ratio_denominator integer not null check(ratio_denominator>0),
 amount_method text,
 original_intent jsonb not null check(jsonb_typeof(original_intent)='object'and original_intent->>'kind'is not distinct from'custom-payout-intent-v1'),
 check(original_intent->>'scope'is not distinct from scope),
 check(coalesce(jsonb_typeof(original_intent->'ratioDenominator')='number'and(original_intent->>'ratioDenominator')::numeric=ratio_denominator,false)),
 check((scope='q'and pool_slot is not null and pool_slot between 1 and 2)or(scope='side'and pool_slot is not null and pool_slot between 1 and 6)or(scope='satellite'and pool_slot is null)),
 -- Satellite's recipient count is not a distribution method. It cannot be
 -- accidentally promoted to a Q/Side calculated payout by this journal.
 check((scope in('q','side')and amount_method is not null and amount_method='graduated-custom-ratio-largest-remainder-5usd-v3')or(scope='satellite'and amount_method is null)),
 foreign key(batch_id,tournament_id,setup_revision_id)references app.setup_custom_payout_batches_v2(id,tournament_id,setup_revision_id),
 foreign key(setup_event_version_id,tournament_id,setup_revision_id)references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id)
);
create unique index setup_custom_payout_intent_slot_v2 on app.setup_custom_payout_intents_v2(batch_id,setup_event_version_id,scope,pool_slot)where pool_slot is not null;
create unique index setup_custom_payout_intent_satellite_v2 on app.setup_custom_payout_intents_v2(batch_id,setup_event_version_id)where scope='satellite';
do $$declare n text;begin
 foreach n in array array['setup_custom_payout_batches_v2','setup_custom_payout_intents_v2']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;
-- No public wrapper or insert grant. Storage constraints are defense in depth,
-- NOT sufficient envelope/source/receipt authorization. Do not apply or expose
-- before the writer, exact replay, source binding and DB acceptance are complete.
commit;
