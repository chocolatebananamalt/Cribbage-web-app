-- LOCAL proposal only. Event-scoped declarations; never rewrites v1 history.
begin;
create table app.setup_prize_schedule_versions_v2 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 client_row_id uuid not null,version integer not null check(version between 1 and 256),
 settings_fingerprint text not null check(settings_fingerprint~'^[a-f0-9]{64}$'),
 schedule_payload jsonb not null check(app.valid_regular_prize_schedule_v3(schedule_payload)),
 source_reference text not null check(length(source_reference) between 1 and 500),
 reason text not null check(length(reason) between 1 and 500),
 actor_profile_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,client_row_id,version),unique(id,tournament_id,client_row_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);
alter table app.setup_prize_schedule_versions_v2 enable row level security;
alter table app.setup_prize_schedule_versions_v2 force row level security;
revoke all on app.setup_prize_schedule_versions_v2 from public,anon,authenticated,service_role;
create trigger setup_prize_schedule_versions_v2_immutable before update or delete on app.setup_prize_schedule_versions_v2 for each row execute function app.reject_immutable_history();
create index setup_prize_schedule_versions_v2_actor_idx on app.setup_prize_schedule_versions_v2(actor_profile_id);
create index setup_prize_schedule_versions_v2_receipt_idx on app.setup_prize_schedule_versions_v2(operation_receipt_id,tournament_id);

create function app.event_prize_settings_v2(tid uuid,rowid uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 with latest as(select id from app.tournament_setup_revisions where tournament_id=tid order by version desc limit 1),
 e as(select v.* from app.tournament_setup_event_versions v join latest l on l.id=v.setup_revision_id where v.tournament_id=tid and v.client_row_id=rowid)
 select jsonb_build_object('eventKind',e.event_kind,'styleCode',e.style_code,'formatCode',e.format_code,'gameCount',e.game_count,'entryFeeCents',e.entry_fee_cents,
 'qPools',coalesce((select jsonb_agg(jsonb_build_object('slot',q.slot,'type',q.pool_type_code,'feeMinor',q.entry_fee_cents)order by q.slot)from app.tournament_setup_q_pool_versions q where q.setup_event_version_id=e.id),'[]'::jsonb),
 'sidePools',coalesce((select jsonb_agg(jsonb_build_object('slot',s.slot,'name',s.pool_type_code,'feeMinor',s.entry_fee_cents,'payoutType',to_jsonb(s)->'payout_type')order by s.slot)from app.tournament_setup_side_pool_versions s where s.setup_event_version_id=e.id),'[]'::jsonb)) from e;
$$;
create function app.event_prize_settings_supported_v2(settings jsonb)returns boolean
language sql immutable set search_path='' as $$
 select coalesce(settings->>'styleCode'='Standard' and settings->>'formatCode'='standard_singles'
 and (settings->>'entryFeeCents')::integer>0
 and ((settings->>'eventKind'='main' and settings->>'gameCount'='12')
 or(settings->>'eventKind'='consolation' and(settings->>'gameCount')::integer between 7 and 10)),false);
$$;
create function app.event_prize_settings_digest_v2(settings jsonb)returns text
language sql immutable set search_path='' as $$
 select encode(extensions.digest(convert_to(settings::text,'utf8'),'sha256'),'hex');
$$;
revoke all on function app.event_prize_settings_v2(uuid,uuid),app.event_prize_settings_supported_v2(jsonb),app.event_prize_settings_digest_v2(jsonb) from public,anon,authenticated,service_role;

create function public.get_event_prize_declaration_v2(p_actor_id uuid,p_tournament_id uuid,p_client_row_id uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare settings jsonb;v app.setup_prize_schedule_versions_v2%rowtype;
begin
 if p_actor_id is null or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 settings:=app.event_prize_settings_v2(p_tournament_id,p_client_row_id);
 if settings is null then return null;end if;
 select*into v from app.setup_prize_schedule_versions_v2 where tournament_id=p_tournament_id and client_row_id=p_client_row_id order by version desc limit 1;
 return jsonb_build_object('tournamentId',p_tournament_id,'clientRowId',p_client_row_id,'currentVersion',coalesce(v.version,0),
 'supported',app.event_prize_settings_supported_v2(settings),'settingsCurrent',v.id is not null and v.settings_fingerprint=app.event_prize_settings_digest_v2(settings),
 'settings',settings,'settingsFingerprint',app.event_prize_settings_digest_v2(settings),'schedule',v.schedule_payload,'scheduleId',v.id,'accountingReady',false,
 'limitation','Declaration only; per-event financial sources and actual playoff outcomes remain required.');
end$$;

create function public.save_event_prize_declaration_v2(p_actor_id uuid,p_tournament_id uuid,p_client_row_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings jsonb;v integer;hash text;receipt app.operation_receipts%rowtype;rid uuid;sid uuid:=extensions.gen_random_uuid();response jsonb;code text;
begin
 if p_actor_id is null or p_tournament_id is null or p_client_row_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open') for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director');end if;
 hash:=encode(extensions.digest(convert_to(jsonb_build_array('save_event_prize_declaration_v2',p_tournament_id,p_client_row_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if receipt.operation_type='save_event_prize_declaration_v2' and receipt.tournament_id=p_tournament_id and receipt.target_id=p_client_row_id and receipt.request_hash=hash then return receipt.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 if jsonb_typeof(p_request)is distinct from'object' or not(p_request?&array['expectedVersion','expectedSettingsFingerprint','schedule','reason','reviewed'])or(select count(*)from jsonb_object_keys(p_request))<>5
 or jsonb_typeof(p_request->'expectedSettingsFingerprint')is distinct from'string' or(p_request->>'expectedSettingsFingerprint')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(p_request->'expectedVersion')is distinct from'number' or(p_request->>'expectedVersion')!~'^(0|[1-9][0-9]{0,2})$'
 or p_request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(p_request->'reason')is distinct from'string'
 or length(trim(p_request->>'reason'))not between 1 and 500 or trim(p_request->>'reason')~'[[:cntrl:]]'
 or app.valid_regular_prize_schedule_v3(p_request->'schedule')is distinct from true then code:='invalid_request';end if;
 settings:=app.event_prize_settings_v2(p_tournament_id,p_client_row_id);
 if code is null and not app.event_prize_settings_supported_v2(settings)then code:='unsupported_event';end if;
 if code is null and p_request->>'expectedSettingsFingerprint'is distinct from app.event_prize_settings_digest_v2(settings)then code:='stale_settings';end if;
 select coalesce(max(version),0)into v from app.setup_prize_schedule_versions_v2 where tournament_id=p_tournament_id and client_row_id=p_client_row_id;
 if code is null and(v>=256 or v<>(p_request->>'expectedVersion')::integer)then code:='stale_version';end if;
 -- This first version is pre-activation/pre-collection only. No reopening history.
 if code is null and(exists(select 1 from app.tournament_setup_activations where tournament_id=p_tournament_id)
 or exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id)
 or exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=p_tournament_id)
 or exists(select 1 from app.event_side_pool_election_versions where tournament_id=p_tournament_id)
 or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=p_tournament_id)
 or exists(select 1 from app.multi_event_finance_sources_v1 where tournament_id=p_tournament_id))then code:='declaration_locked';end if;
 response:=case when code is null then jsonb_build_object('status','event_prize_declaration_saved_v2','tournamentId',p_tournament_id,'clientRowId',p_client_row_id,'scheduleId',sid,'version',v+1,'accountingReady',false)
 else jsonb_build_object('status','rejected','code',code)end;
 insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(p_tournament_id,p_actor_id,'save_event_prize_declaration_v2',p_client_row_id,hash,p_operation_id,case when code is null then'accepted'else'rejected'end,response,now())returning id into rid;
 if code is null then
  insert into app.setup_prize_schedule_versions_v2(id,tournament_id,client_row_id,version,settings_fingerprint,schedule_payload,source_reference,reason,actor_profile_id,operation_receipt_id)
  values(sid,p_tournament_id,p_client_row_id,v+1,app.event_prize_settings_digest_v2(settings),p_request->'schedule',p_request->'schedule'->>'sourceReference',trim(p_request->>'reason'),p_actor_id,rid);
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(p_tournament_id,p_actor_id,rid,'event_prize_declaration_v2',p_client_row_id,case when code is null then'event_prize_declaration_saved_v2'else'event_prize_declaration_rejected_v2'end,response);
 return response;
end$$;
revoke all on function public.get_event_prize_declaration_v2(uuid,uuid,uuid),public.save_event_prize_declaration_v2(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.get_event_prize_declaration_v2(uuid,uuid,uuid),public.save_event_prize_declaration_v2(uuid,uuid,uuid,jsonb,uuid)to service_role;
notify pgrst,'reload schema';
commit;
