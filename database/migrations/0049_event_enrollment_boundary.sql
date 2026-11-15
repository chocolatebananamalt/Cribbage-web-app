-- Controlled Standard Singles digital event enrollment from a linked,
-- currently checked-in roster identity. Never creates a game or assignment.

create or replace function public.enroll_linked_roster_entry_in_event(
  p_tournament_id uuid, p_event_id uuid, p_roster_entry_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_hash text; v_existing app.operation_receipts%rowtype;
  v_profile uuid; v_participant uuid := extensions.gen_random_uuid(); v_receipt uuid; v_response jsonb; v_error text; v_code text; v_authorized boolean := false;
begin
begin
  if v_actor is null or p_tournament_id is null or p_event_id is null or p_roster_entry_id is null or p_idempotency_key is null then
    raise exception using errcode='P0001', message='invalid enrollment request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('enroll_linked_roster_entry_in_event',p_tournament_id::text,p_event_id::text,p_roster_entry_id::text,p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text,0));
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status='open' for update;
  if not found then raise exception using errcode='P0001', message='tournament unavailable'; end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=v_actor and r.role in ('director','co_director')) then raise exception using errcode='P0001',message='director role required'; end if;
  v_authorized := true;
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict'; end if; return v_existing.response_payload; end if;
  if exists(select 1 from app.initial_seating_publications s where s.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='enrollment closed after seating'; end if;
  if not exists(select 1 from app.events e join app.ruleset_versions r on r.id=e.ruleset_version_id and r.tournament_id=e.tournament_id where e.id=p_event_id and e.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital' and r.format='standard_singles' and r.approved_at is not null) then raise exception using errcode='P0001',message='event not approved for digital enrollment'; end if;
  select l.profile_id into v_profile from app.roster_account_links l where l.tournament_id=p_tournament_id and l.roster_entry_id=p_roster_entry_id for update;
  if v_profile is null then raise exception using errcode='P0001',message='linked roster identity required'; end if;
  if coalesce((select c.check_in_state from app.roster_check_in_events c where c.tournament_id=p_tournament_id and c.roster_entry_id=p_roster_entry_id order by c.version desc limit 1),'')<>'checked_in' then raise exception using errcode='P0001',message='checked in roster required'; end if;
  if exists(select 1 from app.event_participants p where p.event_id=p_event_id and p.profile_id=v_profile) then raise exception using errcode='P0001',message='participant already enrolled'; end if;
  v_response:=jsonb_build_object('status','event_participant_enrolled','eventId',p_event_id,'rosterEntryId',p_roster_entry_id,'participantId',v_participant,'participantStatus','checked_in','gameCreated',false,'seatAssigned',false);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(v_actor,p_tournament_id,'enroll_linked_roster_entry_in_event',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.event_participants(id,tournament_id,event_id,profile_id,status)values(v_participant,p_tournament_id,p_event_id,v_profile,'checked_in');
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,v_actor,v_receipt,'event_participant',v_participant,'event_participant_enrolled',v_response);
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error=message_text;
  v_code:=case v_error when 'director role required' then 'not_director' when 'idempotency conflict' then 'idempotency_conflict' when 'enrollment closed after seating' then 'enrollment_closed_after_seating' when 'event not approved for digital enrollment' then 'event_not_approved' when 'linked roster identity required' then 'linked_roster_identity_required' when 'checked in roster required' then 'not_checked_in' when 'participant already enrolled' then 'participant_already_enrolled' else 'event_enrollment_rejected' end;
  v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id,'rosterEntryId',p_roster_entry_id);
  if v_authorized then
    insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_actor,p_tournament_id,'enroll_linked_roster_entry_in_event',coalesce(p_roster_entry_id,p_event_id),coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,v_actor,v_receipt,'event_participant',coalesce(p_roster_entry_id,p_event_id),'event_participant_enrollment_rejected',v_response);
  end if;
  return v_response;
end;
end; $$;
revoke all on function public.enroll_linked_roster_entry_in_event(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.enroll_linked_roster_entry_in_event(uuid,uuid,uuid,uuid) to authenticated;
