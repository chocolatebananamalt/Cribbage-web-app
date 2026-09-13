-- Atomic, audited CSV roster intake for the October pilot. The browser parses
-- and previews the file, while this boundary revalidates every row and either
-- inserts the entire batch or none of it.

alter table app.tournament_roster_entries
  drop constraint if exists tournament_roster_entries_source_kind_check;
alter table app.tournament_roster_entries
  add constraint tournament_roster_entries_source_kind_check
  check (source_kind in ('registration_claim', 'director_manual', 'director_csv'));

alter table app.tournament_roster_entries
  drop constraint tournament_roster_entries_source_shape_check;
alter table app.tournament_roster_entries
  add constraint tournament_roster_entries_source_shape_check check (
    (source_kind = 'registration_claim'
      and source_claim_id is not null
      and approval_decision_id is not null
      and claimed_email is not null
      and claimed_normalized_email is not null)
    or
    (source_kind in ('director_manual', 'director_csv')
      and source_claim_id is null
      and approval_decision_id is null)
  );

create or replace function public.import_roster_csv_v1(
  p_tournament_id uuid,
  p_rows jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_existing app.operation_receipts%rowtype;
  v_receipt_id uuid;
  v_hash text;
  v_response jsonb;
  v_count integer;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_error text;
  v_code text;
begin
  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'authentication required';
    end if;
    if p_tournament_id is null or p_idempotency_key is null
       or jsonb_typeof(p_rows) <> 'array'
       or jsonb_array_length(p_rows) not between 1 and 500 then
      raise exception using errcode = 'P0001', message = 'invalid roster batch';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_rows) row_data
      where jsonb_typeof(row_data) <> 'object'
        or row_data - 'displayName' - 'email' - 'accNumber' <> '{}'::jsonb
        or jsonb_typeof(row_data->'displayName') <> 'string'
        or jsonb_typeof(row_data->'email') <> 'string'
        or jsonb_typeof(row_data->'accNumber') <> 'string'
        or length(trim(row_data->>'displayName')) not between 1 and 160
        or length(trim(row_data->>'email')) > 320
        or (length(trim(row_data->>'email')) > 0 and lower(trim(row_data->>'email')) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
        or length(trim(row_data->>'accNumber')) > 64
    ) then
      raise exception using errcode = 'P0001', message = 'invalid roster batch';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'import_roster_csv_v1', p_tournament_id::text, p_rows
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
    );
    select * into v_existing from app.operation_receipts
    where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.operation_type <> 'import_roster_csv_v1'
         or v_existing.tournament_id <> p_tournament_id
         or v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('roster-csv:' || p_tournament_id::text, 0)
    );
    select true into v_tournament_exists from app.tournaments t
    where t.id = p_tournament_id and t.status in ('draft', 'open')
      and t.registration_status = 'open' for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'registration closed';
    end if;
    if not exists (
      select 1 from app.tournament_roles role_row
      where role_row.tournament_id = p_tournament_id
        and role_row.profile_id = v_actor
        and role_row.role in ('director', 'co_director')
    ) then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;
    if exists (select 1 from app.initial_seating_publications seating where seating.tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001', message = 'initial seating already published';
    end if;

    if exists (
      with normalized as (
        select lower(regexp_replace(trim(row_data->>'displayName'), '[[:space:]]+', ' ', 'g')) name_key,
          coalesce(nullif(lower(trim(row_data->>'email')), ''), '') email_key,
          coalesce(nullif(upper(regexp_replace(trim(row_data->>'accNumber'), '[[:space:]]+', '', 'g')), ''), '') acc_key
        from jsonb_array_elements(p_rows) row_data
      ) select 1 from normalized where acc_key <> ''
      group by acc_key having count(*) > 1
      union all
      select 1 from normalized where email_key <> ''
      group by email_key having count(*) > 1
      union all
      select 1 from normalized
      where email_key = '' and acc_key = ''
      group by name_key having count(*) > 1
    ) then
      raise exception using errcode = 'P0001', message = 'duplicate in roster batch';
    end if;
    if exists (
      with normalized as (
        select lower(regexp_replace(trim(row_data->>'displayName'), '[[:space:]]+', ' ', 'g')) name_key,
          coalesce(nullif(lower(trim(row_data->>'email')), ''), '') email_key,
          coalesce(nullif(upper(regexp_replace(trim(row_data->>'accNumber'), '[[:space:]]+', '', 'g')), ''), '') acc_key
        from jsonb_array_elements(p_rows) row_data
      ) select 1 from normalized batch
      join app.tournament_roster_entries roster
        on roster.tournament_id = p_tournament_id
       and (
         (batch.acc_key <> '' and coalesce(roster.claimed_normalized_acc_number, '') = batch.acc_key)
         or (batch.email_key <> '' and coalesce(roster.claimed_normalized_email, '') = batch.email_key)
         or (batch.acc_key = '' and batch.email_key = ''
           and roster.claimed_normalized_name = batch.name_key
           and coalesce(roster.claimed_normalized_acc_number, '') = ''
           and coalesce(roster.claimed_normalized_email, '') = '')
       )
    ) then
      raise exception using errcode = 'P0001', message = 'roster batch overlaps existing roster';
    end if;

    v_count := jsonb_array_length(p_rows);
    v_response := jsonb_build_object('status', 'roster_csv_imported', 'importedCount', v_count);
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      v_actor, p_tournament_id, 'import_roster_csv_v1', p_tournament_id, v_hash,
      p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;

    insert into app.tournament_roster_entries(
      id, tournament_id, source_kind, source_claim_id, approval_decision_id,
      claimed_display_name, claimed_normalized_name, claimed_email,
      claimed_normalized_email, claimed_acc_number, claimed_normalized_acc_number,
      creator_profile_id, operation_receipt_id
    ) select
      extensions.gen_random_uuid(), p_tournament_id, 'director_csv', null, null,
      trim(row_data->>'displayName'),
      lower(regexp_replace(trim(row_data->>'displayName'), '[[:space:]]+', ' ', 'g')),
      nullif(trim(row_data->>'email'), ''), nullif(lower(trim(row_data->>'email')), ''),
      nullif(trim(row_data->>'accNumber'), ''),
      nullif(upper(regexp_replace(trim(row_data->>'accNumber'), '[[:space:]]+', '', 'g')), ''),
      v_actor, v_receipt_id
    from jsonb_array_elements(p_rows) row_data;

    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id, entity_type,
      entity_id, action, after_state
    ) values (
      p_tournament_id, v_actor, v_receipt_id, 'tournament_roster_batch',
      p_tournament_id, 'roster_csv_imported', v_response
    );
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'director role required' then 'not_director'
      when 'invalid roster batch' then 'invalid_roster_batch'
      when 'duplicate in roster batch' then 'duplicate_in_batch'
      when 'roster batch overlaps existing roster' then 'duplicate_roster_entry'
      when 'registration closed' then 'registration_closed'
      when 'initial seating already published' then 'initial_seating_already_published'
      when 'idempotency conflict' then 'idempotency_conflict'
      else 'roster_csv_import_rejected'
    end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
    if v_authorized and v_tournament_exists and v_error <> 'idempotency conflict' then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id, request_hash,
        client_operation_id, outcome, response_payload, applied_at
      ) values (
        v_actor, p_tournament_id, 'import_roster_csv_v1', p_tournament_id,
        coalesce(v_hash, repeat('0', 64)), p_idempotency_key, 'rejected', v_response, now()
      ) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id, actor_profile_id, operation_receipt_id, entity_type,
        entity_id, action, after_state
      ) values (
        p_tournament_id, v_actor, v_receipt_id, 'tournament_roster_batch',
        p_tournament_id, 'roster_csv_import_rejected', v_response
      );
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_roster_csv_reconciliation_v1(
  p_tournament_id uuid,
  p_idempotency_key uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and exists (
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = auth.uid()
      and role_row.role in ('director', 'co_director')
  ) then (
    select receipt.response_payload from app.operation_receipts receipt
    where receipt.actor_profile_id = auth.uid()
      and receipt.tournament_id = p_tournament_id
      and receipt.operation_type = 'import_roster_csv_v1'
      and receipt.client_operation_id = p_idempotency_key
    limit 1
  ) else null end
$$;

revoke all on function public.import_roster_csv_v1(uuid, jsonb, uuid) from public, anon;
revoke all on function public.get_roster_csv_reconciliation_v1(uuid, uuid) from public, anon;
grant execute on function public.import_roster_csv_v1(uuid, jsonb, uuid) to authenticated;
grant execute on function public.get_roster_csv_reconciliation_v1(uuid, uuid) to authenticated;
