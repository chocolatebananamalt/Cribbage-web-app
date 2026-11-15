-- UNEXECUTED AUTHENTICATED PROVIDER TRANSPORT CANDIDATE.
-- LOCAL REVIEW ONLY. The transport capability is deliberately false. This file
-- does not enable a route, payout, finalization, money movement, or hosted call.
-- Every wrapper derives the actor from auth.uid(); no actor id is accepted.
begin;

create function app.operational_provider_transport_enabled_v1() returns boolean
language sql immutable set search_path='' as $$select false$$;

create function app.require_operational_provider_official_v1(tid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 -- This preflight deliberately does not lock or reserve rows. Each delegated
 -- private source/writer takes its own reviewed lock order and repeats the role
 -- check; taking a role/share lock here could invert that order on writes.
 if not exists(select 1 from app.tournaments t where t.id=tid)then return null;end if;
 if not exists(select 1 from app.tournament_roles r
  where r.tournament_id=tid and r.profile_id=actor
   and r.role in('director','co_director'))then return null;end if;
 return actor;
end$$;

create function public.get_event_settings_workspace_provider_v3(tid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 if app.require_operational_provider_official_v1(tid)is null then return null;end if;
 return app.get_event_settings_workspace_v3(tid);
end$$;

create function public.save_event_settings_draft_provider_v3(tid uuid,envelope jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();op uuid;outcome jsonb;begin
 op:=case when coalesce(envelope#>>'{setup,request,idempotencyKey}','')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then(envelope#>>'{setup,request,idempotencyKey}')::uuid else null end;
 if app.operational_provider_transport_enabled_v1()is distinct from true then
  outcome:=jsonb_build_object('status','rejected','code','feature_unavailable');
 elsif app.require_operational_provider_official_v1(tid)is null then
  outcome:=jsonb_build_object('status','rejected','code','not_director');
 else outcome:=app.save_event_settings_draft_v3(tid,envelope);end if;
 return jsonb_build_object('actorId',actor,'tid',tid,'operationId',op,
  'envelope',envelope,'outcome',outcome);
end$$;

create function public.get_event_settings_operation_provider_v3(tid uuid,op uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request_value jsonb;outcome jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 select r.request_payload into request_value from app.event_settings_save_reservations_v3 r
  where r.actor_id=actor and r.operation_id=op and r.tournament_id=tid;
 if not found then return null;end if;
 outcome:=app.reconcile_event_settings_draft_v3(tid,request_value);
 if outcome is null then return null;end if;
 return jsonb_build_object('actorId',actor,'tid',tid,'operationId',op,
  'envelope',request_value,'outcome',outcome);
end$$;

create function public.get_operational_finance_provider_workspace_v1(tid uuid,eid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;source_value jsonb;head app.operational_event_finance_revisions_v1%rowtype;
 compatibility text;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 source_value:=app.get_operational_event_finance_source_v1(tid,eid);
 if source_value->>'status'is distinct from'source_available'then return source_value;end if;
 select*into head from app.operational_event_finance_revisions_v1 r
  where r.tournament_id=tid and r.event_id=eid order by r.version desc limit 1;
 compatibility:=case when head.id is null then'empty'
  when head.source_digest=source_value->>'sourceDigest'
   and head.basis_digest=source_value->>'basisDigest'then'same_basis'
  else'source_revision_changed_requires_review'end;
 return jsonb_build_object(
  'kind','operational-finance-provider-workspace-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'currentSource',source_value,
  'head',case when head.id is null then null else jsonb_build_object(
   'revisionId',head.id,'version',head.version,'sourceDigest',head.source_digest,
   'basisDigest',head.basis_digest,'editor',head.editor,'reason',head.reason,
   'createdAt',head.created_at)end,
  'compatibility',jsonb_build_object('status',compatibility,
   'editable',compatibility in('empty','same_basis')),
  'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,
  'finalizationAuthorized',false);
end$$;

create function public.save_operational_finance_proposal_provider_v1(tid uuid,eid uuid,request_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();op uuid;outcome jsonb;begin
 op:=case when coalesce(request_value->>'operationId','')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then(request_value->>'operationId')::uuid else null end;
 if app.operational_provider_transport_enabled_v1()is distinct from true then
  outcome:=jsonb_build_object('status','rejected','code','feature_unavailable',
   'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 elsif app.require_operational_provider_official_v1(tid)is null then
  outcome:=jsonb_build_object('status','rejected','code','not_director');
 else outcome:=app.save_operational_event_finance_proposal_v1(tid,eid,request_value);end if;
 return jsonb_build_object('kind','operational-finance-provider-write-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

create function public.reconcile_operational_finance_proposal_provider_v1(tid uuid,eid uuid,op uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();request_value jsonb;outcome jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 if app.require_operational_provider_official_v1(tid)is null then return null;end if;
 select o.request_payload into request_value from app.operational_event_finance_operations_v1 o
  where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
 if not found then return null;end if;
 outcome:=app.reconcile_operational_event_finance_proposal_v1(tid,eid,op);
 if outcome is null then return null;end if;
 return jsonb_build_object('kind','operational-finance-provider-write-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

create function public.get_native_playoff_finance_recipient_source_provider_v1(tid uuid,eid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 if app.require_operational_provider_official_v1(tid)is null then return null;end if;
 return app.get_native_playoff_finance_recipient_source_v1(tid,eid);
end$$;

create function public.record_native_unrestricted_income_provider_v1(tid uuid,eid uuid,request_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();op uuid;outcome jsonb;begin
 op:=case when coalesce(request_value->>'operationId','')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then(request_value->>'operationId')::uuid else null end;
 if app.operational_provider_transport_enabled_v1()is distinct from true then
  outcome:=jsonb_build_object('status','rejected','code','feature_unavailable');
 elsif app.require_operational_provider_official_v1(tid)is null then
  outcome:=jsonb_build_object('status','rejected','code','not_director');
 else outcome:=app.record_native_unrestricted_income_v1(tid,eid,request_value);end if;
 return jsonb_build_object('kind','native-finance-provider-write-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

create function public.review_native_recorded_fund_provider_v1(tid uuid,eid uuid,request_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();op uuid;outcome jsonb;begin
 op:=case when coalesce(request_value->>'operationId','')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then(request_value->>'operationId')::uuid else null end;
 if app.operational_provider_transport_enabled_v1()is distinct from true then
  outcome:=jsonb_build_object('status','rejected','code','feature_unavailable');
 elsif app.require_operational_provider_official_v1(tid)is null then
  outcome:=jsonb_build_object('status','rejected','code','not_director');
 else outcome:=app.review_native_recorded_fund_v1(tid,eid,request_value);end if;
 return jsonb_build_object('kind','native-finance-provider-write-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

create function public.get_native_playoff_final_award_source_provider_v1(tid uuid,eid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 return app.native_playoff_final_award_source_v1(tid,eid,actor);
end$$;

create function public.record_native_playoff_final_awards_provider_v1(tid uuid,eid uuid,request_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();op uuid;outcome jsonb;begin
 op:=case when coalesce(request_value->>'operationId','')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then(request_value->>'operationId')::uuid else null end;
 if app.operational_provider_transport_enabled_v1()is distinct from true then
  outcome:=jsonb_build_object('status','rejected','code','feature_unavailable');
 elsif app.require_operational_provider_official_v1(tid)is null then
  outcome:=jsonb_build_object('status','rejected','code','not_director');
 else outcome:=app.record_native_playoff_final_awards_v1(tid,eid,request_value);end if;
 return jsonb_build_object('kind','native-finance-provider-write-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

create function public.get_native_playoff_final_award_record_provider_v1(tid uuid,eid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 if app.require_operational_provider_official_v1(tid)is null then return null;end if;
 return app.get_native_playoff_final_award_record_v1(tid,eid);
end$$;

create function public.get_native_playoff_finance_write_reconciliation_provider_v1(tid uuid,eid uuid,op uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();request_value jsonb;outcome jsonb;begin
 if app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 if app.require_operational_provider_official_v1(tid)is null then return null;end if;
 select o.request_payload into request_value from app.native_playoff_finance_write_operations_v1 o
  where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
 if not found then return null;end if;
 outcome:=app.get_native_playoff_finance_write_reconciliation_v1(tid,eid,op);
 if outcome->>'authorized'is distinct from'true'or jsonb_typeof(outcome->'result')is distinct from'object'then return null;end if;
 outcome:=outcome->'result';
 return jsonb_build_object('kind','native-finance-provider-write-v1','actorId',actor,
  'tournamentId',tid,'eventId',eid,'operationId',op,'request',request_value,'outcome',outcome);
end$$;

do $$declare signature text;begin
 foreach signature in array array[
  'app.operational_provider_transport_enabled_v1()',
  'app.require_operational_provider_official_v1(uuid)',
  'public.get_event_settings_workspace_provider_v3(uuid)',
  'public.save_event_settings_draft_provider_v3(uuid,jsonb)',
  'public.get_event_settings_operation_provider_v3(uuid,uuid)',
  'public.get_operational_finance_provider_workspace_v1(uuid,uuid)',
  'public.save_operational_finance_proposal_provider_v1(uuid,uuid,jsonb)',
  'public.reconcile_operational_finance_proposal_provider_v1(uuid,uuid,uuid)',
  'public.get_native_playoff_finance_recipient_source_provider_v1(uuid,uuid)',
  'public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb)',
  'public.review_native_recorded_fund_provider_v1(uuid,uuid,jsonb)',
  'public.get_native_playoff_final_award_source_provider_v1(uuid,uuid)',
  'public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)',
  'public.get_native_playoff_final_award_record_provider_v1(uuid,uuid)',
  'public.get_native_playoff_finance_write_reconciliation_provider_v1(uuid,uuid,uuid)'
 ]loop
  execute format('alter function %s owner to postgres',signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 end loop;
end$$;

grant execute on function
 public.get_event_settings_workspace_provider_v3(uuid),
 public.save_event_settings_draft_provider_v3(uuid,jsonb),
 public.get_event_settings_operation_provider_v3(uuid,uuid),
 public.get_operational_finance_provider_workspace_v1(uuid,uuid),
 public.save_operational_finance_proposal_provider_v1(uuid,uuid,jsonb),
 public.reconcile_operational_finance_proposal_provider_v1(uuid,uuid,uuid),
 public.get_native_playoff_finance_recipient_source_provider_v1(uuid,uuid),
 public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb),
 public.review_native_recorded_fund_provider_v1(uuid,uuid,jsonb),
 public.get_native_playoff_final_award_source_provider_v1(uuid,uuid),
 public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb),
 public.get_native_playoff_final_award_record_provider_v1(uuid,uuid),
 public.get_native_playoff_finance_write_reconciliation_provider_v1(uuid,uuid,uuid)
to authenticated;

commit;
