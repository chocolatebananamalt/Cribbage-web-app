-- Repair the applied roster writer: current director authorization must precede
-- replay disclosure and every receipt/audit side effect.

create or replace function public.create_roster_entry_from_registration_claim(
  p_tournament_id uuid, p_approval_decision_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_status text; v_tournament_exists boolean := false;
  v_authorized boolean := false; v_existing app.operation_receipts%rowtype;
  v_decision app.registration_claim_decisions%rowtype; v_claim app.registration_claims%rowtype;
  v_entry_id uuid := extensions.gen_random_uuid(); v_receipt uuid; v_hash text;
  v_response jsonb; v_error text; v_code text;
begin begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_tournament_id is null or p_approval_decision_id is null or p_idempotency_key is null then raise exception using errcode = 'P0001', message = 'invalid roster promotion'; end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('create_roster_entry_from_registration_claim', p_tournament_id::text, p_approval_decision_id::text, p_idempotency_key::text)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select status into v_status from app.tournaments where id = p_tournament_id for update; v_tournament_exists := found;
  if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
  if not exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id and r.profile_id = v_actor and r.role in ('director', 'co_director')) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
  v_authorized := true;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  if v_status not in ('draft', 'open') then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
  select * into v_decision from app.registration_claim_decisions d where d.id = p_approval_decision_id and d.tournament_id = p_tournament_id for update;
  if not found or v_decision.decision <> 'approved_for_roster' then raise exception using errcode = 'P0001', message = 'approved claim decision required'; end if;
  select * into v_claim from app.registration_claims c where c.id = v_decision.claim_id and c.tournament_id = p_tournament_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'claim unavailable'; end if;
  if exists (select 1 from app.tournament_roster_entries e where e.source_claim_id = v_claim.id or e.approval_decision_id = v_decision.id) then raise exception using errcode = 'P0001', message = 'claim already promoted'; end if;
  v_response := jsonb_build_object('status', 'roster_entry_created', 'rosterEntryId', v_entry_id, 'sourceClaimId', v_claim.id, 'approvalDecisionId', v_decision.id, 'profileLinked', false, 'roleGranted', false, 'eventEnrolled', false, 'paymentRecorded', false, 'checkedIn', false, 'seatAssigned', false);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'create_roster_entry_from_registration_claim',v_decision.id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.tournament_roster_entries(id,tournament_id,source_claim_id,approval_decision_id,claimed_display_name,claimed_normalized_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,creator_profile_id,operation_receipt_id) values(v_entry_id,p_tournament_id,v_claim.id,v_decision.id,v_claim.display_name,v_claim.normalized_name,v_claim.email,v_claim.normalized_email,v_claim.acc_number,v_claim.normalized_acc_number,v_actor,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'tournament_roster_entry',v_entry_id,'roster_entry_created_from_registration_claim',v_response);
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error = message_text;
  v_code := case v_error when 'authentication required' then 'authentication_required' when 'director role required' then 'not_director' when 'approved claim decision required' then 'approved_decision_required' when 'claim already promoted' then 'claim_already_promoted' when 'idempotency conflict' then 'idempotency_conflict' else 'roster_promotion_rejected' end;
  v_response := jsonb_build_object('status','rejected','code',v_code,'approvalDecisionId',p_approval_decision_id);
  if v_error = 'idempotency conflict' then
    insert into app.roster_entry_operation_conflicts(actor_profile_id,tournament_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code) values(v_actor,p_tournament_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
  elsif v_authorized and v_tournament_exists then
    insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'create_roster_entry_from_registration_claim',coalesce(p_approval_decision_id,p_tournament_id),coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'tournament_roster_entry',coalesce(p_approval_decision_id,p_tournament_id),'roster_entry_creation_rejected',v_response);
  end if;
  return v_response;
when others then raise;
end; end; $$;
