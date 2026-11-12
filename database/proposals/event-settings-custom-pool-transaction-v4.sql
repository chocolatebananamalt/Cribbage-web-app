-- Unpublished, default-off Event Settings transaction using the reviewed
-- combined Custom Q/Side setup writer. Existing V3 functions, reservations,
-- request hashes and historical outcomes remain unchanged.
begin;
create or replace function app.event_settings_custom_pool_transaction_enabled_v4()
returns boolean language sql immutable set search_path=''as $$select false;$$;

do $$declare d text;p text;old text;replacement text;begin
 d:=replace(pg_get_functiondef('app.save_event_settings_draft_v3(uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
 p:=replace(d,'FUNCTION app.save_event_settings_draft_v3(','FUNCTION app.save_event_settings_custom_pool_draft_v4(');
 if p=d then raise exception'Event Settings V4 clone name anchor changed';end if;
 old:=$a$qreply:=app.save_custom_q_setup_draft_v2(p_tournament_id,setup);$a$;
 replacement:=$a$qreply:=app.save_custom_pool_setup_draft_v3(p_tournament_id,setup);$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Event Settings V4 setup writer anchor changed';end if;p:=replace(p,old,replacement);
 old:=$a$if qreply->>'status'is distinct from'custom_q_setup_draft_saved'then$a$;
 replacement:=$a$if qreply->>'status'is distinct from'custom_pool_setup_draft_saved_v3'then$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Event Settings V4 setup result anchor changed';end if;p:=replace(p,old,replacement);
 old:=$a$'status','event_settings_draft_saved'$a$;replacement:=$a$'status','event_settings_custom_pool_draft_saved_v4'$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Event Settings V4 response anchor changed';end if;execute replace(p,old,replacement);
end$$;

create function app.reconcile_event_settings_custom_pool_draft_v4(p_tournament_id uuid,p_envelope jsonb)
returns jsonb language sql stable security definer set search_path=''as $$select app.reconcile_event_settings_draft_v3(p_tournament_id,p_envelope);$$;

create function public.save_event_settings_custom_pool_draft_provider_v4(tid uuid,envelope jsonb)
returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();op uuid;outcome jsonb;begin
 op:=case when coalesce(envelope#>>'{setup,request,idempotencyKey}','')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then(envelope#>>'{setup,request,idempotencyKey}')::uuid else null end;
 if app.event_settings_custom_pool_transaction_enabled_v4()is distinct from true or app.operational_provider_transport_enabled_v1()is distinct from true then outcome:=jsonb_build_object('status','rejected','code','feature_unavailable');
 elsif app.require_operational_provider_official_v1(tid)is null then outcome:=jsonb_build_object('status','rejected','code','not_director');
 else outcome:=app.save_event_settings_custom_pool_draft_v4(tid,envelope);end if;
 return jsonb_build_object('actorId',actor,'tid',tid,'operationId',op,'envelope',envelope,'outcome',outcome);
end$$;

create function public.get_event_settings_custom_pool_operation_provider_v4(tid uuid,op uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare actor uuid;request_value jsonb;outcome jsonb;begin
 if app.event_settings_custom_pool_transaction_enabled_v4()is distinct from true or app.operational_provider_transport_enabled_v1()is distinct from true then return null;end if;
 actor:=app.require_operational_provider_official_v1(tid);if actor is null then return null;end if;
 select r.request_payload into request_value from app.event_settings_save_reservations_v3 r where r.actor_id=actor and r.operation_id=op and r.tournament_id=tid;
 if not found then return null;end if;outcome:=app.reconcile_event_settings_custom_pool_draft_v4(tid,request_value);if outcome is null then return null;end if;
 return jsonb_build_object('actorId',actor,'tid',tid,'operationId',op,'envelope',request_value,'outcome',outcome);
end$$;

alter function app.event_settings_custom_pool_transaction_enabled_v4()owner to postgres;
alter function app.save_event_settings_custom_pool_draft_v4(uuid,jsonb)owner to postgres;
alter function app.reconcile_event_settings_custom_pool_draft_v4(uuid,jsonb)owner to postgres;
alter function public.save_event_settings_custom_pool_draft_provider_v4(uuid,jsonb)owner to postgres;
alter function public.get_event_settings_custom_pool_operation_provider_v4(uuid,uuid)owner to postgres;
revoke all on function app.event_settings_custom_pool_transaction_enabled_v4(),app.save_event_settings_custom_pool_draft_v4(uuid,jsonb),app.reconcile_event_settings_custom_pool_draft_v4(uuid,jsonb)from public,anon,authenticated,service_role;
revoke all on function public.save_event_settings_custom_pool_draft_provider_v4(uuid,jsonb),public.get_event_settings_custom_pool_operation_provider_v4(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_event_settings_custom_pool_draft_provider_v4(uuid,jsonb),public.get_event_settings_custom_pool_operation_provider_v4(uuid,uuid)to authenticated;
commit;
