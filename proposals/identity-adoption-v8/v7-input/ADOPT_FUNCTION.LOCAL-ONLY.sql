-- Execute after exact derived inner writer; neither function is app-facing.
begin;
create function identity_legacy_v1.adopt(actor uuid,sid uuid,tid uuid,op uuid,q jsonb,expected_source text,review_confirmed boolean)returns jsonb language plpgsql security invoker set search_path='' as $$
declare r app.tournament_roster_entries%rowtype;prior identity_legacy_v1.adoptions%rowtype;outcome jsonb;rid uuid;begin
if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;
perform 1 from auth.sessions where id=sid and user_id=actor for share;
perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for share;
-- Align with known enrollment/account-link writers; source-table lock prevents a fixture source phantom during review/commit.
perform 1 from app.tournaments where id=tid for update;
lock table app.tournament_roster_entries,app.roster_account_links,app.event_participants,app.roster_entry_lifecycle_events in share mode;
if not identity_trial_v4.authorized(actor,sid,tid)then raise exception'identity_access_changed';end if;
if op is null or review_confirmed is distinct from true or expected_source!~'^[a-f0-9]{64}$'or(q->>'rosterEntryId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then return jsonb_build_object('status','explicit_review_required');end if;
rid:=(q->>'rosterEntryId')::uuid;
insert into identity_trial_v4.heads(tournament_id)values(tid)on conflict do nothing;
perform 1 from identity_trial_v4.heads where tournament_id=tid for update;
lock table identity_trial_v4.issued,identity_trial_v4.issued_retired in share row exclusive mode;
select*into prior from identity_legacy_v1.adoptions where tournament_id=tid and actor_id=actor and operation_id=op;
if found then
if prior.request is distinct from q or prior.source_digest is distinct from expected_source then return jsonb_build_object('status','idempotency_conflict');end if;
if not identity_legacy_v1.read_safe(actor,sid,tid)then return jsonb_build_object('status','legacy_binding_changed');end if;
return identity_trial_v4.reconcile(actor,sid,tid,op,q);end if;
select*into r from app.tournament_roster_entries where id=rid and tournament_id=tid;
if not found then return jsonb_build_object('status','legacy_target_unavailable');end if;
if expected_source is distinct from identity_legacy_v1.digest(tid,rid)then return jsonb_build_object('status','stale_legacy_source');end if;
if exists(select 1 from identity_legacy_v1.adoptions where tournament_id=tid and roster_id=rid)or exists(select 1 from identity_trial_v4.facts where tournament_id=tid and roster_id=rid)then return jsonb_build_object('status','already_adopted');end if;
if exists(select 1 from app.roster_account_links where tournament_id=tid and roster_entry_id=rid)or exists(select 1 from app.event_participants where tournament_id=tid and roster_entry_id=rid and profile_id is not null)then return jsonb_build_object('status','account_identity_review_required');end if;
if coalesce((select event_type from app.roster_entry_lifecycle_events where tournament_id=tid and roster_entry_id=rid order by version desc limit 1),'active')='withdrawn'then return jsonb_build_object('status','legacy_target_withdrawn');end if;
if r.scorecard_type<>'paper'or q->'entry'->>'scorecardType'<>'paper'then return jsonb_build_object('status','digital_identity_review_required');end if;
if r.claimed_first_name is null or r.claimed_last_name is null then return jsonb_build_object('status','legal_name_review_required');end if;
if q->>'action'<>'create'or q->'entry'->>'firstName'<>r.claimed_first_name or q->'entry'->>'lastName'<>r.claimed_last_name or q->'entry'->>'email'<>coalesce(r.claimed_email,'')or q->'entry'->>'accNumber'<>coalesce(r.claimed_acc_number,'')then return jsonb_build_object('status','legacy_identity_mismatch');end if;
-- Historical address is absent: director must collect a complete address and explicitly review the exact target, not infer a match.
if identity_trial_v4.match_key(q->'entry',q->'address')is null then return jsonb_build_object('status','address_review_required');end if;
-- A supplied number never merges identities. Existing/retired registry ownership is an explicit conflict.
if coalesce(q->'entry'->>'accNumber','')<>''then
perform pg_advisory_xact_lock(hashtextextended('identity-issued:'||(q->'entry'->>'accNumber'),0));
if exists(select 1 from identity_trial_v4.issued where identity_legacy_v1.reference_key(number)=identity_legacy_v1.reference_key(q->'entry'->>'accNumber'))or exists(select 1 from identity_trial_v4.issued_retired where identity_legacy_v1.reference_key(number)=identity_legacy_v1.reference_key(q->'entry'->>'accNumber'))then return jsonb_build_object('status','issued_identity_review_required');end if;
end if;
outcome:=identity_legacy_v1.write_adoption_inner(actor,sid,tid,op,q);
if outcome->>'status'='recorded'then
if outcome->'player'->>'rosterEntryId'<>rid::text then raise exception'legacy_id_changed';end if;
insert into identity_legacy_v1.adoptions(tournament_id,roster_id,subject_id,actor_id,operation_id,request,source_digest)values(tid,rid,(outcome->'player'->>'playerIdentityId')::uuid,actor,op,q,expected_source);
end if;return outcome;end$$;
create function identity_legacy_v1.guard(actor uuid,sid uuid,tid uuid)returns void language plpgsql security invoker set search_path='' as $$begin
if not identity_trial_v4.authorized(actor,sid,tid)then raise exception'identity_access_changed';end if;
perform 1 from auth.sessions where id=sid and user_id=actor for share;
perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for share;
perform 1 from app.tournaments where id=tid for update;
lock table app.tournament_roster_entries,app.roster_account_links,app.event_participants,app.roster_entry_lifecycle_events in share mode;
perform 1 from identity_trial_v4.heads where tournament_id=tid for update;
lock table identity_trial_v4.issued,identity_trial_v4.issued_retired in share row exclusive mode;
if not identity_legacy_v1.read_safe(actor,sid,tid)then raise exception'legacy_binding_changed';end if;
end$$;
revoke all on all tables in schema identity_legacy_v1 from public,anon,authenticated,service_role;
revoke all on all functions in schema identity_legacy_v1 from public,anon,authenticated,service_role;
commit;
