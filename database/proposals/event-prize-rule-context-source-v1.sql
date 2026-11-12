-- PRIVATE LOCAL RULE-CONTEXT UI SOURCE. Not a migration or release.
-- Depends on event-prize-activation-source-v1 and existing rule-context journal.
-- No grants, inferred sanctioning, external approval, calculation or payment.
begin;
create function app.event_prize_rule_context_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_rule_context_write_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_rule_context_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.get_event_prize_rule_context_source_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();current_pin jsonb;w jsonb;s app.event_settings_snapshots_v3%rowtype;
 e app.tournament_setup_event_versions%rowtype;r app.event_rule_context_reviews_v1%rowtype;
 item jsonb;review_value jsonb;assessment jsonb;rows_value jsonb:='[]';
 authorized boolean;is_current boolean;eligible boolean;deferred boolean;all_eligible boolean:=true;guard_available boolean;
begin
 if app.event_prize_rule_context_read_enabled_v1()is distinct from true or a is null then return null;end if;
 current_pin:=app.event_prize_activation_current_v1(tid,a);
 if current_pin is null then return jsonb_build_object('status','blocked','code','all_maincon_prize_adoption_required');end if;
 -- current_v1 holds current role/tournament/source locks, including immutable
 -- context history. Direct latest-version lookup proves absence, never a DTO.
 w:=app.get_event_prize_workspace_source_v1(tid);
 if w->>'status'='retry_exact'then return w;end if;
 if w->>'actorId'is distinct from a::text or w#>>'{settings,state}'is distinct from'present'then return null;end if;
 select*into s from app.event_settings_snapshots_v3 where id=(current_pin->>'settingsSnapshotId')::uuid and tournament_id=tid and setup_revision_id=(current_pin->>'setupRevisionId')::uuid;
 guard_available:=app.event_settings_deferred_guard_available_v1();
 for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=s.setup_revision_id and event_kind in('main','consolation')order by ordinal,client_row_id loop
  select value into item from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text;
  if item->>'mode'is distinct from'configured'then return jsonb_build_object('status','blocked','code','configured_settings_required');end if;
  select*into r from app.event_rule_context_reviews_v1 where tournament_id=tid and event_client_row_id=e.client_row_id order by version desc limit 1;
  if r.id is null then
   review_value:=jsonb_build_object('state','absent','historyExists',false);all_eligible:=false;
  else
   perform 1 from app.tournament_roles where tournament_id=tid and profile_id=r.actor_id and role in('director','co_director')order by role for share nowait;authorized:=found;
   is_current:=authorized and r.setup_revision_id=s.setup_revision_id and r.settings_snapshot_id=s.id and r.setup_event_version_id=e.id and r.draft=item->'draft'and r.context->>'eventKind'=e.event_kind;
   assessment:=app.assess_event_prize_series_draft_v1(r.draft,r.context);
   deferred:=assessment->'deferredOriginalField'='true'::jsonb;
   eligible:=is_current and assessment->>'status'='eligible'and(not deferred or guard_available);
   review_value:=jsonb_build_object('state','present','historyExists',true,'reviewId',r.id,'actorId',r.actor_id,'version',r.version,'setupRevisionId',r.setup_revision_id,'setupEventVersionId',r.setup_event_version_id,'settingsSnapshotId',r.settings_snapshot_id,'draftDigest',r.draft_digest,'draft',r.draft,'context',r.context,'reason',r.reason,'approvalReference',r.approval_reference,'reviewerAuthorized',authorized,'current',is_current,'eligible',eligible,'deferredOriginalField',deferred);
   all_eligible:=all_eligible and eligible;
  end if;
  rows_value:=rows_value||jsonb_build_array(jsonb_build_object('eventClientRowId',e.client_row_id,'eventKind',e.event_kind,'setupEventVersionId',e.id,'displayName',e.display_name,'draft',item->'draft','review',review_value));
 end loop;
 return jsonb_build_object('kind','event-prize-rule-context-workspace-v1','actorId',a,'tournamentId',tid,'setupRevisionId',current_pin->'setupRevisionId','setupVersion',current_pin->'setupVersion','settingsSnapshotId',s.id,'settingsDigest',w#>'{settings,digest}','rows',rows_value,'deferredGuardAvailable',guard_available,'allCurrentEligible',all_eligible,'activationAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Current-role-owned exact journal lookup. Current settings and context heads
-- are deliberately not required to recover an earlier completed request.
create function app.event_prize_rule_context_operation_v1(tid uuid,request_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;r app.event_rule_context_operations_v1%rowtype;
begin
 if a is null or jsonb_typeof(request_value)is distinct from'object'or octet_length(request_value::text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 op:=(request_value->>'operationId')::uuid;if op is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into r from app.event_rule_context_operations_v1 where actor_id=a and operation_id=op;
 if r.actor_id is null then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if r.tournament_id is distinct from tid or r.request_payload is distinct from request_value then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return jsonb_build_object('kind','event-prize-rule-context-operation-v1','actorId',a,'tournamentId',tid,'operationId',op,'request',r.request_payload,'result',r.result);
exception when invalid_text_representation then return null;
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.save_event_prize_rule_context_v1(tid uuid,request_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare result_value jsonb;record_value jsonb;
begin
 if app.event_prize_rule_context_write_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','feature_disabled');end if;
 result_value:=app.save_event_rule_context_v1(tid,request_value);
 -- Prefer the immutable original result; replay decoration is not an ACK.
 record_value:=app.event_prize_rule_context_operation_v1(tid,request_value);
 if record_value->>'kind'='event-prize-rule-context-operation-v1' then return record_value;end if;
 return result_value;
end$$;
create function app.get_event_prize_rule_context_operation_v1(tid uuid,request_value jsonb)returns jsonb
language sql security definer set search_path=''as $$select case when app.event_prize_rule_context_recovery_enabled_v1()is true then app.event_prize_rule_context_operation_v1(tid,request_value)else null end$$;
create function public.get_event_prize_rule_context_source_provider_v1(tid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_rule_context_source_v1(tid)$$;
create function public.save_event_prize_rule_context_provider_v1(tid uuid,request_value jsonb)returns jsonb
language sql security definer set search_path=''as $$select app.save_event_prize_rule_context_v1(tid,request_value)$$;
create function public.get_event_prize_rule_context_operation_provider_v1(tid uuid,request_value jsonb)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_rule_context_operation_v1(tid,request_value)$$;
do $acl$declare f regprocedure;begin
 foreach f in array array[
 'app.event_prize_rule_context_read_enabled_v1()'::regprocedure,'app.event_prize_rule_context_write_enabled_v1()'::regprocedure,'app.event_prize_rule_context_recovery_enabled_v1()'::regprocedure,
 'app.get_event_prize_rule_context_source_v1(uuid)'::regprocedure,'app.event_prize_rule_context_operation_v1(uuid,jsonb)'::regprocedure,
 'app.save_event_prize_rule_context_v1(uuid,jsonb)'::regprocedure,'app.get_event_prize_rule_context_operation_v1(uuid,jsonb)'::regprocedure,
 'public.get_event_prize_rule_context_source_provider_v1(uuid)'::regprocedure,'public.save_event_prize_rule_context_provider_v1(uuid,jsonb)'::regprocedure,'public.get_event_prize_rule_context_operation_provider_v1(uuid,jsonb)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$acl$;
commit;
