-- An independently authorized official may reopen the latest stored paper-card
-- image for a game side. The server streams the verified bytes; this function
-- never returns image bytes or a public URL. Every successful authorization is
-- appended to the restricted access ledger.

create or replace function public.authorize_paper_card_human_review_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_game_id uuid,
  p_card_side text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_receipt app.paper_card_storage_receipts%rowtype;
begin
  if p_actor_id is null or p_tournament_id is null or p_game_id is null
     or p_card_side not in ('a','b') then
    return null;
  end if;

  select role into v_role
  from app.tournament_roles
  where tournament_id = p_tournament_id and profile_id = p_actor_id
    and role in ('director','co_director','cross_checker')
  order by case role when 'director' then 1 when 'co_director' then 2 else 3 end
  limit 1;

  if v_role is null
     or not app.paper_official_is_independent(p_actor_id,p_tournament_id,p_game_id) then
    return null;
  end if;

  select receipt.* into v_receipt
  from app.paper_card_storage_receipts receipt
  join app.paper_card_captures capture
    on capture.id = receipt.capture_id
    and capture.tournament_id = receipt.tournament_id
    and capture.event_id = receipt.event_id
    and capture.canonical_game_id = receipt.canonical_game_id
  where receipt.tournament_id = p_tournament_id
    and receipt.canonical_game_id = p_game_id
    and capture.card_side = p_card_side
    and capture.actor_profile_id <> p_actor_id
    and receipt.retention_state = 'restricted_hold'
  order by receipt.recorded_at desc, receipt.id desc
  limit 1;

  if v_receipt.id is null then return null; end if;

  insert into app.paper_card_storage_access_events(
    storage_receipt_id,tournament_id,actor_profile_id,access_kind,purpose
  ) values (
    v_receipt.id,p_tournament_id,p_actor_id,'human_review','Independent paper-card comparison'
  );

  return jsonb_build_object(
    'captureId',v_receipt.capture_id,
    'storageReceiptId',v_receipt.id,
    'objectPath',v_receipt.object_path,
    'mediaType',v_receipt.media_type,
    'byteSize',v_receipt.byte_size,
    'sha256',v_receipt.sha256
  );
end;
$$;

revoke all on function public.authorize_paper_card_human_review_v1(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.authorize_paper_card_human_review_v1(uuid,uuid,uuid,text)
  to service_role;

