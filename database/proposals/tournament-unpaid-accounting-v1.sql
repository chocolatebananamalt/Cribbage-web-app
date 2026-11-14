-- LOCAL/default off. Accounting approval only; no tournament lifecycle update.
-- Requires current modern Main closure and, if present, regular-only Con4 closure.
begin;
create function app.tournament_unpaid_accounting_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.tournament_unpaid_accounting_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null references app.tournaments(id),session_id uuid not null,
 request jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id));
create table app.tournament_unpaid_accounting_snapshots_v1(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id),version integer not null check(version>0),supersedes_id uuid,
 actor_id uuid not null,operation_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,approved_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,version),unique(id,tournament_id),unique(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id)references app.tournament_unpaid_accounting_operations_v1(actor_id,operation_id,tournament_id),
 foreign key(supersedes_id,tournament_id)references app.tournament_unpaid_accounting_snapshots_v1(id,tournament_id),check(source_capture->>'sourceDigest'=source_digest));
create function app.tournament_unpaid_accounting_access_v1(actor uuid,sid uuid,tid uuid)returns boolean language plpgsql security definer set search_path=''as $$declare eid uuid;begin
 if app.tournament_unpaid_accounting_enabled_v1()is distinct from true then return false;end if;
 select id into eid from app.events where tournament_id=tid and event_type='main'order by id limit 1;
 return eid is not null and app.selected_step_final_access_v3(actor,sid,tid,eid)is true;
end$$;
create function app.current_tournament_unpaid_accounting_source_v1(actor uuid,sid uuid,tid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare ev record;w jsonb;l jsonb;f jsonb;s jsonb;p jsonb;prior jsonb;physical jsonb:='{}';events jsonb:='[]';inventory jsonb;ids text[];cost numeric:=0;gross numeric:=0;regular numeric:=0;q numeric:=0;side numeric:=0;allocated numeric;h jsonb;begin
 if app.tournament_unpaid_accounting_access_v1(actor,sid,tid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','held','code','isolation_unsupported');end if;
 perform 1 from app.tournaments where id=tid and status<>'archived'for update nowait;if not found then return jsonb_build_object('status','held','code','tournament_unavailable');end if;
 -- Prevent event insertion/removal while the exact event roster is captured.
 lock table app.events in share mode nowait;
 select jsonb_agg(to_jsonb(e)order by e.id),array_agg(e.id::text order by e.id)into inventory,ids from app.events e where e.tournament_id=tid;
 if (select count(*)from app.events where tournament_id=tid and event_type='main')<>1 then return jsonb_build_object('status','held','code','one_main_event_required');end if;
 for ev in select*from app.events where tournament_id=tid order by id loop
  if ev.event_type not in('main','consolation')or ev.format<>'standard_singles'or ev.operational_state<>'active'then return jsonb_build_object('status','held','code','unsupported_event_accounting','eventId',ev.id);end if;
  if ev.event_type='main'then w:=app.current_modern_event_closure_v1(actor,sid,tid,ev.id);
  else w:=app.current_regular_consolation_closure_v1(actor,sid,tid,ev.id);end if;
  if w->>'status'is distinct from'recorded'or w->'currentSourceVerified'is distinct from'true'::jsonb or w->>'closeState'is distinct from'closed'or w#>>'{readiness,unresolvedGames}'is distinct from'0'
   then return jsonb_build_object('status','held','code','current_event_closure_required','eventId',ev.id);end if;
  l:=app.selected_step_regular_ledger_v3(actor,tid,ev.id);f:=app.current_selected_step_fund_v3(actor,sid,tid,ev.id);
  if l->>'status'is distinct from'source_available'or l#>'{ledger,complete}'is distinct from'true'::jsonb or f->'recordedFundComplete'is distinct from'true'::jsonb
   or f->>'reviewId'is distinct from w#>>'{source,fundReviewId}'or f#>'{capture,ownershipLedger}'is distinct from l
   or l->>'ownershipRevisionId'is distinct from w#>>'{source,ownershipRevisionId}'then return jsonb_build_object('status','held','code','current_event_fund_required','eventId',ev.id);end if;
  if f#>'{capture,income,activeMinor}'is distinct from'0'::jsonb or f#>'{capture,income,records}'is distinct from'[]'::jsonb then return jsonb_build_object('status','held','code','income_accounting_unsupported','eventId',ev.id);end if;
  if (w#>>'{source,regularMinor}')::numeric<>(l#>>'{funds,regularAllocationFundMinor}')::numeric or(w#>>'{source,qMinor}')::numeric<>(l#>>'{funds,qReceiptsMinor}')::numeric or(w#>>'{source,sideMinor}')::numeric<>(l#>>'{funds,sideReceiptsMinor}')::numeric then return jsonb_build_object('status','held','code','event_awards_not_reconciled','eventId',ev.id);end if;
  regular:=regular+(w#>>'{source,regularMinor}')::numeric;q:=q+(w#>>'{source,qMinor}')::numeric;side:=side+(w#>>'{source,sideMinor}')::numeric;
  events:=events||jsonb_build_array(jsonb_build_object('eventId',ev.id,'name',ev.name,'eventType',ev.event_type,'closureId',w->'closureId','snapshotId',w->'snapshotId','sourceDigest',w#>'{source,sourceDigest}','qualificationId',w#>'{source,qualificationId}','ownershipRevisionId',w#>'{source,ownershipRevisionId}','fundReviewId',w#>'{source,fundReviewId}','regularAwardSetId',w#>'{source,regularAwardSetId}','poolFinalId',w#>'{source,poolFinalId}','regularMinor',w#>'{source,regularMinor}','qMinor',w#>'{source,qMinor}','sideMinor',w#>'{source,sideMinor}'));
  for s in select value from jsonb_array_elements(l#>'{ledger,sources}')loop
   if s->>'sourceId'is null or s->>'sourceId'is distinct from s->>'physicalEvidenceId'or s->>'state'is distinct from'active'or s->>'kind'not in('entry_receipt','expense')then return jsonb_build_object('status','held','code','unsupported_physical_source');end if;
   prior:=physical->(s->>'sourceId');if prior is not null and prior is distinct from s then return jsonb_build_object('status','held','code','physical_source_partition_conflict');end if;
   physical:=jsonb_set(physical,array[s->>'sourceId'],s,true);
  end loop;
 end loop;
 for s in select value from jsonb_each(physical)loop
  allocated:=0;
  for p in select value from jsonb_array_elements(s->'allocations')loop
   if not(p->>'eventId'=any(ids))or p->'classificationReviewed'is distinct from'true'::jsonb or coalesce(p->>'amountMinor','')!~'^(0|[1-9][0-9]*)$'
    or(s->>'kind'='entry_receipt'and p->>'bucket'not in('regular_entry','q','side'))or(s->>'kind'='expense'and p->>'bucket'not in('player_benefit','operating_expense'))then return jsonb_build_object('status','held','code','unsupported_physical_allocation');end if;
   allocated:=allocated+(p->>'amountMinor')::numeric;
  end loop;
  if coalesce(s->>'amountMinor','')!~'^(0|[1-9][0-9]*)$'or allocated<>(s->>'amountMinor')::numeric then return jsonb_build_object('status','held','code','physical_source_not_conserved');end if;
  if s->>'kind'='expense'then cost:=cost+allocated;else gross:=gross+allocated;end if;
 end loop;
 if gross<>regular+q+side+cost or gross>9007199254740991 then return jsonb_build_object('status','held','code','tournament_funds_not_conserved');end if;
 h:=jsonb_build_object('kind','tournament-unpaid-accounting-source-v1','actorId',actor,'tournamentId',tid,'eventInventory',inventory,'events',events,'physicalSources',physical,'totals',jsonb_build_object('receiptsMinor',gross,'costMinor',cost,'regularMinor',regular,'qMinor',q,'sideMinor',side),'moneyMoved',false,'officialMrpAwarded',false,'accSubmissionPerformed',false,'lifecycleChanged',false,'registrationOverridesBlocking',false);
 if app.tournament_unpaid_accounting_access_v1(actor,sid,tid)is distinct from true then return null;end if;
 return h||jsonb_build_object('status','source_available','sourceDigest',encode(extensions.digest(convert_to(h::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','held','code','source_busy');when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','held','code','source_shape_invalid');end$$;
create function public.get_tournament_unpaid_accounting_v1(actor uuid,sid uuid,tid uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare s jsonb;v app.tournament_unpaid_accounting_snapshots_v1%rowtype;begin
 if app.tournament_unpaid_accounting_access_v1(actor,sid,tid)is distinct from true then return null;end if;
 s:=app.current_tournament_unpaid_accounting_source_v1(actor,sid,tid);select*into v from app.tournament_unpaid_accounting_snapshots_v1 where tournament_id=tid order by version desc limit 1;
 return jsonb_build_object('kind','tournament-unpaid-accounting-view-v1','actorId',actor,'tournamentId',tid,'status',case when s->>'status'is distinct from'source_available'then'held'when v.id is not null and v.source_capture=s then'approved'else'review'end,'code',s->'code','expectedVersion',coalesce(v.version,0),'sourceDigest',s->'sourceDigest','events',s->'events','totals',s->'totals','snapshotId',v.id,'approvedAt',v.approved_at,'stale',v.id is not null and v.source_capture is distinct from s,'moneyMoved',false,'officialMrpAwarded',false,'lifecycleChanged',false);
end$$;
create function public.get_tournament_unpaid_accounting_operation_v1(actor uuid,sid uuid,tid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare p app.tournament_unpaid_accounting_operations_v1%rowtype;begin
 if app.tournament_unpaid_accounting_access_v1(actor,sid,tid)is distinct from true then return null;end if;
 select*into p from app.tournament_unpaid_accounting_operations_v1 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','operation_not_found','operationId',op);end if;
 if p.tournament_id<>tid or p.request is distinct from request then return jsonb_build_object('status','unknown','code','operation_conflict','operationId',op);end if;return p.result;
end$$;
create function public.approve_tournament_unpaid_accounting_v1(actor uuid,sid uuid,tid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare s jsonb;v app.tournament_unpaid_accounting_snapshots_v1%rowtype;p app.tournament_unpaid_accounting_operations_v1%rowtype;result jsonb;new_id uuid:=extensions.gen_random_uuid();rejection text;begin
 if app.tournament_unpaid_accounting_access_v1(actor,sid,tid)is distinct from true then return null;end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array['kind','expectedSourceDigest','expectedVersion','approved','reason'])is distinct from true or request->>'kind'is distinct from'tournament-unpaid-accounting-approve-v1'or request->'approved'is distinct from'true'::jsonb or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]*)$'or app.valid_playoff_prize_proposal_reason_v2(request->'reason')is distinct from true then return jsonb_build_object('status','unknown','code','invalid_request','operationId',op);end if;
 if not pg_try_advisory_xact_lock(hashtextextended('tournament-accounting:'||actor||':'||op,0))then return jsonb_build_object('status','unknown','code','source_busy','operationId',op);end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into p from app.tournament_unpaid_accounting_operations_v1 where actor_id=actor and operation_id=op;
 if found then if p.tournament_id=tid and p.request=request then return p.result;end if;return jsonb_build_object('status','unknown','code','operation_conflict','operationId',op);end if;
 s:=app.current_tournament_unpaid_accounting_source_v1(actor,sid,tid);select*into v from app.tournament_unpaid_accounting_snapshots_v1 where tournament_id=tid order by version desc limit 1;
 if s->>'status'is distinct from'source_available'then rejection:='current_event_evidence_required';elsif coalesce(v.version,0)::numeric<>(request->>'expectedVersion')::numeric or s->>'sourceDigest'is distinct from request->>'expectedSourceDigest'then rejection:='review_source_changed';end if;
 if app.tournament_unpaid_accounting_access_v1(actor,sid,tid)is distinct from true then return null;end if;
 result:=jsonb_build_object('kind','tournament-unpaid-accounting-receipt-v1','actorId',actor,'tournamentId',tid,'operationId',op,'request',request,'status',case when rejection is null then'accepted'else'rejected'end,'code',coalesce(rejection,'unpaid_accounting_approved'),'snapshotId',case when rejection is null then new_id else null end,'historicalReceipt',true,'terminal',true,'currentSourceVerified',false,'moneyMoved',false,'officialMrpAwarded',false,'lifecycleChanged',false);
 insert into app.tournament_unpaid_accounting_operations_v1(actor_id,operation_id,tournament_id,session_id,request,result)values(actor,op,tid,sid,request,result);
 if rejection is null then insert into app.tournament_unpaid_accounting_snapshots_v1(id,tournament_id,version,supersedes_id,actor_id,operation_id,source_digest,source_capture)values(new_id,tid,coalesce(v.version,0)+1,v.id,actor,op,s->>'sourceDigest',s);end if;
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'tournament_unpaid_accounting_v1',case when rejection is null then new_id else tid end,case when rejection is null then'approved_unpaid_accounting'else'accounting_approval_rejected'end,result||jsonb_build_object('sessionId',sid));return result;
exception when lock_not_available then return jsonb_build_object('status','unknown','code','source_busy','operationId',op);end$$;
do $secure$declare n text;r record;begin
 foreach n in array array['tournament_unpaid_accounting_operations_v1','tournament_unpaid_accounting_snapshots_v1']loop execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);end loop;
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in('tournament_unpaid_accounting_enabled_v1','tournament_unpaid_accounting_access_v1','current_tournament_unpaid_accounting_source_v1','get_tournament_unpaid_accounting_v1','get_tournament_unpaid_accounting_operation_v1','approve_tournament_unpaid_accounting_v1')and n.nspname in('app','public')loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;
end$secure$;
-- No hosted grant or enablement is supplied. Reviewed service grants are a later release step.
commit;
