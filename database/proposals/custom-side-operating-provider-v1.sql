-- Unpublished, default-off Custom Side V4 service/provider seam.
-- Depends on custom-side-accounting-bridge-v1.sql. It does not enable a route,
-- grant an authenticated caller, move money, or adopt workbook calculations.
begin;

create or replace function app.custom_side_operating_provider_enabled_v1()
returns boolean language sql immutable set search_path=''as $$select false;$$;
revoke all on function app.custom_side_operating_provider_enabled_v1()from public,anon,authenticated,service_role;

create function app.custom_side_policy_preparation_provider_v4(p_tournament_id uuid,p_event_id uuid,p_pool_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare r record;blocks jsonb:='[]'::jsonb;begin
 select s.id as setup_side_pool_version_id,s.setup_revision_id,s.setup_event_version_id,s.slot,s.custom_ratio_denominator_v3,s.payout_type,
  e.client_row_id,e.event_kind,d.id as definition_version_id,to_jsonb(d)as definition,d.active,d.entry_fee_minor,
  i.original_intent,b.id as setup_batch_id,b.actor_id as setup_actor_id,b.operation_id as setup_operation_id,b.request_hash as setup_request_hash,
  b.base_setup_revision_id,b.base_setup_version,b.base_source_digest,ev.format,
  exists(select 1 from app.side_pool_graduated_policies_v2 p where p.pool_id=p_pool_id)as policy_exists,
  exists(select 1 from app.event_side_pool_election_versions x where x.pool_id=p_pool_id)as election_exists
 into r
 from app.tournament_setup_side_pool_materializations m
 join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
 join app.tournament_setup_event_versions e on e.id=s.setup_event_version_id and e.tournament_id=s.tournament_id and e.setup_revision_id=s.setup_revision_id
 join app.setup_custom_payout_intents_v2 i on i.tournament_id=s.tournament_id and i.setup_revision_id=s.setup_revision_id
  and i.setup_event_version_id=s.setup_event_version_id and i.scope='side'and i.pool_slot=s.slot
  and i.ratio_denominator=s.custom_ratio_denominator_v3 and i.amount_method='graduated-custom-ratio-largest-remainder-5usd-v3'
 join app.setup_custom_payout_batches_v2 b on b.id=i.batch_id and b.tournament_id=i.tournament_id and b.setup_revision_id=i.setup_revision_id
 join lateral(select x.*from app.event_side_pool_definition_versions x where x.pool_id=m.pool_id and x.tournament_id=m.tournament_id and x.event_id=m.event_id order by x.version desc limit 1)d on true
 join app.events ev on ev.id=m.event_id and ev.tournament_id=m.tournament_id
 where m.tournament_id=p_tournament_id and m.event_id=p_event_id and m.pool_id=p_pool_id;
 if r.setup_side_pool_version_id is null then return null;end if;
 if not r.active or r.format<>'standard_singles'then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 if r.payout_type is not null or r.custom_ratio_denominator_v3 is null then blocks:=blocks||jsonb_build_array('setup_method_conflict');end if;
 if r.entry_fee_minor not between 500 and 100000000 or mod(r.entry_fee_minor,500)<>0 then blocks:=blocks||jsonb_build_array('unsupported_payout_domain');end if;
 if r.policy_exists then blocks:=blocks||jsonb_build_array('policy_frozen');end if;
 if r.election_exists or app.event_play_state_v1(p_event_id)in('in_progress','completed','finalized')then blocks:=blocks||jsonb_build_array('collection_or_play_started');end if;
 return jsonb_build_object('kind','custom-side-policy-preparation-v4','poolId',p_pool_id,
  'setupSidePoolVersionId',r.setup_side_pool_version_id,'setupRevisionId',r.setup_revision_id,'setupEventVersionId',r.setup_event_version_id,
  'eventClientRowId',r.client_row_id,'poolSlot',r.slot,'customRatio',r.custom_ratio_denominator_v3,'payoutType',r.payout_type,
  'definitionVersionId',r.definition_version_id,'definition',r.definition,'setupBatchId',r.setup_batch_id,
  'setupActorId',r.setup_actor_id,'setupOperationId',r.setup_operation_id,'setupRequestHash',r.setup_request_hash,
  'originalIntent',r.original_intent,'baseSetupRevisionId',r.base_setup_revision_id,'baseSetupVersion',r.base_setup_version,
  'baseSourceDigest',r.base_source_digest,'blockers',blocks,'canPublish',jsonb_array_length(blocks)=0);
end$$;
revoke all on function app.custom_side_policy_preparation_provider_v4(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.get_custom_side_operating_workspace_provider_v4_impl(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare preparation jsonb;binding jsonb;source_value jsonb;current_method text;workspace_status text;begin
 if not app.custom_side_operating_provider_enabled_v1()
  or current_setting('transaction_isolation')<>'read committed'
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
  or not exists(select 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id)
 then return null;end if;
 preparation:=app.custom_side_policy_preparation_provider_v4(p_tournament_id,p_event_id,p_pool_id);if preparation is null then return null;end if;
 select method into current_method from app.side_pool_graduated_policies_v2 where pool_id=p_pool_id;
 if current_method is null then workspace_status:=case when(preparation->'canPublish')='true'::jsonb then'prepared'else'blocked'end;
  binding:=null;source_value:=null;
 elsif current_method='side-custom-graduated-policy-v4'then workspace_status:='published';
  binding:=app.custom_side_policy_binding_v4(p_tournament_id,p_event_id,p_pool_id);
  source_value:=app.side_pool_graduated_source_v2(p_tournament_id,p_event_id,p_pool_id);
  if jsonb_typeof(binding)is distinct from'object'or jsonb_typeof(source_value)is distinct from'object'
   or source_value#>>'{manifest,sourceVersion}'is distinct from'side-custom-amount-source-v4'then return null;end if;
 else workspace_status:='blocked';binding:=null;source_value:=null;end if;
 return jsonb_build_object(
  'kind','custom-side-operating-workspace-v4','actorId',p_actor_id,'tournamentId',p_tournament_id,
  'eventId',p_event_id,'poolId',p_pool_id,'status',workspace_status,'preparation',preparation,'binding',binding,'source',source_value,
  'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
end$$;

create function app.save_side_custom_operating_policy_provider_v4_impl(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$begin
 if not app.custom_side_operating_provider_enabled_v1()then return null;end if;
 return app.save_side_custom_policy_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request,p_operation_id);
end$$;

create function app.get_side_custom_operating_reconciliation_provider_v4_impl(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 if not app.custom_side_operating_provider_enabled_v1()then return null;end if;
 return app.get_side_custom_policy_reconciliation_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_operation_id,p_request);
end$$;

alter function app.custom_side_operating_provider_enabled_v1()owner to postgres;
alter function app.custom_side_policy_preparation_provider_v4(uuid,uuid,uuid)owner to postgres;
alter function app.get_custom_side_operating_workspace_provider_v4_impl(uuid,uuid,uuid,uuid)owner to postgres;
alter function app.save_side_custom_operating_policy_provider_v4_impl(uuid,uuid,uuid,uuid,jsonb,uuid)owner to postgres;
alter function app.get_side_custom_operating_reconciliation_provider_v4_impl(uuid,uuid,uuid,uuid,uuid,jsonb)owner to postgres;

revoke all on function app.get_custom_side_operating_workspace_provider_v4_impl(uuid,uuid,uuid,uuid),
 app.save_side_custom_operating_policy_provider_v4_impl(uuid,uuid,uuid,uuid,jsonb,uuid),
 app.get_side_custom_operating_reconciliation_provider_v4_impl(uuid,uuid,uuid,uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;

create function public.get_custom_side_operating_workspace_provider_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid)
returns jsonb language sql stable security definer set search_path=''as $$
 select app.get_custom_side_operating_workspace_provider_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id);$$;
create function public.save_side_custom_operating_policy_provider_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language sql security definer set search_path=''as $$
 select app.save_side_custom_operating_policy_provider_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request,p_operation_id);$$;
create function public.get_side_custom_operating_reconciliation_provider_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language sql stable security definer set search_path=''as $$
 select app.get_side_custom_operating_reconciliation_provider_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_operation_id,p_request);$$;

alter function public.get_custom_side_operating_workspace_provider_v4(uuid,uuid,uuid,uuid)owner to postgres;
alter function public.save_side_custom_operating_policy_provider_v4(uuid,uuid,uuid,uuid,jsonb,uuid)owner to postgres;
alter function public.get_side_custom_operating_reconciliation_provider_v4(uuid,uuid,uuid,uuid,uuid,jsonb)owner to postgres;

revoke all on function public.get_custom_side_operating_workspace_provider_v4(uuid,uuid,uuid,uuid),
 public.save_side_custom_operating_policy_provider_v4(uuid,uuid,uuid,uuid,jsonb,uuid),
 public.get_side_custom_operating_reconciliation_provider_v4(uuid,uuid,uuid,uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.get_custom_side_operating_workspace_provider_v4(uuid,uuid,uuid,uuid),
 public.save_side_custom_operating_policy_provider_v4(uuid,uuid,uuid,uuid,jsonb,uuid),
 public.get_side_custom_operating_reconciliation_provider_v4(uuid,uuid,uuid,uuid,uuid,jsonb)
 to service_role;

commit;
