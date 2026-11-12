-- Local candidate, not a migration. Requires the complete prize transaction and
-- V3 workspace sources. No access grants, default enablement or data conversion.
begin;
create function app.get_event_prize_workspace_source_v1(p_tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();base jsonb;again jsonb;current_setup jsonb;settings_reply jsonb;
 s app.event_settings_snapshots_v3%rowtype;h app.event_prize_heads_v1%rowtype;
 prize jsonb;settings_state jsonb;prize_state jsonb;settings_hash text;event_rows jsonb;
begin
 if app.event_prize_recovery_enabled_source_v1()is distinct from true or a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 perform 1 from app.tournaments where id=p_tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 base:=app.get_custom_q_setup_base_v2(p_tid)->'base';
 if jsonb_typeof(base)is distinct from'object'or base->>'tournamentId'is distinct from p_tid::text then return null;end if;
 current_setup:=public.get_tournament_setup_workspace(p_tid)->'current';
 if (base->>'setupVersion')::integer=0 then
  if base->'setupRevisionId'is distinct from'null'::jsonb or current_setup is distinct from'null'::jsonb then return null;end if;
 else
  if jsonb_typeof(current_setup)is distinct from'object'or current_setup->>'revisionId'is distinct from base->>'setupRevisionId'or current_setup->'version'is distinct from base->'setupVersion'then return null;end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('eventClientRowId',client_row_id,'eventKind',event_kind)order by client_row_id),'[]'::jsonb)into event_rows
 from app.tournament_setup_event_versions where tournament_id=p_tid and setup_revision_id=(base->>'setupRevisionId')::uuid and event_kind in('main','consolation');
 select*into s from app.event_settings_snapshots_v3 where tournament_id=p_tid and setup_revision_id=(base->>'setupRevisionId')::uuid;
 if s.id is null then
  -- A legacy setup is adoptable only when absence of ALL settings history is
  -- established under the same lock. Never repair a missing/stale head here.
  if exists(select 1 from app.event_settings_snapshots_v3 where tournament_id=p_tid)then return null;end if;
  settings_state:=jsonb_build_object('state','absent','historyExists',false,'snapshot',null,'id',null,'digest',null);
 else
  settings_reply:=app.get_event_settings_workspace_v3(p_tid);
  if settings_reply->>'actorId'is distinct from a::text or settings_reply->>'tid'is distinct from p_tid::text or settings_reply->'base'is distinct from base or jsonb_typeof(settings_reply->'currentSnapshot')is distinct from'object'then return null;end if;
  select request_hash into settings_hash from app.event_settings_save_reservations_v3 where actor_id=s.actor_id and operation_id=s.operation_id and tournament_id=p_tid;
  if settings_hash is null then return null;end if;
  settings_state:=jsonb_build_object('state','present','historyExists',true,'snapshot',settings_reply->'currentSnapshot','id',s.id,'digest',settings_hash);
 end if;
 select*into h from app.event_prize_heads_v1 where tournament_id=p_tid;
 if h.snapshot_id is null then
  if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=p_tid)then return null;end if;
  prize_state:=jsonb_build_object('state','absent','historyExists',false,'snapshot',null);
 else
  select document into prize from app.event_prize_snapshots_v1 where id=h.snapshot_id and tournament_id=p_tid;
  if not coalesce(app.valid_event_prize_snapshot_source_v1(prize),false)or s.id is null
   or prize->>'setupRevisionId'is distinct from base->>'setupRevisionId'or prize->'setupVersion'is distinct from base->'setupVersion'
   or prize->>'settingsSnapshotId'is distinct from s.id::text or prize->>'settingsDigest'is distinct from settings_hash then return null;end if;
  if jsonb_array_length(prize->'plans')<>jsonb_array_length(event_rows)or exists(
   select 1 from jsonb_array_elements(event_rows)e where(select count(*)from jsonb_array_elements(prize->'plans')p where p->>'eventClientRowId'=e->>'eventClientRowId'and p->>'eventKind'=e->>'eventKind')<>1)then return null;end if;
  prize_state:=jsonb_build_object('state','present','historyExists',true,'snapshot',prize);
 end if;
 again:=app.get_custom_q_setup_base_v2(p_tid)->'base';if again is distinct from base then return null;end if;
 return jsonb_build_object('kind','event-prize-workspace-v1','actorId',a,'tournamentId',p_tid,'base',base,'events',event_rows,'settings',settings_state,'prizes',prize_state,'activationAllowed',false,'accountingAllowed',false,'moneyMoved',false);
exception when lock_not_available then return null;
end$$;
create function public.get_event_prize_workspace_provider_v1(p_tid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_workspace_source_v1(p_tid);$$;
alter function app.get_event_prize_workspace_source_v1(uuid)owner to postgres;
alter function public.get_event_prize_workspace_provider_v1(uuid)owner to postgres;
revoke all on function app.get_event_prize_workspace_source_v1(uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_event_prize_workspace_provider_v1(uuid)from public,anon,authenticated,service_role;
commit;
