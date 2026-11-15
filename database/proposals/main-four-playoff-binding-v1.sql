-- LOCAL SOURCE CANDIDATE ONLY. Default-off normal-auth read provider; no grants, writes or enablement.
begin;
do $$begin
 if current_user<>'postgres'then raise exception'Reviewed postgres owner required';end if;
 if to_regprocedure('app.get_main_four_playoff_binding_v1(uuid,uuid,uuid)')is not null then raise exception'Existing binding requires version reconciliation';end if;
end$$;
create function app.main_four_playoff_binding_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
alter function app.main_four_playoff_binding_enabled_v1()owner to postgres;
revoke all on function app.main_four_playoff_binding_enabled_v1()from public,anon,authenticated,service_role;

create function app.get_main_four_playoff_binding_core_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare q app.qualification_result_versions%rowtype;v app.playoff_outcome_versions_v3%rowtype;
 r app.operation_receipts%rowtype;w jsonb;expected_response jsonb;h text;body jsonb;
begin
 -- Revoked private core: only the guarded service/normal-session wrappers call it.
 if actor is null or tid is null or eid is null
 or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))then return null;end if;
 if not app.main_four_playoff_binding_enabled_v1()then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 select*into v from app.playoff_outcome_versions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null or q.qualifier_count<>4 or v.id is null or v.qualification_result_version_id<>q.id then return jsonb_build_object('status','blocked','code','result_linkage_unavailable');end if;
 w:=public.get_standard_singles_playoff_outcome_workspace_v3(actor,tid,eid);
 if w is null or w->'blocker'is distinct from'null'::jsonb or w->'legacyConflict'is distinct from'false'::jsonb
 or w->>'qualificationResultVersionId'is distinct from q.id::text or w->'currentVersion'is distinct from to_jsonb(v.version)
 or w->'result'is distinct from jsonb_build_object('resultId',v.id,'version',v.version,'series',v.series,'outcomes',v.outcomes,
  'bracketSourceVersion',v.bracket_source_version,'mrpSourceVersion',v.mrp_source_version,'recordedAt',v.recorded_at)
 then return jsonb_build_object('status','blocked','code','workspace_source_changed');end if;
 if app.derive_four_player_playoff_v3(q.id,v.series)is distinct from v.outcomes then return jsonb_build_object('status','blocked','code','result_evidence_invalid');end if;
 if(v.version=1 and v.supersedes_id is not null)or(v.version>1 and not exists(select 1 from app.playoff_outcome_versions_v3 prior where prior.id=v.supersedes_id and prior.tournament_id=tid and prior.event_id=eid and prior.version=v.version-1))
 then return jsonb_build_object('status','blocked','code','result_history_unavailable');end if;
 select*into r from app.operation_receipts where id=v.operation_receipt_id and tournament_id=tid;
 expected_response:=jsonb_build_object('status','playoff_outcomes_recorded','tournamentId',tid,'eventId',eid,'resultId',v.id,'version',v.version,
  'bracketSourceVersion',v.bracket_source_version,'mrpSourceVersion',v.mrp_source_version,'recordedAt',v.recorded_at);
 h:=encode(extensions.digest(convert_to(jsonb_build_array('record_standard_singles_playoff_outcomes_v3',v.recorded_by,tid,eid,v.qualification_result_version_id,v.version-1,v.series)::text,'utf8'),'sha256'),'hex');
 if r.id is null or r.actor_profile_id<>v.recorded_by or r.operation_type<>'record_standard_singles_playoff_outcomes_v3'
 or r.target_id<>eid or r.outcome<>'accepted'or r.client_operation_id is null or r.request_hash is distinct from h or r.response_payload is distinct from expected_response
 or(select count(*)from app.audit_events a where a.tournament_id=tid and a.actor_profile_id=v.recorded_by and a.operation_receipt_id=r.id
  and a.entity_type='playoff_outcome_v3'and a.entity_id=v.id and a.action='playoff_outcomes_v3_recorded'and a.after_state=expected_response)<>1
 then return jsonb_build_object('status','blocked','code','result_receipt_unavailable');end if;
 body:=jsonb_build_object('kind','main-four-playoff-binding-v1','status','source_available','tournamentId',tid,'eventId',eid,
  'qualificationHead',jsonb_build_object('resultVersionId',q.id,'version',q.version),
  'resultHead',jsonb_build_object('resultId',v.id,'version',v.version,'qualificationResultVersionId',v.qualification_result_version_id),
  'receiptBinding',jsonb_build_object('receiptId',r.id,'requestHash',h,'accepted',true,'auditMatched',true),
  'workspace',w,'readOnly',true,'publicAccessGranted',false,'independentPlayEstablished',false);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(body::text,'utf8'),'sha256'),'hex'));
end$$;
alter function app.get_main_four_playoff_binding_core_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_main_four_playoff_binding_core_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;

-- Preserve the existing service-only interface; supplying an actor grants no access.
create function app.get_main_four_playoff_binding_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$begin
 if current_setting('request.jwt.claim.role',true)is distinct from'service_role'then return null;end if;
 return app.get_main_four_playoff_binding_core_v1(actor,tid,eid);
end$$;
alter function app.get_main_four_playoff_binding_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_main_four_playoff_binding_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.main_four_playoff_binding_actor_v1(tid uuid)returns uuid
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid:=auth.uid();j jsonb:=auth.jwt();begin
 if actor is null or j->>'sub'is distinct from actor::text or coalesce(j->>'role','')<>'authenticated'
 or coalesce(j->>'exp','')!~'^[0-9]{1,16}$'or(j->>'exp')::numeric<=extract(epoch from clock_timestamp())
 or coalesce(j->>'session_id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=(j->>'session_id')::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')for share nowait;if not found then return null;end if;
 return actor;
end$$;
alter function app.main_four_playoff_binding_actor_v1(uuid)owner to postgres;
revoke all on function app.main_four_playoff_binding_actor_v1(uuid)from public,anon,authenticated,service_role;

-- Normal-cookie read only; derives actor/session, never accepts an actor parameter.
-- A later reviewed release must explicitly enable execution privileges; this candidate enables none.
create function public.get_main_four_playoff_binding_provider_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;body jsonb;begin
 if app.main_four_playoff_binding_enabled_v1()is distinct from true or p_tournament_id is null or p_event_id is null then return null;end if;
 actor:=app.main_four_playoff_binding_actor_v1(p_tournament_id);if actor is null then return null;end if;
 body:=app.get_main_four_playoff_binding_core_v1(actor,p_tournament_id,p_event_id);
 if app.main_four_playoff_binding_enabled_v1()is distinct from true or app.main_four_playoff_binding_actor_v1(p_tournament_id)is distinct from actor then return null;end if;
 return body;
exception when lock_not_available then return null;
end$$;
alter function public.get_main_four_playoff_binding_provider_v1(uuid,uuid)owner to postgres;
revoke all on function public.get_main_four_playoff_binding_provider_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
