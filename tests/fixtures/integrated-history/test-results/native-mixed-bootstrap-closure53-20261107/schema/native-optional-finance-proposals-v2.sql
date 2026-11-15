-- PRIVATE LOCAL CANDIDATE. Separate V2 ownership/basis journal, never a V1
-- allocation/proposal hash-domain rewrite. Estimates only; no final liability.
begin;
create function app.native_optional_finance_proposals_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;
do $$declare d text;p text;anchor text;pos integer;begin
 d:=pg_get_functiondef('app.valid_operational_event_finance_editor_v1(jsonb,jsonb,jsonb)'::regprocedure);
 p:=replace(d,'app.valid_operational_event_finance_editor_v1','app.valid_native_optional_finance_editor_v2');
 if p=d then raise exception'optional Finance editor clone anchor changed';end if;
 anchor:='coalesce(line->>''category'','''')not in(''player_benefit'',''operating_expense'',''unrestricted_income'')';pos:=strpos(p,anchor);
 if pos=0 then raise exception'optional Finance category anchor changed';end if;
 p:=overlay(p placing 'coalesce(line->>''category'','''')not in(''player_benefit'',''operating_expense'',''unrestricted_income'',''q_pool_fund'',''side_pool_fund'')'from pos for length(anchor));
 anchor:='  k:=line->>''lineId'';old:=latest->k;cat:=line->>''category'';';
 if strpos(p,anchor)=0 then raise exception'optional Finance read-only line anchor changed';end if;
 p:=replace(p,anchor,'  if line->>''category''in(''q_pool_fund'',''side_pool_fund'')and not exists(select 1 from jsonb_array_elements(w->''history'')x where x is not distinct from r)then return false;end if;'||chr(10)||anchor);
 anchor:='else income:=income+(line->>''amountMinor'')::numeric;end if;';
 if strpos(p,anchor)=0 then raise exception'optional Finance income anchor changed';end if;
 p:=replace(p,anchor,'elsif line->>''category''=''unrestricted_income''then income:=income+(line->>''amountMinor'')::numeric;end if;');
 anchor:='else plan_income:=plan_income+(line->>''amountMinor'')::numeric;end if;';
 if strpos(p,anchor)=0 then raise exception'optional Finance plan income anchor changed';end if;
 p:=replace(p,anchor,'elsif line->>''category''=''unrestricted_income''then plan_income:=plan_income+(line->>''amountMinor'')::numeric;end if;');
 execute p;
end$$;
create table app.native_optional_finance_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-proposal-v2',actor_id,operation_id,tournament_id,event_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.native_optional_finance_revisions_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),prior_revision_id uuid,ownership_revision_id uuid not null,
 actor_id uuid not null,operation_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),basis_digest text not null check(basis_digest~'^[a-f0-9]{64}$'),
 source_capture jsonb not null,basis jsonb not null,editor jsonb not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_revision_id,tournament_id,event_id)references app.native_optional_finance_revisions_v2(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_finance_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_optional_finance_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_finance_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin foreach n in array array['native_optional_finance_operations_v2','native_optional_finance_revisions_v2','native_optional_finance_outcomes_v2']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;
create function app.save_native_optional_finance_proposal_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare source_value jsonb;head app.native_optional_finance_revisions_v2%rowtype;prior app.native_optional_finance_operations_v2%rowtype;
 h text;result_value jsonb;rid uuid:=extensions.gen_random_uuid();
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if app.native_optional_finance_proposals_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for update nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>7
  or not(request?&array['kind','expectedVersion','sourceDigest','basisDigest','editor','reason','reviewed'])
  or request->>'kind'is distinct from'native-optional-finance-proposal-v2'or request->'reviewed'is distinct from'true'::jsonb
  or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'
  or(request->>'expectedVersion')::numeric>=2147483647 or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'basisDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')
  or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-proposal-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.native_optional_finance_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select o.result into result_value from app.native_optional_finance_outcomes_v2 o where o.actor_id=actor and o.operation_id=op;
  return coalesce(result_value,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 source_value:=app.native_optional_finance_source_v2(actor,tid,eid);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value is null or source_value->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code','source_blocked');end if;
 if source_value->>'sourceDigest'is distinct from request->>'sourceDigest'or source_value->>'basisDigest'is distinct from request->>'basisDigest'
 then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into head from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 if head.id is not null and(head.source_digest is distinct from source_value->>'sourceDigest'or head.basis_digest is distinct from source_value->>'basisDigest')
 then return jsonb_build_object('status','rejected','code','explicit_source_adoption_required');end if;
 if app.valid_native_optional_finance_editor_v2(request->'editor',source_value->'basis',head.editor)is distinct from true
 then return jsonb_build_object('status','rejected','code','invalid_editor');end if;
 insert into app.native_optional_finance_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_finance_revisions_v2(id,tournament_id,event_id,version,prior_revision_id,ownership_revision_id,actor_id,operation_id,source_digest,basis_digest,source_capture,basis,editor,reason)
 values(rid,tid,eid,coalesce(head.version,0)+1,head.id,(source_value#>>'{raw,ownershipRevisionId}')::uuid,actor,op,source_value->>'sourceDigest',source_value->>'basisDigest',source_value,source_value->'basis',request->'editor',request->>'reason');
 result_value:=jsonb_build_object('status','optional_finance_proposal_saved_v2','revisionId',rid,'version',coalesce(head.version,0)+1,'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,
  'sourceDigest',source_value->>'sourceDigest','basisDigest',source_value->>'basisDigest','proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.native_optional_finance_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
create function app.get_native_optional_finance_workspace_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare source_value jsonb;head app.native_optional_finance_revisions_v2%rowtype;history jsonb;is_current boolean;
begin
 source_value:=app.native_optional_finance_source_v2(actor,tid,eid);if source_value is null then return null;end if;
 if source_value->>'status'='retry_exact'then return source_value;end if;
 lock table app.native_optional_finance_revisions_v2 in share mode nowait;
 select*into head from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 is_current:=head.id is not null and source_value->>'status'='source_available'and head.source_digest=source_value->>'sourceDigest'and head.basis_digest=source_value->>'basisDigest';
 select coalesce(jsonb_agg(jsonb_build_object('revisionId',id,'version',version,'priorRevisionId',prior_revision_id,
  'ownershipRevisionId',ownership_revision_id,'actorId',actor_id,'operationId',operation_id,'sourceDigest',source_digest,'basisDigest',basis_digest,
  'editor',editor,'reason',reason,'savedAt',to_char(created_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))order by version),'[]')into history
 from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid;
 return jsonb_build_object('kind','native-optional-finance-workspace-v2','actorId',actor,'tournamentId',tid,'eventId',eid,
  'source',source_value,'currentVersion',coalesce(head.version,0),'current',coalesce(is_current,false),'history',history,
  'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
create function app.reconcile_native_optional_finance_proposal_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.native_optional_finance_operations_v2%rowtype;result_value jsonb;h text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.native_optional_finance_operations_v2 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-finance-proposal-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select o.result into result_value from app.native_optional_finance_outcomes_v2 o where o.actor_id=actor and o.operation_id=op;
 if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('status','historical_operation','result',result_value,'currentFundAuthority',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.native_optional_finance_proposals_enabled_v2()owner to postgres;
alter function app.valid_native_optional_finance_editor_v2(jsonb,jsonb,jsonb)owner to postgres;
alter function app.save_native_optional_finance_proposal_v2(uuid,uuid,uuid,uuid,jsonb)owner to postgres;
alter function app.get_native_optional_finance_workspace_v2(uuid,uuid,uuid)owner to postgres;
alter function app.reconcile_native_optional_finance_proposal_v2(uuid,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_optional_finance_proposals_enabled_v2(),app.valid_native_optional_finance_editor_v2(jsonb,jsonb,jsonb),app.save_native_optional_finance_proposal_v2(uuid,uuid,uuid,uuid,jsonb),app.get_native_optional_finance_workspace_v2(uuid,uuid,uuid),app.reconcile_native_optional_finance_proposal_v2(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
commit;
