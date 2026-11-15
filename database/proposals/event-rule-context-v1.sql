-- UNEXECUTED PRIVATE PROPOSAL, not a migration or operational activation API.
-- Requires event-settings-workspace-v3 and existing exact JS text helpers.
-- Director declarations are audited context, NEVER external ACC approval.
begin;
create table app.event_rule_context_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),request_payload jsonb not null,
 request_hash text not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('event-rule-context-v1',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.event_rule_context_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,
 event_client_row_id uuid not null,version integer not null check(version>0),prior_review_id uuid,
 actor_id uuid not null,operation_id uuid not null,setup_revision_id uuid not null,
 setup_event_version_id uuid not null,settings_snapshot_id uuid not null references app.event_settings_snapshots_v3(id),
 draft_digest text not null check(draft_digest~'^[a-f0-9]{64}$'),draft jsonb not null,context jsonb not null,
 reason text not null,approval_reference text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_client_row_id,version),unique(id,tournament_id,event_client_row_id),
 foreign key(prior_review_id,tournament_id,event_client_row_id)references app.event_rule_context_reviews_v1(id,tournament_id,event_client_row_id),
 foreign key(actor_id,operation_id,tournament_id)references app.event_rule_context_operations_v1(actor_id,operation_id,tournament_id),
 foreign key(setup_event_version_id,tournament_id,setup_revision_id)references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id)
);
do $$declare n text;begin
 foreach n in array array['event_rule_context_operations_v1','event_rule_context_reviews_v1']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;
create function app.finish_event_rule_context_v1(tid uuid,op uuid,v jsonb,outcome jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();h text;response jsonb;
begin
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-rule-context-v1',a,tid,op,v)::text,'utf8'),'sha256'),'hex');
 response:=outcome||jsonb_build_object('actorId',a,'tournamentId',tid,'operationId',op,'request',v,'officialApprovalClaimed',false,'activationAllowed',false,'moneyMoved',false);
 insert into app.event_rule_context_operations_v1(actor_id,operation_id,tournament_id,request_payload,request_hash,result)values(a,op,tid,v,h,response);
 return response;
end$$;

create function app.save_event_rule_context_v1(tid uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;old app.event_rule_context_operations_v1%rowtype;
 head app.event_rule_context_reviews_v1%rowtype;s app.event_settings_snapshots_v3%rowtype;e app.tournament_setup_event_versions%rowtype;
 rid uuid;snapshot_id uuid;client_id uuid;item jsonb;context_value jsonb;draft_hash text;review_id uuid;next_version integer;response jsonb;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>10
 or not(v?&array['kind','operationId','expectedReviewId','setupRevisionId','settingsSnapshotId','eventClientRowId','context','reason','approvalReference','confirmed'])
 or v->>'kind'is distinct from'event-rule-context-v1'or v->'confirmed'is distinct from'true'::jsonb
 or jsonb_typeof(v->'operationId')is distinct from'string'or(v->>'operationId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'setupRevisionId')is distinct from'string'or(v->>'setupRevisionId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'settingsSnapshotId')is distinct from'string'or(v->>'settingsSnapshotId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'eventClientRowId')is distinct from'string'or(v->>'eventClientRowId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or not(v->'expectedReviewId'='null'::jsonb or(jsonb_typeof(v->'expectedReviewId')='string'and(v->>'expectedReviewId')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 or jsonb_typeof(v->'reason')is distinct from'string'or v->>'reason'<>app.custom_payout_classification_text_v2(v->>'reason')or app.event_settings_js_text_length_v3(v->>'reason')not between 1 and 500
 or(v->>'reason')~U&'[\0001-\001F\007F]'or jsonb_typeof(v->'approvalReference')is distinct from'string'or app.event_settings_js_text_length_v3(v->>'approvalReference')>1000
 or jsonb_typeof(v->'context')is distinct from'object'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 context_value:=v->'context';
 if(select count(*)from jsonb_object_keys(context_value))<>4 or not(context_value?&array['sanctioned','eventKind','durationDays','originalEntrants'])
 or jsonb_typeof(context_value->'sanctioned')is distinct from'boolean'or coalesce(context_value->>'eventKind','')not in('main','consolation')
 or jsonb_typeof(context_value->'durationDays')is distinct from'number'or(context_value->>'durationDays')!~'^[1-9][0-9]*$'
 or(context_value->>'durationDays')::numeric>2147483647 or context_value->'originalEntrants'is distinct from'null'::jsonb
 then return jsonb_build_object('status','rejected','code','invalid_setup_context');end if;
 op:=(v->>'operationId')::uuid;rid:=(v->>'setupRevisionId')::uuid;snapshot_id:=(v->>'settingsSnapshotId')::uuid;client_id:=(v->>'eventClientRowId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-rule-context-v1',a,tid,op,v)::text,'utf8'),'sha256'),'hex');
 select*into old from app.event_rule_context_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id<>tid or old.request_hash<>h or old.request_payload<>v then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return old.result||jsonb_build_object('historicalReceipt',true);
 end if;
 -- Immutable source tables are frozen against uncoordinated new revisions.
 lock table app.tournament_setup_revisions,app.tournament_setup_event_versions,app.event_settings_snapshots_v3,app.tournament_setup_activations in share mode nowait;
 if rid is distinct from(select id from app.tournament_setup_revisions where tournament_id=tid order by version desc limit 1)
 then return app.finish_event_rule_context_v1(tid,op,v,jsonb_build_object('status','rejected','code','setup_source_changed'));end if;
 if exists(select 1 from app.tournament_setup_activations where tournament_id=tid and setup_revision_id=rid)
 then return app.finish_event_rule_context_v1(tid,op,v,jsonb_build_object('status','rejected','code','activated_context_is_frozen'));end if;
 select*into s from app.event_settings_snapshots_v3 where id=snapshot_id and tournament_id=tid and setup_revision_id=rid;
 select*into e from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid and client_row_id=client_id;
 if s.id is null or e.id is null or e.event_kind not in('main','consolation')or e.event_kind is distinct from context_value->>'eventKind'
 then return app.finish_event_rule_context_v1(tid,op,v,jsonb_build_object('status','rejected','code','event_source_changed'));end if;
 select value into item from jsonb_array_elements(s.effective_settings)where value->>'eventClientRowId'=client_id::text;
 if item->>'mode'is distinct from'configured'or not app.valid_event_parameters_raw_v3(item->'draft')then return app.finish_event_rule_context_v1(tid,op,v,jsonb_build_object('status','rejected','code','configured_settings_required'));end if;
 select*into head from app.event_rule_context_reviews_v1 where tournament_id=tid and event_client_row_id=client_id order by version desc limit 1;
 if coalesce(head.id::text,'')<>coalesce(v->>'expectedReviewId','')then return app.finish_event_rule_context_v1(tid,op,v,jsonb_build_object('status','rejected','code','review_version_changed'));end if;
 draft_hash:=encode(extensions.digest(convert_to(jsonb_build_array('event-rule-draft-v1',tid,rid,s.id,e.id,item->'draft')::text,'utf8'),'sha256'),'hex');
 review_id:=extensions.gen_random_uuid();next_version:=coalesce(head.version,0)+1;
 response:=app.finish_event_rule_context_v1(tid,op,v,jsonb_build_object('status','context_recorded','reviewId',review_id,'version',next_version,'priorReviewId',head.id,'provenance','director_declared','source',jsonb_build_object('tournamentId',tid,'setupRevisionId',rid,'settingsSnapshotId',s.id,'eventClientRowId',client_id,'setupEventVersionId',e.id,'draftDigest',draft_hash),'context',context_value));
 insert into app.event_rule_context_reviews_v1(id,tournament_id,event_client_row_id,version,prior_review_id,actor_id,operation_id,setup_revision_id,setup_event_version_id,settings_snapshot_id,draft_digest,draft,context,reason,approval_reference)
 values(review_id,tid,client_id,next_version,head.id,a,op,rid,e.id,s.id,draft_hash,item->'draft',context_value,v->>'reason',v->>'approvalReference');
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_event_rule_context_operation_v1(tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.event_rule_context_operations_v1%rowtype;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into r from app.event_rule_context_operations_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if not found then return jsonb_build_object('status','unknown','actorId',a,'tournamentId',tid,'operationId',op);end if;
 return r.result||jsonb_build_object('historicalReceipt',true);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function app.finish_event_rule_context_v1(uuid,uuid,jsonb,jsonb)owner to postgres;
alter function app.save_event_rule_context_v1(uuid,jsonb)owner to postgres;
alter function app.get_event_rule_context_operation_v1(uuid,uuid)owner to postgres;
revoke all on function app.finish_event_rule_context_v1(uuid,uuid,jsonb,jsonb),app.save_event_rule_context_v1(uuid,jsonb),app.get_event_rule_context_operation_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
