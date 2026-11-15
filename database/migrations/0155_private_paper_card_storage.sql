-- Private, non-authoritative paper-scorecard image storage. Browser users have
-- no bucket policy; narrowly scoped signed uploads are issued by a verified
-- server route. Evidence and access history are append-only and held until a
-- later, explicitly approved retention change.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'paper-scorecards-private', 'paper-scorecards-private', false, 10485760,
  array['image/jpeg','image/png','image/webp']::text[]
) on conflict (id) do nothing;

create table app.paper_card_storage_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  capture_id uuid not null unique,
  upload_intent_id uuid not null unique references app.paper_card_upload_intents(id) on delete restrict,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  bucket_id text not null check (bucket_id = 'paper-scorecards-private'),
  object_path text not null unique check (object_path !~ '(^|/)[.]($|/)' and object_path !~ '[[:cntrl:]]'),
  media_type text not null check (media_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  retention_state text not null check (retention_state = 'restricted_hold'),
  recorded_at timestamptz not null default now(),
  foreign key (capture_id, tournament_id, event_id, canonical_game_id)
    references app.paper_card_captures(id, tournament_id, event_id, canonical_game_id) on delete restrict,
  check (length(object_path) between 1 and 1000)
);
alter table app.paper_card_storage_receipts enable row level security;
alter table app.paper_card_storage_receipts force row level security;
revoke all on table app.paper_card_storage_receipts from public, anon, authenticated;
create trigger paper_card_storage_receipts_immutable before update or delete on app.paper_card_storage_receipts
for each row execute function app.reject_immutable_history();
create index paper_card_storage_receipts_tournament_game_idx
  on app.paper_card_storage_receipts(tournament_id, canonical_game_id, recorded_at desc);
create index paper_card_storage_receipts_actor_idx on app.paper_card_storage_receipts(actor_profile_id);

create table app.paper_card_storage_access_events (
  id uuid primary key default extensions.gen_random_uuid(),
  storage_receipt_id uuid not null references app.paper_card_storage_receipts(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  access_kind text not null check (access_kind in ('ocr_processing','human_review')),
  purpose text not null check (length(trim(purpose)) between 1 and 200),
  recorded_at timestamptz not null default now()
);
alter table app.paper_card_storage_access_events enable row level security;
alter table app.paper_card_storage_access_events force row level security;
revoke all on table app.paper_card_storage_access_events from public, anon, authenticated;
create trigger paper_card_storage_access_events_immutable before update or delete on app.paper_card_storage_access_events
for each row execute function app.reject_immutable_history();
create index paper_card_storage_access_events_receipt_idx on app.paper_card_storage_access_events(storage_receipt_id, recorded_at desc);
create index paper_card_storage_access_events_tournament_idx on app.paper_card_storage_access_events(tournament_id, recorded_at desc);
create index paper_card_storage_access_events_actor_idx on app.paper_card_storage_access_events(actor_profile_id);

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
    and capture.retention_state = 'restricted_hold' and intent.access_scope = 'restricted'
    and intent.declared_media_type in ('image/jpeg','image/png','image/webp')
    and intent.declared_byte_size between 1 and 10485760
    and not exists (select 1 from app.paper_card_storage_receipts receipt where receipt.capture_id = capture.id)
$$;
revoke all on function public.authorize_paper_card_upload_v1(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.authorize_paper_card_upload_v1(uuid,uuid,uuid,uuid,uuid) to service_role;

create or replace function public.record_paper_card_storage_receipt_v1(
  p_actor_id uuid, p_tournament_id uuid, p_capture_id uuid,
  p_upload_intent_id uuid, p_object_reference_id uuid, p_object_path text,
  p_media_type text, p_byte_size bigint, p_sha256 text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_authorization jsonb; v_receipt_id uuid; v_existing app.paper_card_storage_receipts%rowtype;
begin
  v_authorization := public.authorize_paper_card_upload_v1(p_actor_id,p_tournament_id,p_capture_id,p_upload_intent_id,p_object_reference_id);
  select * into v_existing from app.paper_card_storage_receipts where capture_id=p_capture_id;
  if found then
    if v_existing.actor_profile_id=p_actor_id and v_existing.object_path=p_object_path
       and v_existing.media_type=p_media_type and v_existing.byte_size=p_byte_size and v_existing.sha256=p_sha256 then
      return jsonb_build_object('status','image_stored','captureId',p_capture_id,'storageReceiptId',v_existing.id,'retentionState','restricted_hold','ocrRequested',false,'scoreChanged',false,'gameVerified',false);
    end if;
    return jsonb_build_object('status','rejected','code','storage_receipt_conflict');
  end if;
  if v_authorization is null or v_authorization->>'objectPath' is distinct from p_object_path
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
