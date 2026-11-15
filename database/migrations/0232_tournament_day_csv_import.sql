-- CSV-first tournament-day fallback. This does not replace public registration;
-- it lets a director-owned desk spreadsheet become the roster/enrollment/payment
-- source when registration/email flows are intentionally bypassed for rehearsal.
--
-- Ported from PR #106 (branch codex/csv-first-tournament-day-mode), which
-- numbered this 0219. That number was already taken by
-- 0219_players_can_read_their_own_tournament_results.sql, which is merged and
-- applied to production. Applying the branch as written would have left two
-- different files claiming one ordinal, so the file is renumbered here and the
-- branch is not merged.
--
-- Two defects found while porting are fixed below, plus one client-side guard,
-- and each is called out at the line that carries it:
--
--   1. The writer had no service_role guard. Every other writer in this schema
--      has one.
--   2. The apply pass returned 'rejected' after it had already written rows and
--      inserted an outcome='accepted' receipt. PostgREST commits a function that
--      returns normally, so that path committed a partial import while telling
--      the director nothing had been applied. Those paths now raise.
--   3. The client now measures the JSON body before sending it. The route reads
--      it through readLargeJson, which stops at 524288 bytes and reports the
--      truncation as an invalid request shape, which is not what went wrong.
--      That guard lives in tournament-day-import-client.tsx, not in this file.
--
-- Schema drift was checked against every migration that landed after the branch
-- was cut. Nothing this file reads or writes has moved: source_kind accepts
-- 'director_csv' since 0130, app.event_side_pool_election_versions gained
-- payment_method, payment_reference and reason in 0170 with payment_method
-- restricted to cash or check, app.event_participants.status was widened in 0166,
-- app.tournament_setup_activations lost its one-row-per-tournament unique key in
-- 0112 so the per-event join is correct, and app.acc_identity_key_v1 has existed
-- since 0210.

create or replace function public.get_tournament_day_import_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(
  select 1 from app.tournament_roles role_row
  where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
    and role_row.role in('director','co_director')
) then jsonb_build_object(
  'tournamentName',tournament.name,
  'events',coalesce((
    select jsonb_agg(jsonb_build_object(
      'eventId',event_row.id,
      'name',event_row.name,
      'eventType',event_row.event_type,
      'format',event_row.format,
      'scoringMethod',event_row.scoring_method,
      'qPoolSlots',coalesce((
        select jsonb_agg(q_pool.slot order by q_pool.slot)
        from app.tournament_setup_q_pool_versions q_pool
        where q_pool.tournament_id=activation.tournament_id
          and q_pool.setup_revision_id=activation.setup_revision_id
          and q_pool.setup_event_version_id=activation.setup_event_version_id
      ),'[]'::jsonb),
      'sidePools',coalesce((
        select jsonb_agg(jsonb_build_object('poolId',definition.pool_id,'displayName',definition.display_name,'entryFeeMinor',definition.entry_fee_minor) order by definition.display_name)
        from (select distinct on(item.pool_id) item.*
          from app.event_side_pool_definition_versions item
          where item.tournament_id=event_row.tournament_id and item.event_id=event_row.id
          order by item.pool_id,item.version desc
        ) definition
        where definition.active
      ),'[]'::jsonb)
    ) order by setup_event.ordinal,event_row.event_type,event_row.name)
    from app.tournament_setup_activations activation
    join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id
    join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id
    where activation.tournament_id=p_tournament_id and coalesce(event_row.operational_state,'active')='active'
  ),'[]'::jsonb)
) else null end
from app.tournaments tournament
where tournament.id=p_tournament_id
$$;
revoke all on function public.get_tournament_day_import_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_tournament_day_import_workspace_v1(uuid,uuid) to service_role;

create or replace function public.import_tournament_day_csv_v1(p_actor_id uuid,p_tournament_id uuid,p_rows jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text;
  v_prior app.operation_receipts%rowtype;
  v_receipt uuid;
  v_response jsonb;
  v_row jsonb;
  v_row_number integer:=0;
  v_first text;
  v_last text;
  v_name text;
  v_email text;
  v_acc text;
  v_acc_key text;
  v_scorecard text;
  v_payment_status text;
  v_method text;
  v_reference text;
  v_roster app.tournament_roster_entries%rowtype;
  v_roster_id uuid;
  v_roster_existed boolean;
  v_roster_created integer:=0;
  v_roster_matched integer:=0;
  v_event_created integer:=0;
  v_event_existing integer:=0;
  v_payment_created integer:=0;
  v_payment_existing integer:=0;
  v_side_pool_created integer:=0;
  v_side_pool_existing integer:=0;
  v_q_pool_total integer:=0;
  v_total_minor integer;
  v_current_obligation_version integer;
  v_current_obligation_minor integer;
  v_current_payment_version integer;
  v_current_payment_type text;
  v_current_payment_minor integer;
  v_event jsonb;
  v_event_id uuid;
  v_participant_id uuid;
  v_profile_id uuid;
  v_side jsonb;
  v_pool_id uuid;
  v_definition app.event_side_pool_definition_versions%rowtype;
  v_election app.event_side_pool_election_versions%rowtype;
  v_q jsonb;
begin
  -- This writer shipped without the check every other writer here carries. The
  -- grants at the foot of the file already keep anon and authenticated out, so
  -- the gap was not reachable from a browser, but the grant list is the only
  -- thing that was holding it and a future grant would open it silently.
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only tournament day csv import';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_idempotency_key is null
    or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then
    return jsonb_build_object('status','rejected','code','invalid_batch');
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('import_tournament_day_csv_v1',p_actor_id::text,p_tournament_id::text,p_rows)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then
    if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
    return v_prior.response_payload;
  end if;
  perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
  if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
  -- status='open' is tighter than the sibling director CSV intake,
  -- import_roster_csv_v3 (0204), which admits status in('draft','open'). That is
  -- correct here and the difference is worth recording, because a reader greping
  -- for who sets 'open' will not find it on one line: activate_tournament_setup_v2
  -- sets it (0112:239, "update app.tournaments set name=..., status='open'"), and
  -- the finalize wrapper then opens registration against that value (0194:103).
  -- So 'open' means setup was activated. The roster importer can run before that,
  -- because a roster identity needs no event. This one cannot: every row is
  -- checked against app.tournament_setup_activations below, so on a 'draft'
  -- tournament each row would fail event_unavailable anyway. Keeping the tighter
  -- guard returns one honest registration_closed instead of a per-row error.
  perform 1 from app.tournaments tournament where tournament.id=p_tournament_id and tournament.status='open' and tournament.registration_status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','registration_closed');end if;
  if exists(select 1 from app.initial_seating_publications publication where publication.tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','initial_seating_already_published');
  end if;
  if exists(
    with normalized as (
      select app.acc_identity_key_v1(value->>'accNumber') acc_key
      from jsonb_array_elements(p_rows) value
    )
    select 1 from normalized
    where acc_key is null or acc_key=''
       or (select count(*) from normalized again where again.acc_key=normalized.acc_key)>1
  ) then return jsonb_build_object('status','rejected','code','duplicate_in_batch');end if;

  for v_row in select value from jsonb_array_elements(p_rows) value loop
    v_row_number:=v_row_number+1;
    v_first:=regexp_replace(trim(v_row->>'firstName'),'[[:space:]]+',' ','g');
    v_last:=regexp_replace(trim(v_row->>'lastName'),'[[:space:]]+',' ','g');
    v_name:=lower(regexp_replace(v_first||' '||v_last,'[[:space:]]+',' ','g'));
    -- The 0204 check constraint on app.tournament_roster_entries requires each
    -- trimmed name part to be 1 to 80 characters. A blank or overlong part
    -- therefore fails INSIDE the apply pass, where a constraint violation is not
    -- a 'rejected' return but a rolled-back transaction behind a bare 503 with
    -- no row number, at the desk, on tournament day.
    if length(v_first) not between 1 and 80 or length(v_last) not between 1 and 80 then
      return jsonb_build_object('status','rejected','code','invalid_batch','rowNumber',v_row_number);
    end if;
    v_email:=nullif(lower(trim(v_row->>'email')),'');
    v_acc:=upper(regexp_replace(trim(v_row->>'accNumber'),'[[:space:]]+','','g'));
    v_acc_key:=app.acc_identity_key_v1(v_acc);
    v_scorecard:=v_row->>'scorecardType';
    v_payment_status:=coalesce(nullif(v_row->>'paymentStatus',''),'paid');
    v_method:=coalesce(nullif(v_row->>'paymentMethod',''),'cash');
    v_reference:=nullif(trim(coalesce(v_row->>'paymentReference','')),'');
    if v_acc_key is null or v_acc_key='' or v_scorecard not in('digital','paper') or v_payment_status not in('paid','unpaid') or v_method not in('cash','check','other') then
      return jsonb_build_object('status','rejected','code','invalid_batch','rowNumber',v_row_number);
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('roster-identity:'||p_tournament_id::text||':'||v_acc_key,0));
    if exists(select 1 from app.tournament_roster_entries roster join lateral(select event_type from app.roster_entry_lifecycle_events life where life.roster_entry_id=roster.id order by life.version desc limit 1) life on true where roster.tournament_id=p_tournament_id and life.event_type='withdrawn' and coalesce(roster.claimed_acc_identity_key,app.acc_identity_key_v1(roster.claimed_normalized_acc_number))=v_acc_key) then
      return jsonb_build_object('status','rejected','code','withdrawn_roster_entry','rowNumber',v_row_number);
    end if;
    select roster.* into v_roster
    from app.tournament_roster_entries roster
    left join lateral(select event_type from app.roster_entry_lifecycle_events life where life.roster_entry_id=roster.id order by life.version desc limit 1) life on true
    where roster.tournament_id=p_tournament_id and coalesce(life.event_type,'active')<>'withdrawn'
      and coalesce(roster.claimed_acc_identity_key,app.acc_identity_key_v1(roster.claimed_normalized_acc_number))=v_acc_key
    order by roster.id limit 1;
    v_roster_existed:=found;
    if v_roster_existed then
      v_roster_id:=v_roster.id; v_roster_matched:=v_roster_matched+1;
    else
      v_roster_id:=extensions.gen_random_uuid(); v_roster_created:=v_roster_created+1;
    end if;

    v_total_minor:=0;
    for v_event in select value from jsonb_array_elements(v_row->'eventEnrollments') value loop
      v_event_id:=(v_event->>'eventId')::uuid;
      v_total_minor:=v_total_minor+coalesce((v_event->>'amountMinor')::integer,0);
      if not exists(select 1 from app.tournament_setup_activations activation join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id where activation.tournament_id=p_tournament_id and activation.event_id=v_event_id and coalesce(event_row.operational_state,'active')='active') then
        return jsonb_build_object('status','rejected','code','event_unavailable','rowNumber',v_row_number);
      end if;
      if v_roster_existed and exists(select 1 from app.event_participants where tournament_id=p_tournament_id and event_id=v_event_id and roster_entry_id=v_roster_id) then
        if exists(select 1 from app.event_participants where tournament_id=p_tournament_id and event_id=v_event_id and roster_entry_id=v_roster_id and status in('withdrawn','disqualified','substituted')) then
          return jsonb_build_object('status','rejected','code','event_participant_unavailable','rowNumber',v_row_number);
        end if;
        v_event_existing:=v_event_existing+1;
      else
        v_event_created:=v_event_created+1;
      end if;
    end loop;
    for v_q in select value from jsonb_array_elements(v_row->'qPoolPayments') value loop
      v_total_minor:=v_total_minor+coalesce((v_q->>'amountMinor')::integer,0);
      v_q_pool_total:=v_q_pool_total+coalesce((v_q->>'amountMinor')::integer,0);
      if not exists(select 1 from app.tournament_setup_activations activation join app.tournament_setup_q_pool_versions q_pool on q_pool.tournament_id=activation.tournament_id and q_pool.setup_revision_id=activation.setup_revision_id and q_pool.setup_event_version_id=activation.setup_event_version_id where activation.tournament_id=p_tournament_id and activation.event_id=(v_q->>'eventId')::uuid and q_pool.slot=(v_q->>'qPoolSlot')::integer) then
        return jsonb_build_object('status','rejected','code','q_pool_unavailable','rowNumber',v_row_number);
      end if;
    end loop;
    for v_side in select value from jsonb_array_elements(v_row->'sidePoolElections') value loop
      v_total_minor:=v_total_minor+coalesce((v_side->>'amountMinor')::integer,0);
      v_event_id:=(v_side->>'eventId')::uuid;
      v_pool_id:=(v_side->>'poolId')::uuid;
      select * into v_definition from app.event_side_pool_definition_versions definition where definition.pool_id=v_pool_id and definition.tournament_id=p_tournament_id and definition.event_id=v_event_id order by definition.version desc limit 1;
      if not found or not v_definition.active or exists(select 1 from app.event_side_pool_reconciliations reconciliation where reconciliation.pool_id=v_pool_id) then
        return jsonb_build_object('status','rejected','code','side_pool_unavailable','rowNumber',v_row_number);
      end if;
      if (v_side->>'amountMinor')::integer>v_definition.entry_fee_minor then
        return jsonb_build_object('status','rejected','code','received_exceeds_due','rowNumber',v_row_number);
      end if;
      -- The election needs a participant row to hang off. It either comes from
      -- this same row's enrollments or the player is already in that event.
      if not exists(select 1 from jsonb_array_elements(v_row->'eventEnrollments') enrollment
                    where (enrollment.value->>'eventId')::uuid=v_event_id)
         and not (v_roster_existed and exists(select 1 from app.event_participants participant
                    where participant.tournament_id=p_tournament_id and participant.event_id=v_event_id
                      and participant.roster_entry_id=v_roster_id)) then
        return jsonb_build_object('status','rejected','code','side_pool_unavailable','rowNumber',v_row_number);
      end if;
      if v_roster_existed and exists(select 1 from app.event_participants participant where participant.tournament_id=p_tournament_id and participant.event_id=v_event_id and participant.roster_entry_id=v_roster_id) then
        select election.* into v_election
        from app.event_side_pool_election_versions election
        join app.event_participants participant on participant.id=election.participant_id
        where election.pool_id=v_pool_id and participant.tournament_id=p_tournament_id and participant.event_id=v_event_id and participant.roster_entry_id=v_roster_id
        order by election.version desc limit 1;
        if found then
          if v_election.elected and v_election.amount_received_minor=(v_side->>'amountMinor')::integer and v_election.amount_due_minor=v_definition.entry_fee_minor then
            v_side_pool_existing:=v_side_pool_existing+1;
          else
            return jsonb_build_object('status','rejected','code','side_pool_election_conflict','rowNumber',v_row_number);
          end if;
        else
          v_side_pool_created:=v_side_pool_created+1;
        end if;
      else
        v_side_pool_created:=v_side_pool_created+1;
      end if;
    end loop;

    if v_roster_existed then
      select coalesce(max(version),0), (array_agg(amount_owed_minor order by version desc))[1]
        into v_current_obligation_version,v_current_obligation_minor
      from app.roster_payment_obligation_versions where roster_entry_id=v_roster_id;
      select coalesce(max(version),0), (array_agg(event_type order by version desc))[1], (array_agg(amount_minor order by version desc))[1]
        into v_current_payment_version,v_current_payment_type,v_current_payment_minor
      from app.roster_payment_events where roster_entry_id=v_roster_id;
      if coalesce(v_current_payment_version,0)>0 and v_current_payment_type='received' then
        if v_payment_status='unpaid' or coalesce(v_current_payment_minor,-1)<>v_total_minor or coalesce(v_current_obligation_minor,-1)<>v_total_minor then
          return jsonb_build_object('status','rejected','code','payment_conflict','rowNumber',v_row_number);
        end if;
        v_payment_existing:=v_payment_existing+1;
      else
        -- A recorded obligation is the amount this player was told they owe. The
        -- desk file may confirm it, and may add to it by listing more events,
        -- but it may not quietly replace it with a smaller figure, and an
        -- unlisted event silently zeroing the balance is the worst shape of
        -- that. version 0 means no obligation was ever recorded, which is an
        -- ordinary new entry rather than a disagreement.
        if coalesce(v_current_obligation_version,0)>0 and v_current_obligation_minor is distinct from v_total_minor then
          return jsonb_build_object('status','rejected','code','payment_conflict','rowNumber',v_row_number);
        end if;
        if v_payment_status='paid' and v_total_minor>0 then
          v_payment_created:=v_payment_created+1;
        else
          v_payment_existing:=v_payment_existing+1;
        end if;
      end if;
    elsif v_payment_status='paid' and v_total_minor>0 then
      v_payment_created:=v_payment_created+1;
    else
      v_payment_existing:=v_payment_existing+1;
    end if;
  end loop;

  v_response:=jsonb_build_object(
    'status','tournament_day_csv_imported','importedRows',jsonb_array_length(p_rows),
    'rosterCreatedCount',v_roster_created,'rosterMatchedCount',v_roster_matched,
    'eventEnrollmentCount',v_event_created,'eventEnrollmentExistingCount',v_event_existing,
    'paymentReceiptCount',v_payment_created,'paymentExistingCount',v_payment_existing,
    'sidePoolElectionCount',v_side_pool_created,'sidePoolElectionExistingCount',v_side_pool_existing,
    'qPoolPaymentTotalMinor',v_q_pool_total
  );
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_actor_id,p_tournament_id,'import_tournament_day_csv_v1',p_tournament_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp())
  returning id into v_receipt;

  -- Everything below this line writes. The validation pass above ran the same
  -- checks with nothing written, so a failure here means the two passes disagreed
  -- inside one transaction, which is an invariant break rather than bad input.
  -- These raise instead of returning 'rejected': a normal return commits, and a
  -- commit here would leave part of the file imported behind a receipt this
  -- function already marked accepted. The route turns the raise into 503
  -- operation_unavailable, and the transaction takes the partial rows and the
  -- receipt with it.

  v_row_number:=0; v_roster_created:=0; v_roster_matched:=0; v_event_created:=0; v_event_existing:=0; v_payment_created:=0; v_payment_existing:=0; v_side_pool_created:=0; v_side_pool_existing:=0; v_q_pool_total:=0;
  for v_row in select value from jsonb_array_elements(p_rows) value loop
    v_row_number:=v_row_number+1;
    v_first:=regexp_replace(trim(v_row->>'firstName'),'[[:space:]]+',' ','g');
    v_last:=regexp_replace(trim(v_row->>'lastName'),'[[:space:]]+',' ','g');
    v_name:=lower(regexp_replace(v_first||' '||v_last,'[[:space:]]+',' ','g'));
    v_email:=nullif(lower(trim(v_row->>'email')),'');
    v_acc:=upper(regexp_replace(trim(v_row->>'accNumber'),'[[:space:]]+','','g'));
    v_acc_key:=app.acc_identity_key_v1(v_acc);
    v_scorecard:=v_row->>'scorecardType';
    v_payment_status:=coalesce(nullif(v_row->>'paymentStatus',''),'paid');
    v_method:=coalesce(nullif(v_row->>'paymentMethod',''),'cash');
    v_reference:=nullif(trim(coalesce(v_row->>'paymentReference','')),'');
    select roster.* into v_roster
    from app.tournament_roster_entries roster
    left join lateral(select event_type from app.roster_entry_lifecycle_events life where life.roster_entry_id=roster.id order by life.version desc limit 1) life on true
    where roster.tournament_id=p_tournament_id and coalesce(life.event_type,'active')<>'withdrawn'
      and coalesce(roster.claimed_acc_identity_key,app.acc_identity_key_v1(roster.claimed_normalized_acc_number))=v_acc_key
    order by roster.id limit 1;
    if found then
      v_roster_id:=v_roster.id; v_roster_matched:=v_roster_matched+1;
    else
      v_roster_id:=extensions.gen_random_uuid(); v_roster_created:=v_roster_created+1;
      insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,claimed_first_name,claimed_last_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,claimed_acc_identity_key,scorecard_type,creator_profile_id,operation_receipt_id)
      values(v_roster_id,p_tournament_id,'director_csv',v_first||' '||v_last,v_name,v_first,v_last,nullif(trim(v_row->>'email'),''),v_email,v_acc,v_acc,v_acc_key,v_scorecard,p_actor_id,v_receipt);
      insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(p_tournament_id,p_actor_id,v_receipt,'tournament_roster_entry',v_roster_id,'tournament_day_csv_roster_created',jsonb_build_object('rowNumber',v_row_number,'accNumber',v_acc,'scorecardType',v_scorecard));
    end if;

    v_total_minor:=0;
    for v_event in select value from jsonb_array_elements(v_row->'eventEnrollments') value loop
      v_total_minor:=v_total_minor+coalesce((v_event->>'amountMinor')::integer,0);
    end loop;
    for v_q in select value from jsonb_array_elements(v_row->'qPoolPayments') value loop
      v_total_minor:=v_total_minor+coalesce((v_q->>'amountMinor')::integer,0);
      v_q_pool_total:=v_q_pool_total+coalesce((v_q->>'amountMinor')::integer,0);
      if not exists(select 1 from app.tournament_setup_activations activation join app.tournament_setup_q_pool_versions q_pool on q_pool.tournament_id=activation.tournament_id and q_pool.setup_revision_id=activation.setup_revision_id and q_pool.setup_event_version_id=activation.setup_event_version_id where activation.tournament_id=p_tournament_id and activation.event_id=(v_q->>'eventId')::uuid and q_pool.slot=(v_q->>'qPoolSlot')::integer) then
        raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: q_pool_unavailable on row '||v_row_number;
      end if;
    end loop;
    for v_side in select value from jsonb_array_elements(v_row->'sidePoolElections') value loop
      v_total_minor:=v_total_minor+coalesce((v_side->>'amountMinor')::integer,0);
    end loop;

    select coalesce(max(version),0), (array_agg(amount_owed_minor order by version desc))[1]
      into v_current_obligation_version,v_current_obligation_minor
    from app.roster_payment_obligation_versions where roster_entry_id=v_roster_id;
    select coalesce(max(version),0), (array_agg(event_type order by version desc))[1], (array_agg(amount_minor order by version desc))[1]
      into v_current_payment_version,v_current_payment_type,v_current_payment_minor
    from app.roster_payment_events where roster_entry_id=v_roster_id;
    if coalesce(v_current_payment_version,0)>0 and v_current_payment_type='received' then
      if v_payment_status='unpaid' or coalesce(v_current_payment_minor,-1)<>v_total_minor or coalesce(v_current_obligation_minor,-1)<>v_total_minor then
        raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: payment_conflict on row '||v_row_number;
      end if;
      v_payment_existing:=v_payment_existing+1;
    else
      if v_current_obligation_minor is distinct from v_total_minor then
        insert into app.roster_payment_obligation_versions(tournament_id,roster_entry_id,version,amount_owed_minor,reason,actor_profile_id,operation_receipt_id)
        values(p_tournament_id,v_roster_id,coalesce(v_current_obligation_version,0)+1,v_total_minor,'Tournament day CSV import',p_actor_id,v_receipt);
      end if;
      if v_payment_status='paid' and v_total_minor>0 then
        insert into app.roster_payment_events(tournament_id,roster_entry_id,version,event_type,amount_minor,currency_code,payment_method,payment_received_at,receipt_note,actor_profile_id,operation_receipt_id)
        values(p_tournament_id,v_roster_id,coalesce(v_current_payment_version,0)+1,'received',v_total_minor,'USD',v_method,clock_timestamp(),coalesce(v_reference,'Tournament day CSV import'),p_actor_id,v_receipt);
        v_payment_created:=v_payment_created+1;
      else
        v_payment_existing:=v_payment_existing+1;
      end if;
    end if;

    for v_event in select value from jsonb_array_elements(v_row->'eventEnrollments') value loop
      v_event_id:=(v_event->>'eventId')::uuid;
      if not exists(select 1 from app.tournament_setup_activations activation join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id where activation.tournament_id=p_tournament_id and activation.event_id=v_event_id and coalesce(event_row.operational_state,'active')='active') then
        raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: event_unavailable on row '||v_row_number;
      end if;
      select profile_id into v_profile_id from app.roster_account_links where tournament_id=p_tournament_id and roster_entry_id=v_roster_id order by linked_at desc limit 1;
      select id into v_participant_id from app.event_participants where tournament_id=p_tournament_id and event_id=v_event_id and roster_entry_id=v_roster_id;
      if found then
        if exists(select 1 from app.event_participants where id=v_participant_id and status in('withdrawn','disqualified','substituted')) then
          raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: event_participant_unavailable on row '||v_row_number;
        end if;
        v_event_existing:=v_event_existing+1;
      else
        v_participant_id:=extensions.gen_random_uuid();
        insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,profile_id,status)
        values(v_participant_id,p_tournament_id,v_event_id,v_roster_id,v_profile_id,'registered');
        v_event_created:=v_event_created+1;
      end if;
    end loop;

    for v_side in select value from jsonb_array_elements(v_row->'sidePoolElections') value loop
      v_event_id:=(v_side->>'eventId')::uuid;
      v_pool_id:=(v_side->>'poolId')::uuid;
      select * into v_definition from app.event_side_pool_definition_versions definition where definition.pool_id=v_pool_id and definition.tournament_id=p_tournament_id and definition.event_id=v_event_id order by definition.version desc limit 1;
      if not found or not v_definition.active or exists(select 1 from app.event_side_pool_reconciliations reconciliation where reconciliation.pool_id=v_pool_id) then
        raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: side_pool_unavailable on row '||v_row_number;
      end if;
      if (v_side->>'amountMinor')::integer>v_definition.entry_fee_minor then
        raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: received_exceeds_due on row '||v_row_number;
      end if;
      select id into v_participant_id from app.event_participants where tournament_id=p_tournament_id and event_id=v_event_id and roster_entry_id=v_roster_id;
      if not found then raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: event_unavailable on row '||v_row_number;end if;
      select * into v_election from app.event_side_pool_election_versions election where election.pool_id=v_pool_id and election.participant_id=v_participant_id order by election.version desc limit 1;
      if found then
        if v_election.elected and v_election.amount_received_minor=(v_side->>'amountMinor')::integer and v_election.amount_due_minor=v_definition.entry_fee_minor then
          v_side_pool_existing:=v_side_pool_existing+1;
        else
          raise exception using errcode='P0001', message='tournament day csv import failed its own recheck at apply time: side_pool_election_conflict on row '||v_row_number;
        end if;
      else
        insert into app.event_side_pool_election_versions(election_id,pool_id,tournament_id,event_id,participant_id,version,elected,amount_due_minor,amount_received_minor,payment_method,payment_reference,reason,actor_profile_id,operation_receipt_id)
        values(extensions.gen_random_uuid(),v_pool_id,p_tournament_id,v_event_id,v_participant_id,1,true,v_definition.entry_fee_minor,(v_side->>'amountMinor')::integer,case when v_method='check' then 'check' else 'cash' end,v_reference,'Tournament day CSV import',p_actor_id,v_receipt);
        v_side_pool_created:=v_side_pool_created+1;
      end if;
    end loop;
  end loop;

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'tournament_day_csv_import',p_tournament_id,'tournament_day_csv_imported',v_response);
  return v_response;
end $$;
revoke all on function public.import_tournament_day_csv_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.import_tournament_day_csv_v1(uuid,uuid,jsonb,uuid) to service_role;

notify pgrst,'reload schema';
