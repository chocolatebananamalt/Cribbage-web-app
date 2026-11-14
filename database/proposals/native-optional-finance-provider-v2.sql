-- LOCAL DEFAULT-OFF SERVICE TRANSPORT. Actor must be resolved by authenticated
-- server code. No user-facing grants, finalization, cash movement or V1 fallback.
begin;
create function app.native_optional_finance_provider_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.native_optional_finance_service_access_v2(actor uuid,tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select actor is not null and tid is not null and eid is not null
 and coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')='service_role'
 and exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')
 and exists(select 1 from app.events where tournament_id=tid and id=eid)
$$;
create function public.get_native_optional_finance_workspace_provider_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if app.native_optional_finance_provider_enabled_v2()is distinct from true then return null;end if;
 return app.get_native_optional_finance_workspace_v2(actor,tid,eid);
end$$;
create function public.get_native_optional_pool_ownership_source_provider_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if app.native_optional_finance_provider_enabled_v2()is distinct from true then return null;end if;
 return app.native_optional_pool_ownership_source_v2(actor,tid,eid);
end$$;
create function public.save_native_optional_pool_ownership_provider_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare result_value jsonb;begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if app.native_optional_finance_provider_enabled_v2()is distinct from true then result_value:=jsonb_build_object('status','rejected','code','feature_unavailable');
 else result_value:=app.save_native_optional_pool_ownership_v2(actor,tid,eid,op,request);end if;
 return jsonb_build_object('kind','native-optional-finance-provider-write-v2','action','ownership','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'result',result_value);
end$$;
create function public.save_native_optional_finance_proposal_provider_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare result_value jsonb;begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if app.native_optional_finance_provider_enabled_v2()is distinct from true then result_value:=jsonb_build_object('status','rejected','code','feature_unavailable');
 else result_value:=app.save_native_optional_finance_proposal_v2(actor,tid,eid,op,request);end if;
 return jsonb_build_object('kind','native-optional-finance-provider-write-v2','action','proposal','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'result',result_value);
end$$;
create function public.reconcile_native_optional_finance_proposal_provider_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if app.native_optional_finance_provider_enabled_v2()is distinct from true then return null;end if;
 return app.reconcile_native_optional_finance_proposal_v2(actor,tid,eid,op,request);
end$$;
create function public.reconcile_native_optional_pool_ownership_provider_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if app.native_optional_finance_provider_enabled_v2()is distinct from true then return null;end if;
 return app.reconcile_native_optional_pool_ownership_v2(actor,tid,eid,op,request);
end$$;
do $$declare signature text;begin foreach signature in array array[
 'app.native_optional_finance_provider_enabled_v2()','app.native_optional_finance_service_access_v2(uuid,uuid,uuid)',
 'public.get_native_optional_finance_workspace_provider_v2(uuid,uuid,uuid)','public.get_native_optional_pool_ownership_source_provider_v2(uuid,uuid,uuid)',
 'public.save_native_optional_pool_ownership_provider_v2(uuid,uuid,uuid,uuid,jsonb)','public.save_native_optional_finance_proposal_provider_v2(uuid,uuid,uuid,uuid,jsonb)',
 'public.reconcile_native_optional_finance_proposal_provider_v2(uuid,uuid,uuid,uuid,jsonb)','public.reconcile_native_optional_pool_ownership_provider_v2(uuid,uuid,uuid,uuid,jsonb)'
]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 if starts_with(signature,'public.')then execute format('grant execute on function %s to service_role',signature);end if;
end loop;end$$;
commit;
