-- PRIVATE DEFAULT OFF. Preparation only: no prize or payment authorization.
begin;
create function app.selected_step_fund_transport_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create function public.get_selected_step_fund_workspace_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid,expense_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare native jsonb;source jsonb;version integer;
begin
 if app.selected_step_fund_transport_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 native:=app.get_selected_step_prize_source_v3(actor,tid,eid);
 if native->>'status'is distinct from'source_available'then return jsonb_build_object('status','held','code',coalesce(native->>'code','modern_owned_source_required'));end if;
 source:=app.selected_step_final_review_source_v3(actor,sid,tid,eid,expense_id);
 select coalesce(max(r.version),0)into version from app.selected_step_fund_reviews_v3 r where r.tournament_id=tid and r.event_id=eid;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return jsonb_build_object('kind','selected-step-fund-workspace-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'nativeSource',native,'source',source,'expectedVersion',version,'expenseId',expense_id,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','held','code','source_busy');end$$;
create function public.record_selected_step_fund_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_fund_transport_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return app.review_selected_step_fund_v3(actor,sid,tid,eid,op,request);
end$$;
create function public.get_selected_step_fund_operation_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare prior app.selected_step_fund_operations_v3%rowtype;result jsonb;
begin
 if app.selected_step_fund_transport_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if not pg_try_advisory_xact_lock_shared(hashtextextended('selected-step-fund-v3:'||actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.selected_step_fund_operations_v3 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 select o.result into result from app.selected_step_fund_outcomes_v3 o where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
 if result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return jsonb_build_object('kind','selected-step-fund-operation-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'result',result,'historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
do $$declare s text;begin foreach s in array array['app.selected_step_fund_transport_enabled_v3()','public.get_selected_step_fund_workspace_provider_v3(uuid,uuid,uuid,uuid,uuid)','public.record_selected_step_fund_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_selected_step_fund_operation_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)']loop execute format('alter function %s owner to postgres',s);execute format('revoke all on function %s from public,anon,authenticated,service_role',s);end loop;end$$;
commit;
