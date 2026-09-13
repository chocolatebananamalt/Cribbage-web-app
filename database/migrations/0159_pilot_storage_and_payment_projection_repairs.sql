-- Repair four release-boundary defects found by focused review:
-- 1. normalize the existing private bucket instead of trusting prior config;
-- 2. revalidate the actor's current cross-checker role for every upload action;
-- 3. keep initial upload issuance closed after storage while allowing exact
--    completion replay after a lost HTTP response; and
-- 4. project a voided cumulative receipt as zero dollars received.

update storage.buckets
set name = 'paper-scorecards-private',
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id = 'paper-scorecards-private';

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'paper-scorecards-private'
      and name = 'paper-scorecards-private'
      and public = false
      and file_size_limit = 10485760
      and cardinality(allowed_mime_types) = 3
      and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
  ) then
    raise exception 'paper scorecard bucket is unavailable or unsafe';
  end if;
end;
$$;

create or replace function public.authorize_paper_card_upload_v1(
  p_actor_id uuid, p_tournament_id uuid, p_capture_id uuid,
  p_upload_intent_id uuid, p_object_reference_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'captureId', capture.id,
    'uploadIntentId', intent.id,
    'objectReferenceId', intent.object_reference_id,
    'objectPath', capture.tournament_id::text || '/' || capture.event_id::text || '/' ||
      capture.canonical_game_id::text || '/' || capture.id::text || '/' || intent.object_reference_id::text ||
      case intent.declared_media_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end,
    'mediaType', intent.declared_media_type,
    'byteSize', intent.declared_byte_size,
    'sha256', intent.declared_sha256,
    'retentionState', capture.retention_state
  )
  from app.paper_card_captures capture
  join app.paper_card_upload_intents intent
    on intent.capture_id = capture.id and intent.tournament_id = capture.tournament_id
      and intent.event_id = capture.event_id and intent.canonical_game_id = capture.canonical_game_id
  where capture.id = p_capture_id and capture.tournament_id = p_tournament_id
    and intent.id = p_upload_intent_id and intent.object_reference_id = p_object_reference_id
    and capture.actor_profile_id = p_actor_id and capture.actor_role = 'cross_checker'
    and exists (
      select 1 from app.tournament_roles active_role
      where active_role.tournament_id = capture.tournament_id
        and active_role.profile_id = p_actor_id
        and active_role.role = 'cross_checker'
    )
    and capture.retention_state = 'restricted_hold' and intent.access_scope = 'restricted'
    and intent.declared_media_type in ('image/jpeg','image/png','image/webp')
    and intent.declared_byte_size between 1 and 10485760
    and not exists (select 1 from app.paper_card_storage_receipts receipt where receipt.capture_id = capture.id)
$$;
revoke all on function public.authorize_paper_card_upload_v1(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.authorize_paper_card_upload_v1(uuid,uuid,uuid,uuid,uuid) to service_role;

create or replace function public.authorize_paper_card_upload_completion_v1(
  p_actor_id uuid, p_tournament_id uuid, p_capture_id uuid,
  p_upload_intent_id uuid, p_object_reference_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'captureId', capture.id,
    'uploadIntentId', intent.id,
    'objectReferenceId', intent.object_reference_id,
    'objectPath', capture.tournament_id::text || '/' || capture.event_id::text || '/' ||
      capture.canonical_game_id::text || '/' || capture.id::text || '/' || intent.object_reference_id::text ||
      case intent.declared_media_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end,
    'mediaType', intent.declared_media_type,
    'byteSize', intent.declared_byte_size,
    'sha256', intent.declared_sha256,
    'retentionState', capture.retention_state
  )
  from app.paper_card_captures capture
  join app.paper_card_upload_intents intent
    on intent.capture_id = capture.id and intent.tournament_id = capture.tournament_id
      and intent.event_id = capture.event_id and intent.canonical_game_id = capture.canonical_game_id
  where capture.id = p_capture_id and capture.tournament_id = p_tournament_id
    and intent.id = p_upload_intent_id and intent.object_reference_id = p_object_reference_id
    and capture.actor_profile_id = p_actor_id and capture.actor_role = 'cross_checker'
    and exists (
      select 1 from app.tournament_roles active_role
      where active_role.tournament_id = capture.tournament_id
        and active_role.profile_id = p_actor_id
        and active_role.role = 'cross_checker'
    )
    and capture.retention_state = 'restricted_hold' and intent.access_scope = 'restricted'
    and intent.declared_media_type in ('image/jpeg','image/png','image/webp')
    and intent.declared_byte_size between 1 and 10485760
$$;
revoke all on function public.authorize_paper_card_upload_completion_v1(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.authorize_paper_card_upload_completion_v1(uuid,uuid,uuid,uuid,uuid) to service_role;

create or replace function public.record_paper_card_storage_receipt_v1(
  p_actor_id uuid, p_tournament_id uuid, p_capture_id uuid,
  p_upload_intent_id uuid, p_object_reference_id uuid, p_object_path text,
  p_media_type text, p_byte_size bigint, p_sha256 text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_authorization jsonb; v_receipt_id uuid; v_existing app.paper_card_storage_receipts%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paper-card-storage:' || p_capture_id::text, 0));
  v_authorization := public.authorize_paper_card_upload_completion_v1(p_actor_id,p_tournament_id,p_capture_id,p_upload_intent_id,p_object_reference_id);
  if v_authorization is null then
    return jsonb_build_object('status','rejected','code','upload_authorization_unavailable');
  end if;
  select * into v_existing from app.paper_card_storage_receipts where capture_id=p_capture_id;
  if found then
    if v_existing.actor_profile_id=p_actor_id and v_existing.object_path=p_object_path
       and v_existing.media_type=p_media_type and v_existing.byte_size=p_byte_size and v_existing.sha256=p_sha256 then
      return jsonb_build_object('status','image_stored','captureId',p_capture_id,'storageReceiptId',v_existing.id,'retentionState','restricted_hold','ocrRequested',false,'scoreChanged',false,'gameVerified',false);
    end if;
    return jsonb_build_object('status','rejected','code','storage_receipt_conflict');
  end if;
  if v_authorization->>'objectPath' is distinct from p_object_path
     or v_authorization->>'mediaType' is distinct from p_media_type
     or (v_authorization->>'byteSize')::bigint is distinct from p_byte_size
     or v_authorization->>'sha256' is distinct from p_sha256 then
    return jsonb_build_object('status','rejected','code','image_integrity_mismatch');
  end if;
  insert into app.paper_card_storage_receipts(capture_id,upload_intent_id,tournament_id,event_id,canonical_game_id,actor_profile_id,bucket_id,object_path,media_type,byte_size,sha256,retention_state)
  select capture.id,intent.id,capture.tournament_id,capture.event_id,capture.canonical_game_id,p_actor_id,
    'paper-scorecards-private',p_object_path,p_media_type,p_byte_size,p_sha256,'restricted_hold'
  from app.paper_card_captures capture join app.paper_card_upload_intents intent on intent.capture_id=capture.id
  where capture.id=p_capture_id and intent.id=p_upload_intent_id
  returning id into v_receipt_id;
  return jsonb_build_object('status','image_stored','captureId',p_capture_id,'storageReceiptId',v_receipt_id,'retentionState','restricted_hold','ocrRequested',false,'scoreChanged',false,'gameVerified',false);
end;
$$;
revoke all on function public.record_paper_card_storage_receipt_v1(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.record_paper_card_storage_receipt_v1(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text) to service_role;

create or replace function public.get_roster_payment_obligation_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when auth.uid() is not null and exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=auth.uid() and role.role in('director','co_director')) then
 jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object(
   'rosterEntryId',roster.id,'displayName',roster.claimed_display_name,
   'obligationVersion',coalesce(obligation.version,0),'amountOwedMinor',obligation.amount_owed_minor,
   'amountReceivedMinor',coalesce(receipt.amount_received_minor,0),
   'amountRemainingMinor',case when obligation.amount_owed_minor is null then null else greatest(obligation.amount_owed_minor-coalesce(receipt.amount_received_minor,0),0)end,
   'paymentStatus',case when obligation.amount_owed_minor is null then 'not_configured' when coalesce(receipt.amount_received_minor,0)=0 and obligation.amount_owed_minor>0 then 'unpaid' when coalesce(receipt.amount_received_minor,0)<obligation.amount_owed_minor then 'partial' when coalesce(receipt.amount_received_minor,0)=obligation.amount_owed_minor then 'paid' else 'overpaid' end
 )order by roster.claimed_normalized_name,roster.id)
 from app.tournament_roster_entries roster
 left join lateral(select item.version,item.amount_owed_minor from app.roster_payment_obligation_versions item where item.roster_entry_id=roster.id order by item.version desc limit 1)obligation on true
 left join lateral(select case when item.event_type='received' then item.amount_minor else 0 end as amount_received_minor from app.roster_payment_events item where item.roster_entry_id=roster.id order by item.version desc limit 1)receipt on true
 where roster.tournament_id=p_tournament_id),'[]'::jsonb)) else null end
$$;
revoke all on function public.get_roster_payment_obligation_workspace(uuid)from public,anon;
grant execute on function public.get_roster_payment_obligation_workspace(uuid)to authenticated;

create or replace function public.set_roster_payment_obligation_v1(
  p_tournament_id uuid,p_roster_entry_id uuid,p_expected_version integer,
  p_amount_owed_minor integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid(); v_status text; v_current integer; v_hash text;
  v_existing app.operation_receipts%rowtype; v_receipt uuid; v_response jsonb;
  v_reason text:=nullif(trim(p_reason),'');
begin
  if v_actor is null or p_expected_version is null or p_expected_version<0
     or p_amount_owed_minor is null or p_amount_owed_minor<0 or p_amount_owed_minor>2147483647
     or length(coalesce(v_reason,''))>500 or octet_length(coalesce(v_reason,''))>2000
     or p_idempotency_key is null then
    return jsonb_build_object('status','rejected','code','invalid_request','rosterEntryId',p_roster_entry_id);
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
    'set_roster_payment_obligation_v1',p_tournament_id::text,p_roster_entry_id::text,
    p_expected_version,p_amount_owed_minor,coalesce(v_reason,''),p_idempotency_key::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
  select status into v_status from app.tournaments where id=p_tournament_id for update;
  if not found then
    return jsonb_build_object('status','rejected','code','tournament_unavailable','rosterEntryId',p_roster_entry_id);
  end if;
  if not exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=v_actor and role.role in('director','co_director'))then
    return jsonb_build_object('status','rejected','code','not_director','rosterEntryId',p_roster_entry_id);
  end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then
    if v_existing.request_hash=v_hash then return v_existing.response_payload;end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict','rosterEntryId',p_roster_entry_id);
  end if;
  if v_status not in('draft','open','pending_finalization')then
    return jsonb_build_object('status','rejected','code','tournament_unavailable','rosterEntryId',p_roster_entry_id);
  end if;
  if not exists(select 1 from app.tournament_roster_entries roster where roster.id=p_roster_entry_id and roster.tournament_id=p_tournament_id)then
    return jsonb_build_object('status','rejected','code','roster_entry_unavailable','rosterEntryId',p_roster_entry_id);
  end if;
  select coalesce(max(version),0)into v_current from app.roster_payment_obligation_versions where roster_entry_id=p_roster_entry_id;
  if v_current<>p_expected_version then
    return jsonb_build_object('status','rejected','code','stale_obligation','rosterEntryId',p_roster_entry_id);
  end if;
  v_response:=jsonb_build_object('status','payment_obligation_saved','rosterEntryId',p_roster_entry_id,'obligationVersion',v_current+1,'amountOwedMinor',p_amount_owed_minor);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,v_actor,'set_roster_payment_obligation_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;
  insert into app.roster_payment_obligation_versions(tournament_id,roster_entry_id,version,amount_owed_minor,reason,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_roster_entry_id,v_current+1,p_amount_owed_minor,v_reason,v_actor,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,v_actor,v_receipt,'roster_payment_obligation',p_roster_entry_id,'payment_obligation_saved',v_response);
  return v_response;
end $$;
revoke all on function public.set_roster_payment_obligation_v1(uuid,uuid,integer,integer,text,uuid)from public,anon;
grant execute on function public.set_roster_payment_obligation_v1(uuid,uuid,integer,integer,text,uuid)to authenticated;

alter table app.paper_card_storage_receipts
  add constraint paper_card_storage_receipts_id_tournament_unique unique(id,tournament_id);
alter table app.paper_card_storage_access_events
  add constraint paper_card_storage_access_receipt_scope_fk
  foreign key(storage_receipt_id,tournament_id)
  references app.paper_card_storage_receipts(id,tournament_id) on delete restrict;
alter table app.paper_card_ocr_attempts
  add constraint paper_card_ocr_attempts_id_tournament_unique unique(id,tournament_id),
  add constraint paper_card_ocr_attempts_storage_scope_fk
  foreign key(storage_receipt_id,tournament_id)
  references app.paper_card_storage_receipts(id,tournament_id) on delete restrict;
alter table app.paper_card_transcription_draft_versions
  add constraint paper_card_transcription_attempt_scope_fk
  foreign key(ocr_attempt_id,tournament_id)
  references app.paper_card_ocr_attempts(id,tournament_id) on delete restrict;
