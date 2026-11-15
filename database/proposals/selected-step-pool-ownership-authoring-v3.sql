-- UNEXECUTED. Private authoring adapters; requires ownership V3 and journal V3.
-- No grants, payment actions, policy changes or legacy replacements.
begin;
create function public.get_selected_step_pool_ownership_workspace_provider_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $workspace$
declare s jsonb;h app.selected_step_pool_ownership_revisions_v3%rowtype;begin
 if app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','held','code','pool_awards_already_recorded');end if;
 s:=app.selected_step_pool_ownership_source_v3(actor,tid,eid);if s->>'status'is distinct from'ownership_source_available'then return s;end if;
 select*into h from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 return jsonb_build_object('kind','selected-step-pool-ownership-workspace-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'source',s,
  'version',coalesce(h.version,0),'priorRevisionId',h.id,'reviewIsCurrent',coalesce(h.source_digest=s->>'sourceDigest'and h.source_capture=s,false),'moneyMoved',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$workspace$;
create function public.save_selected_step_pool_ownership_provider_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $save$begin
 if app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 return app.save_selected_step_pool_ownership_v3(actor,tid,eid,op,request);
end$save$;
create function public.get_selected_step_pool_ownership_proof_provider_v3(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $proof$
declare p app.selected_step_pool_ownership_operations_v3%rowtype;r app.selected_step_pool_ownership_revisions_v3%rowtype;o jsonb;begin
 o:=app.reconcile_selected_step_pool_ownership_v3(actor,tid,eid,op,request);if o->>'status'is distinct from'historical_operation'then return o;end if;
 select*into p from app.selected_step_pool_ownership_operations_v3 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid and request_payload=request;
 select*into r from app.selected_step_pool_ownership_revisions_v3 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if p.operation_id is null or r.id is null or o#>>'{result,revisionId}'is distinct from r.id::text or r.source_digest is distinct from request->>'sourceDigest'then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('receipt',o->'result','request',p.request_payload,'sourceCapture',r.source_capture,'expectedVersion',r.version-1,'priorRevisionId',r.prior_revision_id,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false);
end$proof$;
do $security$declare f text;begin foreach f in array array['public.get_selected_step_pool_ownership_workspace_provider_v3(uuid,uuid,uuid)','public.save_selected_step_pool_ownership_provider_v3(uuid,uuid,uuid,uuid,jsonb)','public.get_selected_step_pool_ownership_proof_provider_v3(uuid,uuid,uuid,uuid,jsonb)']loop
 execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;end$security$;
commit;
