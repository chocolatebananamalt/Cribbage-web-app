-- PRIVATE / DEFAULT OFF. Actual modern award source and immutable UNPAID journal
-- with genuine V3 fund-review FK. No legacy review/allocation IDs manufactured.
-- Requires selected-step-final-review-v3 plus reviewed modern V2 arithmetic.
-- Zero-income only; unadapted first-round entry-fee evidence explicitly holds.
begin;
create function app.selected_step_awards_enabled_v3()returns boolean language sql stable set search_path=''as $gate$select false$gate$;

create table app.selected_step_award_operations_v3(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,request jsonb not null,request_hash text not null,
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('selected-step-award-request-v3',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex'))
);
create table app.selected_step_award_sets_v3(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 prize_revision_id uuid not null,fund_review_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 plan jsonb not null,rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),total_minor bigint not null check(total_minor>0 and total_minor<=9007199254740991),recipient_count integer not null check(recipient_count between 4 and 64),
 reason text not null,recorded_at timestamptz not null default clock_timestamp(),status text not null default'recorded_unpaid'check(status='recorded_unpaid'),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prize_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 foreign key(fund_review_id,tournament_id,event_id)references app.selected_step_fund_reviews_v3(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_award_operations_v3(actor_id,operation_id,tournament_id,event_id),
 check(source_capture->>'sourceDigest'=source_digest),check(source_capture->'plan'=plan),check((source_capture->>'roundingUnitMinor')::integer=rounding_unit_minor),check((source_capture->>'totalMinor')::bigint=total_minor)
);
create table app.selected_step_award_groups_v3(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,first_place integer not null,last_place integer not null,people integer not null,included boolean not null,
 per_person_minor bigint not null,group_total_minor bigint not null,rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 primary key(award_set_id,first_place),foreign key(award_set_id,tournament_id,event_id)references app.selected_step_award_sets_v3(id,tournament_id,event_id),
 check(first_place>=1 and last_place>=first_place and last_place<=64 and people=last_place-first_place+1),check((included and per_person_minor>0 and per_person_minor%rounding_unit_minor=0 and group_total_minor=per_person_minor*people)or(not included and per_person_minor=0 and group_total_minor=0))
);
create table app.selected_step_award_recipients_v3(
 award_set_id uuid not null,tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,profile_id uuid not null,display_name text not null,tournament_player_id text not null,
 first_place integer not null,last_place integer not null,included boolean not null,amount_minor bigint not null,rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 primary key(award_set_id,participant_id),foreign key(award_set_id,tournament_id,event_id)references app.selected_step_award_sets_v3(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check((included and amount_minor>0 and amount_minor%rounding_unit_minor=0)or(not included and amount_minor=0))
);
create table app.selected_step_award_outcomes_v3(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id,tournament_id,event_id)references app.selected_step_award_operations_v3(actor_id,operation_id,tournament_id,event_id)
);
do $security$declare t text;begin foreach t in array array['selected_step_award_operations_v3','selected_step_award_sets_v3','selected_step_award_groups_v3','selected_step_award_recipients_v3','selected_step_award_outcomes_v3']loop
 execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);
end loop;end$security$;


do $clone$declare original regprocedure:='app.current_modern_prize_award_source_v2(uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern award prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[[" f:=app.current_native_prize_fund_v2(tid,eid);if f->>''status''=''retry_exact''then return f;end if;if f->>''status''is distinct from''source_available''then return f;end if;\n w:=app.get_playoff_prize_proposal_workspace_v2(tid,eid);\n if w->>''kind''is distinct from''playoff-prize-proposal-workspace-v2''or w->''stale''is distinct from''false''::jsonb or w->''head''=''null''::jsonb then return jsonb_build_object(''status'',''blocked'',''code'',''current_prize_proposal_required'');end if;\n head:=w->''head'';c:=f->''capture'';n:=c->''recipientSource'';raw:=n#>''{nativeFinanceSource,raw}'';input:=w#>''{nativeSource,capture,input}'';b:=w#>''{nativeSource,capture}'';\n if b->''bindingId''is distinct from raw#>''{binding,bindingId}''or b->''activationId''is distinct from raw#>''{binding,activationId}''or b->''setupEventVersionId''is distinct from raw#>''{binding,setupEventVersionId}''or b->''contextReviewId''is distinct from raw#>''{binding,reviewId}''\n  or input#>''{binding,settingsSnapshotId}''is distinct from raw#>''{binding,settingsSnapshotId}''or input#>''{binding,eventKind}''is distinct from raw#>''{event,eventKind}''\n  or input#>''{ledger,allocationRevisionId}''is distinct from raw#>''{allocation,revisionId}''or input#>''{ledger,current,sourceVersion}''is distinct from raw#>''{allocation,version}''or input#>''{ledger,current,sourceDigest}''is distinct from raw#>''{allocation,sourceDigest}''\n  or input#>''{qualification,currentResultVersionId}''is distinct from n#>''{proposal,qualificationResultVersionId}''then return jsonb_build_object(''status'',''blocked'',''code'',''prize_fund_binding_changed'');end if;\n if(select jsonb_agg(x order by x::text)from jsonb_array_elements(input#>''{ledger,current,sources}'')x)is distinct from(select jsonb_agg(x order by x::text)from jsonb_array_elements(raw#>''{allocation,eventSources}'')x)\n  or(select jsonb_agg(jsonb_build_array(x->''participantId'',x->''qualificationRank'')order by x->>''participantId'')from jsonb_array_elements(input#>''{qualification,result,qualifiers}'')x)is distinct from(select jsonb_agg(jsonb_build_array(x->''participantId'',x->''seed'')order by x->>''participantId'')from jsonb_array_elements(n#>''{playoff,players}'')x)then return jsonb_build_object(''status'',''blocked'',''code'',''prize_fund_evidence_changed'');end if;\n -- Current fund capture already proves full income lineage and reviewed heads.\n -- Compare allocation-only baseline + separately recorded income exactly once.\n if (select coalesce(sum(case income_parts.value->>''bucket''when''regular_entry''then(income_parts.value->>''amountMinor'')::numeric when''player_benefit''then-(income_parts.value->>''amountMinor'')::numeric when''operating_expense''then-(income_parts.value->>''amountMinor'')::numeric else 0 end),0)\n from jsonb_array_elements(input#>''{ledger,current,sources}'')income_sources(value) cross join lateral jsonb_array_elements(income_sources.value->''allocations'')income_parts(value)\n where income_sources.value->>''state''=''active''and income_parts.value->>''eventId''=eid::text)+(c#>>''{income,activeMinor}'')::numeric\n is distinct from(c#>>''{totals,recordedFundMinor}'')::numeric then return jsonb_build_object(''status'',''blocked'',''code'',''latest_income_or_fund_coverage_unsupported'');end if;\n"," if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n f:=app.current_selected_step_fund_v3(actor,sid,tid,eid);if f->>''status''=''retry_exact''then return f;end if;\n if f is null or f->>''status''is distinct from''source_available''or f->>''kind''is distinct from''current-selected-step-fund-v3''or f->''recordedFundComplete''is distinct from''true''::jsonb then return jsonb_build_object(''status'',''blocked'',''code'',''current_modern_fund_required'');end if;\n c:=f->''capture'';w:=c->''prizeWorkspace'';n:=c->''sportingSource'';input:=w#>''{nativeSource,capture,input}'';head:=w->''head'';\n if c->>''kind''is distinct from''selected-step-final-review-source-v3''or c->>''actorId''is distinct from actor::text or c->>''tournamentId''is distinct from tid::text or c->>''eventId''is distinct from eid::text\n  or input#>''{ledger,current}''is distinct from c#>''{ownershipLedger,ledger}''or input#>''{ledger,allocationRevisionId}''is distinct from c#>''{ownershipLedger,ownershipRevisionId}''\n  or input#>''{qualification,currentResultVersionId}''is distinct from n#>''{qualification,resultVersionId}''or w->''stale''is distinct from''false''::jsonb\n  or jsonb_typeof(head)is distinct from''object''or head->''input''is distinct from input or head->''sourceCapture''is distinct from w->''nativeSource''\n  or c#>''{income,activeMinor}''is distinct from''0''::jsonb or c#>''{income,records}''is distinct from''[]''::jsonb\n then return jsonb_build_object(''status'',''blocked'',''code'',''modern_award_source_binding_changed'');end if;\n",1],[" if first_round_paid then\n  fee_source:=app.get_current_common_entry_fee_source_v1(tid,eid);\n  if fee_source->>''status''=''retry_exact''then return fee_source;end if;\n  if fee_source->>''kind''is distinct from''current-common-entry-fee-source-v1''or fee_source->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''blocked'',''code'',''verified_entry_fee_reference_required'');end if;\n  if fee_source->''fundSource''is distinct from f then return jsonb_build_object(''status'',''blocked'',''code'',''entry_fee_source_changed'');end if;\n  fee:=(fee_source#>>''{evidence,advertisedFeeMinor}'')::numeric;fee_choice:=draft->>''firstRoundComparison'';\n  if fee_choice is null or fee_choice not in(''less'',''equal'',''more'')then return jsonb_build_object(''status'',''blocked'',''code'',''first_round_intention_review_required'');end if;\n  if fee_choice=''equal''and mod(fee,unit)<>0 then return jsonb_build_object(''status'',''blocked'',''code'',''entry_fee_rounding_incompatible'');end if;\n end if;\n"," if first_round_paid then return jsonb_build_object(''status'',''blocked'',''code'',''modern_entry_fee_reference_adapter_required'');end if;\n",1],["(c#>>''{totals,recordedFundMinor}'')","(c#>>''{totals,regularAllocationFundMinor}'')",1],["''actorId'',auth.uid()","''actorId'',actor",1],["modern-prize-award-source-v2","selected-step-award-source-v3",2]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern V3 award source anchor changed: %: %','app.current_selected_step_award_source_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.current_selected_step_award_source_v3(actor uuid, sid uuid, tid uuid, eid uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.current_selected_step_award_source_v3(actor uuid, sid uuid, tid uuid, eid uuid)owner to postgres';
 execute 'revoke all on function app.current_selected_step_award_source_v3(actor uuid, sid uuid, tid uuid, eid uuid)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern award prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare actor uuid:=auth.uid();","declare ",1],["begin\n if","begin\n if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["app.modern_prize_awards_enabled_v2()","app.selected_step_awards_enabled_v3()",1],["app.current_modern_prize_award_source_v2(tid,eid)","app.current_selected_step_award_source_v3(actor,sid,tid,eid)",1],["s#>''{fundSource,capture,latestReview,reviewId}''","s#>''{fundSource,reviewId}''",1],["unit:=(s->>''roundingUnitMinor'')::integer;","unit:=(s->>''roundingUnitMinor'')::integer; if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;",1],["modern_prize_award_operations_v2","selected_step_award_operations_v3",3],["modern_prize_award_sets_v2","selected_step_award_sets_v3",2],["modern_prize_award_groups_v2","selected_step_award_groups_v3",4],["modern_prize_award_recipients_v2","selected_step_award_recipients_v3",4],["modern_prize_award_outcomes_v2","selected_step_award_outcomes_v3",2],["modern-prize-award-request-v2","selected-step-award-request-v3",1],["modern-prize-award-receipt-v2","selected-step-award-receipt-v3",1],["modern_prize_awards_v2","selected_step_awards_v3",1],["''recorded_unpaid'',response);","''recorded_unpaid'',response||jsonb_build_object(''sessionId'',sid));",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern V3 award source anchor changed: %: %','app.record_selected_step_awards_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.record_selected_step_awards_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, request jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.record_selected_step_awards_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, request jsonb)owner to postgres';
 execute 'revoke all on function app.record_selected_step_awards_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, request jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.get_modern_prize_award_record_v2(uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern award prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n if","begin\n if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["app.modern_prize_awards_enabled_v2()","app.selected_step_awards_enabled_v3()",1],["modern_prize_award_sets_v2","selected_step_award_sets_v3",2],["modern_prize_award_groups_v2","selected_step_award_groups_v3",1],["modern_prize_award_recipients_v2","selected_step_award_recipients_v3",1],["modern-prize-award-record-v2","selected-step-award-record-v3",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern V3 award source anchor changed: %: %','app.get_selected_step_award_record_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.get_selected_step_award_record_v3(actor uuid, sid uuid, tid uuid, eid uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.get_selected_step_award_record_v3(actor uuid, sid uuid, tid uuid, eid uuid)owner to postgres';
 execute 'revoke all on function app.get_selected_step_award_record_v3(actor uuid, sid uuid, tid uuid, eid uuid)from public,anon,authenticated,service_role';
end$clone$;

-- Reciprocal ordinary-regular liability exclusion, independent of feature
-- enablement. Standalone V3 Q/Side liabilities are deliberately NOT regular
-- awards and can coexist; their existing pool-only ownership guards survive.
create function app.guard_selected_step_awards_v3()returns trigger
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'selected_step_award_isolation_unsupported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='selected_step_award_sets_v3'then
  if app.legacy_financial_liability_exists_v1(new.tournament_id,new.event_id)is distinct from false
   or exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)
   or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=new.tournament_id and event_id=new.event_id)
   or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=new.tournament_id and event_id=new.event_id)
  then raise exception'selected_step_existing_regular_liability';end if;
 elsif tg_table_name in('multi_event_joint_finals_v1','multi_event_unpaid_finals_v1')then
  if exists(select 1 from app.selected_step_award_sets_v3 where tournament_id=new.tournament_id)then raise exception'selected_step_existing_regular_liability';end if;
 elsif exists(select 1 from app.selected_step_award_sets_v3 where tournament_id=new.tournament_id and event_id=new.event_id)
 then raise exception'selected_step_regular_source_finalized';end if;
 return new;
end$body$;
do $guards$declare t text;begin foreach t in array array[
 'selected_step_award_sets_v3','modern_prize_award_sets_v2','native_playoff_final_award_sets_v1','native_optional_final_award_sets_v2',
 'standard_singles_settlement_final_versions','event_settlement_finals_v2','q_accounting_finals_v6','no_q_accounting_finals_v7',
 'prize_accounting_finals_v8','prize_accounting_finals_v9','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1',
 'native_recorded_fund_reviews_v1','native_optional_fund_reviews_v2','operational_event_finance_revisions_v1','native_optional_finance_revisions_v2',
 'native_unrestricted_income_records_v1','native_optional_income_records_v2','playoff_prize_proposal_revisions_v2',
 'selected_step_fund_reviews_v3','selected_step_pool_ownership_revisions_v3','playoff_series_generations_v1'
 ]loop execute format('create trigger zz_selected_step_award_guard_v3 before insert on app.%I for each row execute function app.guard_selected_step_awards_v3()',t);end loop;end$guards$;
alter function app.selected_step_awards_enabled_v3()owner to postgres;
alter function app.guard_selected_step_awards_v3()owner to postgres;
revoke all on function app.selected_step_awards_enabled_v3(),app.guard_selected_step_awards_v3()from public,anon,authenticated,service_role;
commit;
