-- An approved public registration claim may become a private tournament roster
-- identity. This is deliberately not Auth-account creation, role assignment,
-- event enrollment, payment, check-in, seating, or verification-ID assignment.

alter table app.registration_claim_decisions
  add constraint registration_claim_decisions_scope_approval_unique
  unique (id, tournament_id, claim_id, decision);

create table app.tournament_roster_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  source_claim_id uuid not null,
  approval_decision_id uuid not null,
  approval_decision text not null default 'approved_for_roster'
    check (approval_decision = 'approved_for_roster'),
  claimed_display_name text not null check (length(trim(claimed_display_name)) between 1 and 160),
  claimed_normalized_name text not null check (length(claimed_normalized_name) between 1 and 160),
  claimed_email text not null check (length(claimed_email) between 3 and 320),
  claimed_normalized_email text not null check (length(claimed_normalized_email) between 3 and 320),
  claimed_acc_number text,
  claimed_normalized_acc_number text,
  creator_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (source_claim_id, tournament_id)
    references app.registration_claims(id, tournament_id) on delete restrict,
  foreign key (approval_decision_id, tournament_id, source_claim_id, approval_decision)
    references app.registration_claim_decisions(id, tournament_id, claim_id, decision) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (source_claim_id),
  unique (approval_decision_id),
  check (claimed_normalized_acc_number is null or length(claimed_normalized_acc_number) between 1 and 64)
);
alter table app.tournament_roster_entries enable row level security;
alter table app.tournament_roster_entries force row level security;
revoke all on table app.tournament_roster_entries from public, anon, authenticated;
create trigger tournament_roster_entries_immutable before update or delete on app.tournament_roster_entries
for each row execute function app.reject_immutable_history();
create index tournament_roster_entries_tournament_created_idx
  on app.tournament_roster_entries(tournament_id, created_at desc);
create index tournament_roster_entries_creator_profile_id_idx
  on app.tournament_roster_entries(creator_profile_id);
create index tournament_roster_entries_operation_receipt_id_idx
  on app.tournament_roster_entries(operation_receipt_id);

create table app.roster_entry_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  tournament_id uuid references app.tournaments(id) on delete restrict,
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.roster_entry_operation_conflicts enable row level security;
alter table app.roster_entry_operation_conflicts force row level security;
revoke all on table app.roster_entry_operation_conflicts from public, anon, authenticated;
create trigger roster_entry_operation_conflicts_immutable before update or delete on app.roster_entry_operation_conflicts
for each row execute function app.reject_immutable_history();
create index roster_entry_operation_conflicts_actor_profile_id_idx
  on app.roster_entry_operation_conflicts(actor_profile_id);
create index roster_entry_operation_conflicts_tournament_id_idx
  on app.roster_entry_operation_conflicts(tournament_id);
create index roster_entry_operation_conflicts_prior_receipt_id_idx
  on app.roster_entry_operation_conflicts(prior_receipt_id);

create or replace function public.get_tournament_roster_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then coalesce((
    select jsonb_build_object('rosterEntries', coalesce(jsonb_agg(jsonb_build_object(
      'rosterEntryId', e.id,
      'sourceClaimId', e.source_claim_id,
      'approvalDecisionId', e.approval_decision_id,
      'displayName', e.claimed_display_name,
      'email', e.claimed_email,
      'accNumber', e.claimed_acc_number,
      'createdAt', e.created_at
    ) order by e.created_at), '[]'::jsonb))
    from app.tournament_roster_entries e
    where e.tournament_id = p_tournament_id
  ), jsonb_build_object('rosterEntries', '[]'::jsonb)) else null end
$$;

create or replace function public.create_roster_entry_from_registration_claim(
  p_tournament_id uuid,
  p_approval_decision_id uuid,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_tournament_exists boolean := false;
  v_authorized boolean := false;
  v_existing app.operation_receipts%rowtype;
  v_decision app.registration_claim_decisions%rowtype;
  v_claim app.registration_claims%rowtype;
  v_entry_id uuid := extensions.gen_random_uuid();
  v_receipt uuid;
  v_hash text;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'authentication required';
    end if;
    if p_tournament_id is null or p_approval_decision_id is null or p_idempotency_key is null then
      raise exception using errcode = 'P0001', message = 'invalid roster promotion';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'create_roster_entry_from_registration_claim', p_tournament_id::text,
      p_approval_decision_id::text, p_idempotency_key::text
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
    );

    select status into v_status from app.tournaments where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;

    if not exists (
      select 1 from app.tournament_roles r
      where r.tournament_id = p_tournament_id
        and r.profile_id = v_actor
        and r.role in ('director', 'co_director')
    ) then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;
    select * into v_existing from app.operation_receipts
    where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;
    if v_status not in ('draft', 'open') then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;

    select * into v_decision from app.registration_claim_decisions d
    where d.id = p_approval_decision_id and d.tournament_id = p_tournament_id
    for update;
    if not found or v_decision.decision <> 'approved_for_roster' then
      raise exception using errcode = 'P0001', message = 'approved claim decision required';
    end if;
    select * into v_claim from app.registration_claims c
    where c.id = v_decision.claim_id and c.tournament_id = p_tournament_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'claim unavailable';
    end if;
    if exists (
      select 1 from app.tournament_roster_entries e
      where e.source_claim_id = v_claim.id or e.approval_decision_id = v_decision.id
    ) then
      raise exception using errcode = 'P0001', message = 'claim already promoted';
    end if;

    v_response := jsonb_build_object(
      'status', 'roster_entry_created',
      'rosterEntryId', v_entry_id,
      'sourceClaimId', v_claim.id,
      'approvalDecisionId', v_decision.id,
      'profileLinked', false,
      'roleGranted', false,
      'eventEnrolled', false,
      'paymentRecorded', false,
      'checkedIn', false,
      'seatAssigned', false
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      v_actor, p_tournament_id, 'create_roster_entry_from_registration_claim',
      v_decision.id, v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt;
    insert into app.tournament_roster_entries(
      id, tournament_id, source_claim_id, approval_decision_id,
      claimed_display_name, claimed_normalized_name, claimed_email,
      claimed_normalized_email, claimed_acc_number, claimed_normalized_acc_number,
      creator_profile_id, operation_receipt_id
    ) values (
      v_entry_id, p_tournament_id, v_claim.id, v_decision.id,
      v_claim.display_name, v_claim.normalized_name, v_claim.email,
      v_claim.normalized_email, v_claim.acc_number, v_claim.normalized_acc_number,
      v_actor, v_receipt
    );
    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id,
      action, after_state
    ) values (
      p_tournament_id, v_actor, v_receipt, 'tournament_roster_entry', v_entry_id,
      'roster_entry_created_from_registration_claim', v_response
    );
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'director role required' then 'not_director'
      when 'approved claim decision required' then 'approved_decision_required'
      when 'claim already promoted' then 'claim_already_promoted'
      when 'idempotency conflict' then 'idempotency_conflict'
      else 'roster_promotion_rejected'
    end;
    v_response := jsonb_build_object(
      'status', 'rejected', 'code', v_code,
      'approvalDecisionId', p_approval_decision_id
    );
    if v_error = 'idempotency conflict' then
      insert into app.roster_entry_operation_conflicts(
        actor_profile_id, tournament_id, attempted_idempotency_key,
        attempted_request_hash, prior_receipt_id, reason_code
      ) values (
        v_actor, p_tournament_id, p_idempotency_key, coalesce(v_hash, ''),
        v_existing.id, 'idempotency_conflict'
      );
    elsif v_authorized and v_tournament_exists then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id, request_hash,
        client_operation_id, outcome, response_payload, applied_at
      ) values (
        v_actor, p_tournament_id, 'create_roster_entry_from_registration_claim',
        coalesce(p_approval_decision_id, p_tournament_id), coalesce(v_hash, ''),
        p_idempotency_key, 'rejected', v_response, now()
      ) returning id into v_receipt;
      insert into app.audit_events(
        tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id,
        action, after_state
      ) values (
        p_tournament_id, v_actor, v_receipt, 'tournament_roster_entry',
        coalesce(p_approval_decision_id, p_tournament_id),
        'roster_entry_creation_rejected', v_response
      );
    end if;
    return v_response;
  when others then
    raise;
  end;
end;
$$;

revoke all on function public.get_tournament_roster_workspace(uuid) from public, anon;
revoke all on function public.create_roster_entry_from_registration_claim(uuid, uuid, uuid) from public, anon;
grant execute on function public.get_tournament_roster_workspace(uuid) to authenticated;
grant execute on function public.create_roster_entry_from_registration_claim(uuid, uuid, uuid) to authenticated;
