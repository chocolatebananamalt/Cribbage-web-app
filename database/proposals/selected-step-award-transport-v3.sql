-- PRIVATE / DEFAULT OFF, service-only actor/session adapters. All EXECUTE is
-- revoked. Raw captures are for trusted server projection, never browser JSON.
begin;
create function app.selected_step_award_transport_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create function public.get_selected_step_award_workspace_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare record jsonb;source jsonb;
begin
 if app.selected_step_award_transport_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 record:=app.get_selected_step_award_record_v3(actor,sid,tid,eid);
 if record->>'status'='retry_exact'then return record;end if;
 source:=app.current_selected_step_award_source_v3(actor,sid,tid,eid);
 if source->>'status'='retry_exact'then return source;end if;
 if source is null or source->>'status'is distinct from'source_available'then return jsonb_build_object('status','held','code',coalesce(source->>'code','source_unavailable'));end if;
 if record is not null and(record->>'kind'is distinct from'selected-step-award-record-v3'or record->>'sourceDigest'is distinct from source->>'sourceDigest'
  or record->'sourceCapture'is distinct from source or record->'prizeRevisionId'is distinct from source#>'{prizeWorkspace,head,revisionId}'
  or record->'fundReviewId'is distinct from source#>'{fundSource,reviewId}'or record->'plan'is distinct from source->'plan'
  or record->'groups'is distinct from source->'groups'
  or(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(record->'recipients')x)is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(source->'recipients')x))
 then return jsonb_build_object('status','held','code','record_source_changed');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return jsonb_build_object('kind','selected-step-award-workspace-v3','status',case when record is null then'review'else'recorded'end,
  'actorId',actor,'tournamentId',tid,'eventId',eid,'source',source,'record',record,'currentSourceVerified',true,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;
create function public.record_selected_step_awards_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_award_transport_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return app.record_selected_step_awards_v3(actor,sid,tid,eid,op,request);
end$$;
-- Owned historical outcome recovery intentionally does not consult current
-- fund/sporting source. It cannot make a stale record current Results.
create function public.get_selected_step_award_operation_provider_v3(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare operation app.selected_step_award_operations_v3%rowtype;result jsonb;record jsonb;h text;
begin
 if app.selected_step_award_transport_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock_shared(hashtextextended('modern-prize-v2:'||actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into operation from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-award-request-v3',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 if operation.tournament_id is distinct from tid or operation.event_id is distinct from eid or operation.request is distinct from request or operation.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 select o.result into result from app.selected_step_award_outcomes_v3 o where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
 if result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 if result->>'status'='accepted'then
  record:=app.get_selected_step_award_record_v3(actor,sid,tid,eid);
  if record is null or record->'awardSetId'is distinct from result->'awardSetId'or record->'sourceDigest'is distinct from result->'sourceDigest'then return jsonb_build_object('status','retry_exact','code','record_unavailable');end if;
 end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return jsonb_build_object('kind','selected-step-award-operation-v3','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'result',result,'record',record,'historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;
do $$declare signature text;begin foreach signature in array array[
 'app.selected_step_award_transport_enabled_v3()','public.get_selected_step_award_workspace_provider_v3(uuid,uuid,uuid,uuid)',
 'public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_selected_step_award_operation_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)'
 ]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
