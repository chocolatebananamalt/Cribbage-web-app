-- UNEXECUTED private reader candidate. Dependencies: reviewed custom-Q v2 and
-- event-settings-transaction-v3 proposals. No public route, grants or capability
-- enablement. Successful shape intentionally matches the handler's exact four
-- workspace fields; capability remains a separate hard-false host decision.
begin;
create function app.get_event_settings_workspace_v3(p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare a uuid:=auth.uid();base_reply jsonb;base jsonb;again jsonb;setup_workspace jsonb;current_setup jsonb;
 rev app.tournament_setup_revisions%rowtype;snapshot app.event_settings_snapshots_v3%rowtype;
 item jsonb;seen uuid[]:=array[]::uuid[];row_id uuid;expected_count integer;current_snapshot jsonb;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 -- All source reads occur after the same tournament and role locks. The base
 -- function derives its digest from the complete current setup and latest
 -- custom-journal hash; it never accepts a client assertion of source freshness.
 base_reply:=app.get_custom_q_setup_base_v2(p_tournament_id);
 if base_reply->>'status'='retry_exact'then return base_reply;end if;
 base:=base_reply->'base';
 if jsonb_typeof(base)is distinct from'object'or base->>'tournamentId'is distinct from p_tournament_id::text then return jsonb_build_object('status','unavailable','code','setup_base_unavailable');end if;
 setup_workspace:=public.get_tournament_setup_workspace(p_tournament_id);current_setup:=setup_workspace->'current';
 select*into rev from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1;
 if rev.id is null then
  if base->'setupRevisionId'is distinct from'null'::jsonb or base->'setupVersion'is distinct from'0'::jsonb or current_setup is distinct from'null'::jsonb
   or exists(select 1 from app.event_settings_snapshots_v3 where tournament_id=p_tournament_id)then return jsonb_build_object('status','unavailable','code','source_changed');end if;
  current_snapshot:=null;
 else
  if base->>'setupRevisionId'is distinct from rev.id::text or base->'setupVersion'is distinct from to_jsonb(rev.version)
   or jsonb_typeof(current_setup)is distinct from'object'or current_setup->>'revisionId'is distinct from rev.id::text or current_setup->'version'is distinct from to_jsonb(rev.version)
   or jsonb_typeof(current_setup->'events')is distinct from'array'then return jsonb_build_object('status','unavailable','code','source_changed');end if;
  select*into snapshot from app.event_settings_snapshots_v3 where tournament_id=p_tournament_id and setup_revision_id=rev.id;
  -- Existing revision without a snapshot is NOT proof of an empty/legacy
  -- configuration. Never manufacture an empty settings array or defaults.
  if snapshot.id is null then return jsonb_build_object('status','unavailable','code','settings_snapshot_unavailable');end if;
  if jsonb_typeof(snapshot.effective_settings)is distinct from'array'or jsonb_array_length(snapshot.effective_settings)>32 then return jsonb_build_object('status','unavailable','code','invalid_snapshot');end if;
  select count(*)into expected_count from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rev.id and event_kind in('main','consolation');
  if jsonb_array_length(snapshot.effective_settings)<>expected_count then return jsonb_build_object('status','unavailable','code','invalid_snapshot_coverage');end if;
  for item in select value from jsonb_array_elements(snapshot.effective_settings)loop
   if jsonb_typeof(item)is distinct from'object'or jsonb_typeof(item->'eventClientRowId')is distinct from'string'or coalesce(item->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return jsonb_build_object('status','unavailable','code','invalid_snapshot');end if;
   row_id:=(item->>'eventClientRowId')::uuid;
   if row_id=any(seen)or not exists(select 1 from app.tournament_setup_event_versions e where e.tournament_id=p_tournament_id and e.setup_revision_id=rev.id and e.client_row_id=row_id and e.event_kind in('main','consolation'))then return jsonb_build_object('status','unavailable','code','invalid_snapshot_coverage');end if;
   seen:=array_append(seen,row_id);
   if item->>'mode'='configured'then
    if not(item?&array['eventClientRowId','mode','draft'])or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['eventClientRowId','mode','draft']))or not app.valid_event_parameters_raw_v3(item->'draft')then return jsonb_build_object('status','unavailable','code','invalid_snapshot');end if;
   elsif item->>'mode'='legacy_checks_required'then
    if not(item?&array['eventClientRowId','mode'])or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['eventClientRowId','mode']))then return jsonb_build_object('status','unavailable','code','invalid_snapshot');end if;
   else return jsonb_build_object('status','unavailable','code','invalid_snapshot');end if;
  end loop;
  current_snapshot:=jsonb_build_object('kind','event-settings-snapshot-v3','tournamentId',p_tournament_id,'setupRevisionId',rev.id,'setupVersion',rev.version,'settings',snapshot.effective_settings);
 end if;
 -- Re-read the server-derived base while the locks remain held. This is a
 -- defensive source-consistency check, not a promise about noncooperating
 -- owner/admin writers or unsupported transaction isolation.
 again:=app.get_custom_q_setup_base_v2(p_tournament_id);
 if again->>'status'='retry_exact'then return again;end if;
 if again->'base'is distinct from base then return jsonb_build_object('status','retry_exact','code','source_changed');end if;
 return jsonb_build_object('actorId',a,'tid',p_tournament_id,'base',base,'currentSnapshot',current_snapshot);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.get_event_settings_workspace_v3(uuid)owner to postgres;
revoke all on function app.get_event_settings_workspace_v3(uuid)from public,anon,authenticated,service_role;
-- NO GRANT. Source-contract tests do not prove SQL execution, authentication,
-- lock compatibility, runtime shape or source consistency; independent review
-- and a separately approved disposable backend acceptance remain required.
commit;
