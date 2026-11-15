-- PRIVATE / DEFAULT OFF. Explicit expense-only authoring after pool collection.
-- No receipt allocation is created, reassigned, or relabeled as native history.
-- Requires joint-main-consolation-expenses-v3. Post-fund-review amendments held.
begin;
create function app.joint_expense_authoring_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.joint_expense_split_operations_v3(actor_id uuid not null references app.profiles(id),session_id uuid not null,operation_id uuid not null,tournament_id uuid not null,main_event_id uuid not null,consolation_event_id uuid not null,request jsonb not null,request_hash text not null,
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,main_event_id,consolation_event_id),
 foreign key(main_event_id,tournament_id)references app.events(id,tournament_id),foreign key(consolation_event_id,tournament_id)references app.events(id,tournament_id),check(main_event_id<>consolation_event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('joint-expense-split-request-v3',actor_id,operation_id,tournament_id,main_event_id,consolation_event_id,request)::text,'utf8'),'sha256'),'hex')));
create table app.joint_expense_split_revisions_v3(id uuid primary key default extensions.gen_random_uuid(),actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,main_event_id uuid not null,consolation_event_id uuid not null,version integer not null check(version>0),prior_revision_id uuid references app.joint_expense_split_revisions_v3(id),source_digest text not null,source_capture jsonb not null,sources jsonb not null,request_hash text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,main_event_id,consolation_event_id,version),unique(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,main_event_id,consolation_event_id)references app.joint_expense_split_operations_v3(actor_id,operation_id,tournament_id,main_event_id,consolation_event_id),check(source_capture->>'sourceDigest'=source_digest));
create table app.joint_expense_split_outcomes_v3(actor_id uuid not null,operation_id uuid not null,result jsonb not null,primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.joint_expense_split_operations_v3(actor_id,operation_id));
create table app.joint_expense_split_cancellations_v3(actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,main_event_id uuid not null,consolation_event_id uuid not null,session_id uuid not null,request jsonb not null,result jsonb not null,cancelled_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),foreign key(main_event_id,tournament_id)references app.events(id,tournament_id),foreign key(consolation_event_id,tournament_id)references app.events(id,tournament_id));
create function app.joint_expense_cancelled_reply_v3(actor uuid,tid uuid,main_id uuid,op uuid,request jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$declare c app.joint_expense_split_cancellations_v3%rowtype;begin
 select*into c from app.joint_expense_split_cancellations_v3 where actor_id=actor and operation_id=op;if not found then return null;end if;
 if c.tournament_id<>tid or c.main_event_id<>main_id or c.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;return c.result;end$$;

create function app.joint_expense_physical_rows_v3(tid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare rows jsonb;begin
 if exists(select 1 from app.tournament_expense_events e where e.tournament_id=tid and e.event_type='recorded'and not exists(select 1 from app.tournament_expense_events n where n.expense_id=e.expense_id and n.version>e.version)and(e.currency_code<>'USD'or e.amount_minor<=0))then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e.id,'description',e.description,'amountMinor',e.amount_minor)order by e.id),'[]'::jsonb)into rows from app.tournament_expense_events e where e.tournament_id=tid and e.event_type='recorded'and not exists(select 1 from app.tournament_expense_events n where n.expense_id=e.expense_id and n.version>e.version);
 if jsonb_array_length(rows)>10000 then return null;end if;return rows;end$$;
create function app.build_joint_expense_split_rows_v3(expenses jsonb,splits jsonb,main_id uuid,con_id uuid)returns jsonb language plpgsql immutable set search_path=''as $$
declare e jsonb;x jsonb;p jsonb;sources jsonb:='[]';seen text[]:='{}';a numeric;b numeric;begin
 if main_id is null or con_id is null or main_id=con_id or jsonb_typeof(expenses)is distinct from'array'or jsonb_typeof(splits)is distinct from'array'or jsonb_array_length(splits)<>jsonb_array_length(expenses)or jsonb_array_length(splits)>10000 then return null;end if;
 for e in select value from jsonb_array_elements(expenses)loop
  select value into x from jsonb_array_elements(splits)where value->'expenseEventId'=e->'expenseEventId';
  if app.event_prize_exact_keys_source_v1(x,array['expenseEventId','mainMinor','mainCategory','consolationMinor','consolationCategory'])is distinct from true or x->>'expenseEventId'=any(seen)or jsonb_typeof(x->'mainMinor')is distinct from'number'or jsonb_typeof(x->'consolationMinor')is distinct from'number'or coalesce(x->>'mainMinor','')!~'^(0|[1-9][0-9]{0,15})$'or coalesce(x->>'consolationMinor','')!~'^(0|[1-9][0-9]{0,15})$'then return null;end if;
  seen:=array_append(seen,x->>'expenseEventId');a:=(x->>'mainMinor')::numeric;b:=(x->>'consolationMinor')::numeric;
  if a+b is distinct from(e->>'amountMinor')::numeric or a+b<=0 or a+b>9007199254740991 or(a=0 and x->'mainCategory'is distinct from'null'::jsonb)or(a>0 and coalesce(x->>'mainCategory','')not in('player_benefit','operating_expense'))or(b=0 and x->'consolationCategory'is distinct from'null'::jsonb)or(b>0 and coalesce(x->>'consolationCategory','')not in('player_benefit','operating_expense'))then return null;end if;
  p:='[]';if a>0 then p:=p||jsonb_build_array(jsonb_build_object('eventId',main_id,'bucket',x->'mainCategory','poolId',null,'amountMinor',a,'classificationReviewed',true));end if;
  if b>0 then p:=p||jsonb_build_array(jsonb_build_object('eventId',con_id,'bucket',x->'consolationCategory','poolId',null,'amountMinor',b,'classificationReviewed',true));end if;
  sources:=sources||jsonb_build_array(jsonb_build_object('sourceId',e->'expenseEventId','physicalEvidenceId',e->'expenseEventId','kind','expense','amountMinor',e->'amountMinor','state','active','allocations',p));
 end loop;
 if cardinality(seen)<>jsonb_array_length(splits)then return null;end if;return sources;
exception when numeric_value_out_of_range or invalid_text_representation then return null;end$$;

create function app.current_joint_expense_author_source_v3(actor uuid,sid uuid,tid uuid,main_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare con_id uuid;raw jsonb;expenses jsonb;head app.joint_expense_split_revisions_v3%rowtype;b jsonb;begin
 if app.joint_expense_authoring_enabled_v3()is distinct from true or app.joint_event_expenses_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 if app.main_con_coexistence_context_v3(tid,main_id)is distinct from true then return jsonb_build_object('status','held','code','linked_main_consolation_context_required');end if;
 select id into con_id from app.events where tournament_id=tid and event_type='consolation'and app.linked_consolation_main_event_v1(tid,id)=main_id;
 if con_id is null or app.selected_step_final_access_v3(actor,sid,tid,con_id)is distinct from true then return null;end if;
 perform app.lock_native_ledger_sources_v1();lock table app.joint_expense_split_revisions_v3,app.selected_step_pool_ownership_revisions_v3,app.selected_step_fund_reviews_v3 in share mode nowait;
 -- A new explicit review may supersede unbound ownership proposals. It must
 -- not silently amend expense shares already used for fund approval/awards.
 if app.modern_manual_playoff_financial_hold_v1(tid,main_id)or app.modern_manual_playoff_financial_hold_v1(tid,con_id)
 or exists(select 1 from app.selected_step_fund_reviews_v3 where tournament_id=tid and event_id in(main_id,con_id))
 or exists(select 1 from app.native_recorded_fund_reviews_v1 where tournament_id=tid and event_id in(main_id,con_id))
 or exists(select 1 from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id in(main_id,con_id))
 or app.legacy_financial_liability_exists_v1(tid,main_id)is distinct from false or app.legacy_financial_liability_exists_v1(tid,con_id)is distinct from false then return jsonb_build_object('status','held','code','bound_financial_review_requires_separate_amendment');end if;
 raw:=app.native_optional_recorded_sources_v2(actor,tid);if raw->>'status'is distinct from'sources_available'then return jsonb_build_object('status','held','code','current_physical_sources_required');end if;
 expenses:=app.joint_expense_physical_rows_v3(tid);if expenses is null or jsonb_array_length(expenses)=0 then return jsonb_build_object('status','held','code','recorded_expenses_required');end if;
 select*into head from app.joint_expense_split_revisions_v3 where tournament_id=tid and main_event_id=main_id and consolation_event_id=con_id order by version desc limit 1;
 if head.version=2147483647 then return jsonb_build_object('status','held','code','expense_review_version_exhausted');end if;
 b:=jsonb_build_object('kind','joint-expense-split-author-source-v3','status','source_available','actorId',actor,'tournamentId',tid,'eventId',main_id,'consolationEventId',con_id,'expectedVersion',coalesce(head.version,0),'priorRevisionId',head.id,'expenses',expenses,'existingSources',case when head.id is null then'[]'::jsonb else head.sources end,'nativeRawSource',raw,'moneyMoved',false,'receiptOwnershipChanged',false,'requiresFreshOwnershipReview',true);
 if app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,con_id)is distinct from true then return null;end if;
 return b||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(b::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.guard_joint_expense_split_revision_v3()returns trigger language plpgsql security definer set search_path=''as $$declare o app.joint_expense_split_operations_v3%rowtype;s jsonb;begin
 select*into o from app.joint_expense_split_operations_v3 where actor_id=new.actor_id and operation_id=new.operation_id and tournament_id=new.tournament_id and main_event_id=new.main_event_id and consolation_event_id=new.consolation_event_id;
 s:=app.current_joint_expense_author_source_v3(o.actor_id,o.session_id,o.tournament_id,o.main_event_id);
 if o.operation_id is null or o.request->'reviewed'is distinct from'true'::jsonb or s->>'status'is distinct from'source_available'or s is distinct from new.source_capture or new.source_digest is distinct from s->>'sourceDigest'or o.request->>'expectedSourceDigest'is distinct from new.source_digest or new.request_hash<>o.request_hash or new.version<>(s->>'expectedVersion')::integer+1 or coalesce(to_jsonb(new.prior_revision_id),'null'::jsonb)is distinct from s->'priorRevisionId'or new.consolation_event_id::text is distinct from s->>'consolationEventId'or new.sources is distinct from app.build_joint_expense_split_rows_v3(s->'expenses',o.request->'splits',new.main_event_id,new.consolation_event_id)or new.sources is null then raise exception'joint_expense_review_source_changed';end if;return new;end$$;
create trigger current_source before insert on app.joint_expense_split_revisions_v3 for each row execute function app.guard_joint_expense_split_revision_v3();
create function public.record_joint_expense_split_provider_v3(actor uuid,sid uuid,tid uuid,main_id uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.joint_expense_split_operations_v3%rowtype;s jsonb;sources jsonb;h text;r jsonb;rid uuid:=extensions.gen_random_uuid();con_id uuid;begin
 if app.joint_expense_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array['kind','expectedSourceDigest','expectedVersion','priorRevisionId','consolationEventId','splits','reviewed','reason'])is distinct from true or request->>'kind'is distinct from'joint-expense-split-review-v3'or request->'reviewed'is distinct from'true'::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->'reason')is distinct from true or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'consolationEventId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 con_id:=(request->>'consolationEventId')::uuid;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('joint-expense-split-request-v3',actor,op,tid,main_id,con_id,request)::text,'utf8'),'sha256'),'hex');
 if not pg_try_advisory_xact_lock(hashtextextended('joint-expense-split:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into prior from app.joint_expense_split_operations_v3 where actor_id=actor and operation_id=op;
 r:=app.joint_expense_cancelled_reply_v3(actor,tid,main_id,op,request);if r is not null then return r;end if;
 if prior.operation_id is not null then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','operation_conflict');end if;select result into r from app.joint_expense_split_outcomes_v3 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end if;
 s:=app.current_joint_expense_author_source_v3(actor,sid,tid,main_id);if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(s->>'code','current_source_required'));end if;
 if request->>'expectedSourceDigest'is distinct from s->>'sourceDigest'or request->'expectedVersion'is distinct from s->'expectedVersion'or request->'priorRevisionId'is distinct from s->'priorRevisionId'or request->>'consolationEventId'is distinct from s->>'consolationEventId'then return jsonb_build_object('status','rejected','code','review_source_changed');end if;
 sources:=app.build_joint_expense_split_rows_v3(s->'expenses',request->'splits',main_id,con_id);if sources is null then return jsonb_build_object('status','rejected','code','explicit_conserved_expense_splits_required');end if;
 insert into app.joint_expense_split_operations_v3 values(actor,sid,op,tid,main_id,con_id,request,h);
 insert into app.joint_expense_split_revisions_v3(id,actor_id,operation_id,tournament_id,main_event_id,consolation_event_id,version,prior_revision_id,source_digest,source_capture,sources,request_hash)values(rid,actor,op,tid,main_id,con_id,(s->>'expectedVersion')::integer+1,(s->>'priorRevisionId')::uuid,s->>'sourceDigest',s,sources,h);
 if app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,con_id)is distinct from true then raise exception'joint_expense_identity_changed';end if;
 r:=jsonb_build_object('kind','joint-expense-split-receipt-v3','status','joint_expense_split_reviewed_v3','actorId',actor,'tournamentId',tid,'eventId',main_id,'consolationEventId',con_id,'operationId',op,'request',request,'revisionId',rid,'version',(s->>'expectedVersion')::integer+1,'sourceDigest',s->'sourceDigest','historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false,'receiptOwnershipChanged',false);
 insert into app.joint_expense_split_outcomes_v3 values(actor,op,r);insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'joint_expense_split_v3',rid,'explicit_expense_partitions_reviewed',r||jsonb_build_object('sessionId',sid));return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function public.get_joint_expense_split_source_provider_v3(actor uuid,sid uuid,tid uuid,main_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.current_joint_expense_author_source_v3(actor,sid,tid,main_id)$$;
create function public.get_joint_expense_split_operation_provider_v3(actor uuid,sid uuid,tid uuid,main_id uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare o app.joint_expense_split_operations_v3%rowtype;r jsonb;begin
 if app.joint_expense_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true then return null;end if;
 select*into o from app.joint_expense_split_operations_v3 where actor_id=actor and operation_id=op;if not found then return coalesce(app.joint_expense_cancelled_reply_v3(actor,tid,main_id,op,request),jsonb_build_object('status','unknown','code','operation_not_found'));end if;
 if o.tournament_id<>tid or o.main_event_id<>main_id or o.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,o.consolation_event_id)is distinct from true then return null;end if;
 select result into r from app.joint_expense_split_outcomes_v3 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end$$;
-- Explicit resolution holds the same nonce+tournament barriers as the writer.
-- An accepted operation is recovered, never cancelled. An absent operation is
-- permanently tombstoned before the device may archive/clear its exact request.
create function public.resolve_joint_expense_split_provider_v3(actor uuid,sid uuid,tid uuid,main_id uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare r jsonb;con_id uuid;begin
 if app.joint_expense_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array['kind','expectedSourceDigest','expectedVersion','priorRevisionId','consolationEventId','splits','reviewed','reason'])is distinct from true or app.valid_playoff_prize_proposal_reason_v2(request->'reason')is distinct from true or request->>'kind'is distinct from'joint-expense-split-review-v3'or request->'reviewed'is distinct from'true'::jsonb or coalesce(request->>'consolationEventId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 con_id:=(request->>'consolationEventId')::uuid;if app.selected_step_final_access_v3(actor,sid,tid,con_id)is distinct from true or app.linked_consolation_main_event_v1(tid,con_id)is distinct from main_id then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('joint-expense-split:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 r:=public.get_joint_expense_split_operation_provider_v3(actor,sid,tid,main_id,op,request);if r->>'status'is distinct from'unknown'then return r;end if;
 r:=jsonb_build_object('kind','joint-expense-split-cancelled-v3','status','rejected','code','review_cancelled_uncommitted','actorId',actor,'tournamentId',tid,'eventId',main_id,'consolationEventId',con_id,'operationId',op,'request',request,'terminalConfirmed',true,'historicalReceipt',false,'currentSourceVerified',false,'moneyMoved',false);
 insert into app.joint_expense_split_cancellations_v3(actor_id,operation_id,tournament_id,main_event_id,consolation_event_id,session_id,request,result)values(actor,op,tid,main_id,con_id,sid,request,r);
 if app.selected_step_final_access_v3(actor,sid,tid,main_id)is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,con_id)is distinct from true then raise exception'joint_expense_cancel_identity_changed';end if;
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'joint_expense_split_v3',op,'uncommitted_review_cancelled',r||jsonb_build_object('sessionId',sid));return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Prefer this distinct journal once present. A stale/invalid latest review is
-- held, never washed out by falling back to an older native allocation.
do $prior$declare d text;begin d:=pg_get_functiondef('app.current_joint_expense_intent_v3(uuid,uuid,uuid,uuid)'::regprocedure);execute replace(d,'FUNCTION app.current_joint_expense_intent_v3(','FUNCTION app.joint_expense_intent_before_authoring_v3(');end$prior$;
create or replace function app.current_joint_expense_intent_v3(actor uuid,tid uuid,main_id uuid,con_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare h app.joint_expense_split_revisions_v3%rowtype;o app.joint_expense_split_operations_v3%rowtype;r jsonb;expenses jsonb;sources jsonb;main_costs jsonb;con_costs jsonb;b jsonb;begin
 if app.joint_event_expenses_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,main_id)is distinct from true or app.main_con_coexistence_context_v3(tid,main_id)is distinct from true or app.linked_consolation_main_event_v1(tid,con_id)is distinct from main_id then return null;end if;
 perform 1 from app.tournaments where id=tid for update nowait;perform app.lock_native_ledger_sources_v1();lock table app.joint_expense_split_revisions_v3,app.joint_expense_split_operations_v3,app.joint_expense_split_outcomes_v3 in share mode nowait;
 select*into h from app.joint_expense_split_revisions_v3 where tournament_id=tid and main_event_id=main_id and consolation_event_id=con_id order by version desc limit 1;
 if h.id is null then return app.joint_expense_intent_before_authoring_v3(actor,tid,main_id,con_id);end if;
 select*into o from app.joint_expense_split_operations_v3 where actor_id=h.actor_id and operation_id=h.operation_id;
 select result into r from app.joint_expense_split_outcomes_v3 where actor_id=h.actor_id and operation_id=h.operation_id;
 expenses:=app.joint_expense_physical_rows_v3(tid);sources:=app.build_joint_expense_split_rows_v3(expenses,o.request->'splits',main_id,con_id);
 if o.operation_id is null or o.tournament_id<>tid or o.main_event_id<>main_id or o.consolation_event_id<>con_id or o.request_hash<>h.request_hash or r->>'status'is distinct from'joint_expense_split_reviewed_v3'or r->>'revisionId'is distinct from h.id::text or r->'request'is distinct from o.request or sources is null or sources is distinct from h.sources then return jsonb_build_object('status','blocked','code','current_expense_split_review_required');end if;
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e->'expenseEventId','description',e->'description','amountMinor',p->'amountMinor','category',p->'bucket')order by e->>'expenseEventId'),'[]'::jsonb)into main_costs from jsonb_array_elements(expenses)e join jsonb_array_elements(sources)s on s->'sourceId'=e->'expenseEventId'cross join lateral jsonb_array_elements(s->'allocations')p where p->>'eventId'=main_id::text;
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e->'expenseEventId','description',e->'description','amountMinor',p->'amountMinor','category',p->'bucket')order by e->>'expenseEventId'),'[]'::jsonb)into con_costs from jsonb_array_elements(expenses)e join jsonb_array_elements(sources)s on s->'sourceId'=e->'expenseEventId'cross join lateral jsonb_array_elements(s->'allocations')p where p->>'eventId'=con_id::text;
 b:=jsonb_build_object('kind','current-joint-expense-intent-v3','status','source_available','reviewDomain','joint-expense-split-journal-v3','tournamentId',tid,'mainEventId',main_id,'consolationEventId',con_id,'expenseReviewRevision',to_jsonb(h),'expenseReviewOperation',to_jsonb(o),'expenseReviewOutcome',r,'sources',sources,'mainExpenses',main_costs,'consolationExpenses',con_costs,'receiptOwnershipClaimed',false,'moneyMoved',false);
 return b||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(b::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
do $security$declare t text;r record;begin
 foreach t in array array['joint_expense_split_operations_v3','joint_expense_split_revisions_v3','joint_expense_split_outcomes_v3','joint_expense_split_cancellations_v3']loop execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);end loop;
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and p.proname in('joint_expense_authoring_enabled_v3','joint_expense_physical_rows_v3','build_joint_expense_split_rows_v3','current_joint_expense_author_source_v3','guard_joint_expense_split_revision_v3','joint_expense_intent_before_authoring_v3','current_joint_expense_intent_v3','joint_expense_cancelled_reply_v3'))or(n.nspname='public'and p.proname in('record_joint_expense_split_provider_v3','get_joint_expense_split_source_provider_v3','get_joint_expense_split_operation_provider_v3','resolve_joint_expense_split_provider_v3'))loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;
end$security$;
commit;

