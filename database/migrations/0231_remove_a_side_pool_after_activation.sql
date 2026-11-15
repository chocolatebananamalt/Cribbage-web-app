-- A Side Pool configured by mistake could not be removed once the setup
-- revision was activated.
--
-- SidePoolEditor's "Remove Side Pool" button only exists while the revision is
-- still being edited. Activation closes that editor, and from that moment the
-- pool is operational: it appears on the Side Pools page beside the real pools,
-- invites an election against a pool nobody meant to create, and holds one of
-- the six active slots the event is allowed. No screen in the app could take it
-- back out.
--
-- This is RETIREMENT, not deletion, and the schema already carried the
-- mechanism. app.event_side_pool_definition_versions is append-only with an
-- `active` flag, and every reader already filters on it:
--
--   * get_event_side_pool_workspace_base_v1 (0170, redefined by 0219) takes the
--     newest version per pool and keeps only "where definition.active";
--   * event_side_pool_active_name_unique_idx (0175) is partial "where active";
--   * the six-pool cap in add_event_side_pool_v1 (0175) and in
--     materialize_tournament_setup_side_pools_v1 (0198) counts active rows only.
--
-- So appending a version with active=false takes the pool off the director's
-- screen, frees its name, and frees its slot, while destroying nothing and
-- requiring no change to a single reader. It is the same principle 0205 applied
-- to the roster and 0224 applied to the tournament: history is evidence, so the
-- record is put away rather than removed.
--
-- WHY NOT DELETE. app.tournament_setup_side_pool_materializations holds a
-- unique(pool_id) row referencing the pool with "on delete restrict", so a hard
-- delete would be refused by the foreign key anyway, and forcing it through
-- would erase the only link between the activated setup revision and what that
-- activation actually built.
--
-- WHY THIS DOES NOT TOUCH configure_tournament_setup_side_pools_v1. Its
-- setup_lifecycle_closed guard is correct: an activated revision is immutable
-- history, and 0227 relaxed the neighbouring guard only for revisions recorded
-- in app.tournament_setup_amendments, which are by definition still open. The
-- thing a director wants to remove after activation is not the setup record, it
-- is the operational pool the activation created, and that pool has its own
-- versioned definition table. Rewriting a closed revision to fix an operational
-- object would be the wrong repair at the wrong layer.
--
-- THE MONEY RULE, enforced here and not only in the UI. A pool is retirable
-- only when it has no history at all: no election and no team election, no
-- payout and no team payout, no posted payout policy, and no reconciliation.
-- Money reaches a pool through an election, so refusing on any election row
-- refuses on any money, including money that was received and later corrected
-- back to zero. A pool anyone has paid into is money, and money is never
-- deleted; that pool keeps its rows and the director voids the election through
-- set_event_side_pool_election_v1, which is the path that already exists for it.
--
-- WHY THERE IS NO RESTORE FUNCTION. Because retirement is allowed only for a
-- pool with zero history, there is nothing to restore. The definition table
-- still supports a true restore, an appended version with active=true, if a
-- later feature ever needs one.
--
-- WHAT RETIREMENT FREES, MEASURED AGAINST PRODUCTION 2026-09-19. The slot is
-- freed and the pool leaves the director's screen. The NAME IS NOT FREED, and
-- an earlier draft of this comment claimed it was. Both halves were measured:
--
--   * get_event_side_pool_workspace_v1 stopped listing the pool, going from
--     "$10 | $20 | $50 | $100" to "$20 | $50 | $100";
--   * the six-pool cap in add_event_side_pool_v1 counts
--     "distinct on(pool_id) ... order by version desc", which IS newest-version
--     aware, so the active count fell 4 -> 3 and adding "$15 Side Pool"
--     succeeded;
--   * re-adding "$10 Side Pool" was REFUSED with duplicate_pool_name, even
--     though that function's own name check also filters on the newest version
--     and evaluates to false. The refusal comes from its trailing
--     "exception when unique_violation" handler firing on
--     event_side_pool_active_name_unique_idx.
--
-- The reason is that the index is over ROWS, not over newest-version-per-pool:
--   unique (event_id, lower(trim(display_name))) where active
-- Retirement appends version 2 with active=false, but version 1 still has
-- active=true and stays indexed forever. app.event_side_pool_definition_versions
-- carries event_side_pool_definitions_immutable (BEFORE DELETE OR UPDATE ->
-- app.reject_immutable_history()), so that version 1 row can never be updated or
-- deleted. No change to this function can free the name; only the index can.
--
-- CONSEQUENCE, AND IT IS A REAL DEAD END. A director who retires a pool created
-- by mistake and then decides they did want it cannot recreate it under the same
-- name, and the refusal says only "duplicate_pool_name" while no pool by that
-- name is on screen. That is the same shape of dead end this migration exists to
-- remove. It is narrower than the original, because the pool is gone from the
-- screen and the slot is back, so it does not block a tournament, and it is
-- deferred to a follow-up migration after the 2026-09-19 tournament rather than
-- fixed here. The fix is an index change, not a function change: either replace
-- event_side_pool_active_name_unique_idx with a constraint trigger that tests
-- newest-version-per-pool, or drop it and rely on the
-- pg_advisory_xact_lock('side-pools:'||event_id) that add_event_side_pool_v1,
-- materialize_tournament_setup_side_pools_v1 and this function all take. Dropping
-- it removes the only schema-level guarantee, so before taking that route confirm
-- by reading that EVERY writer takes that lock. That is a reviewed change, not an
-- index drop on production on the morning of an event.

create or replace function public.retire_event_side_pool_v1(
  p_actor_id uuid, p_tournament_id uuid, p_event_id uuid, p_pool_id uuid,
  p_reason text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_hash text; v_existing app.operation_receipts%rowtype;
  v_receipt uuid := extensions.gen_random_uuid();
  v_definition app.event_side_pool_definition_versions%rowtype;
  v_elections bigint; v_team_elections bigint; v_payouts bigint; v_team_payouts bigint;
  v_policies bigint; v_reconciliations bigint; v_collected bigint; v_activity jsonb;
  v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only side pool retirement';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_pool_id is null
     or p_operation_id is null or length(v_reason) not between 1 and 500 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'retire_event_side_pool_v1', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    p_pool_id::text, v_reason, p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  -- The same key add_event_side_pool_v1 and materialize_tournament_setup_side_pools_v1
  -- take, so a concurrent add for this event cannot interleave with the slot and
  -- name that this retirement frees.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pools:'||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='retire_event_side_pool_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;

  -- A co-director may retire an empty pool. Setup's Remove Side Pool button is
  -- open to both roles and so is add_event_side_pool_v1, so restricting the undo
  -- to the primary director would leave a co-director able to create the mistake
  -- and unable to clear it. Archiving a whole tournament is primary-director-only
  -- (0224) because it hides every record from everyone; this hides an empty pool.
  perform 1 from app.tournament_roles
    where tournament_id=p_tournament_id and profile_id=p_actor_id
      and role in('director','co_director') for update;
  if not found then return jsonb_build_object('status','rejected','code','not_director'); end if;

  if not exists(select 1 from app.event_side_pools
    where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id) then
    return jsonb_build_object('status','rejected','code','pool_unavailable');
  end if;
  select * into v_definition from app.event_side_pool_definition_versions
    where pool_id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id
    order by version desc limit 1;
  if not found then return jsonb_build_object('status','rejected','code','pool_unavailable'); end if;
  if not v_definition.active then
    return jsonb_build_object('status','side_pool_already_retired','poolId',p_pool_id,'eventId',p_event_id);
  end if;

  -- Both beneficiary families are counted. Singles money lives in
  -- event_side_pool_election_versions (0165) and team money in the separate
  -- event_side_pool_team_election_versions (0176); reading only the first would
  -- let a pool that a team has paid into be retired as if it were empty.
  select
    (select count(*) from app.event_side_pool_election_versions where pool_id=p_pool_id),
    (select count(*) from app.event_side_pool_team_election_versions where pool_id=p_pool_id),
    (select count(*) from app.event_side_pool_payout_versions where pool_id=p_pool_id),
    (select count(*) from app.event_side_pool_team_payout_versions where pool_id=p_pool_id),
    (select count(*) from app.event_side_pool_policy_versions where pool_id=p_pool_id),
    (select count(*) from app.event_side_pool_reconciliations where pool_id=p_pool_id)
  into v_elections, v_team_elections, v_payouts, v_team_payouts, v_policies, v_reconciliations;

  -- Latest version per beneficiary, the same arithmetic the workspace reports as
  -- collectedMinor, so the number the director is told matches the number on screen.
  select coalesce((select sum(latest.amount_received_minor) from(
      select distinct on(singles.participant_id) singles.* from app.event_side_pool_election_versions singles
      where singles.pool_id=p_pool_id order by singles.participant_id, singles.version desc
    ) latest where latest.elected),0)
    + coalesce((select sum(latest.amount_received_minor) from(
      select distinct on(teams.team_entry_id) teams.* from app.event_side_pool_team_election_versions teams
      where teams.pool_id=p_pool_id order by teams.team_entry_id, teams.version desc
    ) latest where latest.elected),0)
  into v_collected;

  v_activity := jsonb_build_object(
    'elections',v_elections,'teamElections',v_team_elections,'payouts',v_payouts,
    'teamPayouts',v_team_payouts,'policies',v_policies,'reconciliations',v_reconciliations,
    'collectedMinor',v_collected);

  -- Money first, so a pool somebody paid into says so plainly rather than being
  -- reported as generic activity.
  if v_collected > 0 then
    return jsonb_build_object('status','rejected','code','side_pool_has_money','activity',v_activity);
  end if;
  -- Any row at all, including an election already corrected to elected=false and
  -- a payout already voided. Those rows are the evidence that this pool was used,
  -- and a retirement that hid them would hide the correction with them.
  if v_elections + v_team_elections + v_payouts + v_team_payouts + v_policies + v_reconciliations > 0 then
    return jsonb_build_object('status','rejected','code','side_pool_has_activity','activity',v_activity);
  end if;

  v_response := jsonb_build_object(
    'status','side_pool_retired','poolId',p_pool_id,'eventId',p_event_id,
    'displayName',v_definition.display_name,'version',v_definition.version+1);

  -- The receipt is written before the definition version because
  -- event_side_pool_definition_versions carries a foreign key on
  -- (operation_receipt_id, tournament_id). 0224 writes its receipt last; that
  -- order cannot work here.
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(v_receipt,p_actor_id,p_tournament_id,'retire_event_side_pool_v1',p_pool_id,
    v_hash,p_operation_id,'accepted',v_response,clock_timestamp());

  -- Name, category and fee are carried forward unchanged. Only `active` moves,
  -- so the retired version still says exactly what the pool was.
  insert into app.event_side_pool_definition_versions(pool_id,tournament_id,event_id,version,
    category_code,display_name,entry_fee_minor,active,actor_profile_id,operation_receipt_id)
  values(p_pool_id,p_tournament_id,p_event_id,v_definition.version+1,
    v_definition.category_code,v_definition.display_name,v_definition.entry_fee_minor,false,
    p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'event_side_pool',p_pool_id,'side_pool_retired',
    jsonb_build_object('active',true,'version',v_definition.version,
      'displayName',v_definition.display_name,'entryFeeMinor',v_definition.entry_fee_minor),
    v_response || jsonb_build_object('reason',v_reason));

  return v_response;
end;
$$;

revoke all on function public.retire_event_side_pool_v1(uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.retire_event_side_pool_v1(uuid,uuid,uuid,uuid,text,uuid) to service_role;

notify pgrst,'reload schema';
