-- PRIVATE / DEFAULT OFF. Exact SAVED Main/Consolation expense partitions only.
-- No chosen ratio, extra deduction, legacy reuse permission or allocation write.
begin;
create function app.selected_step_shared_sanctioning_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.current_consolation_shared_expense_v3(tid uuid,eid uuid,owned jsonb,expense uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare live jsonb;item jsonb;part jsonb;main_id uuid;total numeric:=0;mine numeric:=0;main_share numeric:=0;amount numeric;seen text[]:='{}';k text;begin
 if app.selected_step_shared_sanctioning_enabled_v3()is distinct from true or app.selected_step_consolation_enabled_v3()is distinct from true or coalesce(owned->>'actorId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 live:=app.consolation_regular_ledger_v3((owned->>'actorId')::uuid,tid,eid);
 if live->>'status'is distinct from'source_available'or live is distinct from owned then return null;end if;
 main_id:=app.linked_consolation_main_event_v1(tid,eid);if main_id is null then return null;end if;
 select value into item from jsonb_array_elements(owned#>'{ledger,sources}')where value->>'sourceId'=expense::text and value->>'kind'='expense'and value->>'state'='active';
 if item is null or not exists(select 1 from app.tournament_expense_events x where x.id=expense and x.tournament_id=tid and x.event_type='recorded'and x.amount_minor::numeric=(item->>'amountMinor')::numeric and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=x.expense_id and newer.version>x.version))then return null;end if;
 -- The whole physical row and every partition must come from the same current,
 -- accepted allocation journal already pinned by genuine Con ownership.
 if not exists(select 1 from jsonb_array_elements(owned#>'{capture,ownershipSource,capture,nativeAllocation,snapshot,sources}')x where x=item)then return null;end if;
 for part in select value from jsonb_array_elements(item->'allocations')loop
  k:=(part->>'eventId')||':'||(part->>'bucket');amount:=(part->>'amountMinor')::numeric;
  if part->>'eventId'not in(eid::text,main_id::text)or part->>'bucket'not in('player_benefit','operating_expense')or part->'poolId'is distinct from'null'::jsonb or part->'classificationReviewed'is distinct from'true'::jsonb or amount<=0 or amount<>trunc(amount)or amount>9007199254740991 or k=any(seen)then return null;end if;
  seen:=array_append(seen,k);total:=total+amount;if part->>'eventId'=eid::text then mine:=mine+amount;else main_share:=main_share+amount;end if;
 end loop;
 if total is distinct from(item->>'amountMinor')::numeric or total>9007199254740991 or mine<=0 or main_share<=0 then return null;end if;
 return jsonb_build_object('kind','current-saved-shared-sanction-expense-v3','status','source_available','eventId',eid,'mainEventId',main_id,'expenseId',expense,'source',item,'allocatedMinor',mine,'mainAllocatedMinor',main_share,'physicalMinor',total,'deductAgain',false);
exception when invalid_text_representation or numeric_value_out_of_range then return null;end$$;
create function app.shared_sanctioning_reviews_compatible_v3(tid uuid,eid uuid,owned jsonb,other_eid uuid,other_owned jsonb,expense uuid)returns boolean language plpgsql security definer set search_path=''as $$
declare proof jsonb;item jsonb;other_item jsonb;assessment numeric;other_assessment numeric;begin
 if app.selected_step_shared_sanctioning_enabled_v3()is distinct from true or eid=other_eid then return false;end if;
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then
  proof:=app.current_consolation_shared_expense_v3(tid,eid,owned,expense);if proof->>'mainEventId'is distinct from other_eid::text then return false;end if;
 else
  proof:=app.current_consolation_shared_expense_v3(tid,other_eid,other_owned,expense);if proof->>'mainEventId'is distinct from eid::text then return false;end if;
 end if;
 if proof->>'status'is distinct from'source_available'then return false;end if;
 select value into item from jsonb_array_elements(owned#>'{ledger,sources}')where value->>'sourceId'=expense::text;
 select value into other_item from jsonb_array_elements(other_owned#>'{ledger,sources}')where value->>'sourceId'=expense::text;
 if item is distinct from proof->'source'or other_item is distinct from item or owned->>'tournamentId'is distinct from tid::text or owned->>'eventId'is distinct from eid::text or other_owned->>'tournamentId'is distinct from tid::text or other_owned->>'eventId'is distinct from other_eid::text then return false;end if;
 select total_cents into assessment from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=eid;
 select total_cents into other_assessment from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=other_eid;
 return assessment is not null and other_assessment is not null
  and(select sum((p->>'amountMinor')::numeric)from jsonb_array_elements(item->'allocations')p where p->>'eventId'=eid::text)>=assessment
  and(select sum((p->>'amountMinor')::numeric)from jsonb_array_elements(item->'allocations')p where p->>'eventId'=other_eid::text)>=other_assessment;
end$$;
-- Extend only the whole-expense test and V3-vs-V3 reuse exception. All original
-- assessment/Start/latest-expense/legacy reuse checks remain in the real body.
do $coverage$declare d text;old text;replacement text;begin
 select pg_get_functiondef('app.selected_step_sanctioning_coverage_v3(uuid,uuid,jsonb,uuid)'::regprocedure)into d;
 old:='or amount is distinct from(item->>''amountMinor'')::numeric';replacement:='or(amount is distinct from(item->>''amountMinor'')::numeric and app.current_consolation_shared_expense_v3(tid,eid,owned,selected_step_sanctioning_coverage_v3.expense_id)->>''status''is distinct from''source_available'')';
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'shared_sanction_whole_expense_anchor_changed';end if;d:=replace(d,old,replacement);
 old:='exists(select 1 from app.selected_step_fund_reviews_v3 where tournament_id=tid and event_id<>eid and sanctioning_expense_event_id=selected_step_sanctioning_coverage_v3.expense_id)';
 replacement:='exists(select 1 from app.selected_step_fund_reviews_v3 other where other.tournament_id=tid and other.event_id<>eid and other.sanctioning_expense_event_id=selected_step_sanctioning_coverage_v3.expense_id and app.shared_sanctioning_reviews_compatible_v3(tid,eid,owned,other.event_id,other.source_capture->''ownershipLedger'',selected_step_sanctioning_coverage_v3.expense_id)is distinct from true)';
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'shared_sanction_review_anchor_changed';end if;d:=replace(d,old,replacement);execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$coverage$;
do $guard$declare d text;old text;replacement text;begin
 select pg_get_functiondef('app.guard_selected_step_sanction_reuse_v3()'::regprocedure)into d;
 old:='declare expense_id uuid;';if strpos(d,old)=0 then raise exception'shared_sanction_guard_declaration_changed';end if;d:=replace(d,old,'declare expense_id uuid;incoming_owned jsonb;');
 old:='if expense_id is null then return new;end if;';if strpos(d,old)=0 then raise exception'shared_sanction_guard_body_changed';end if;d:=replace(d,old,old||' if tg_table_name=''selected_step_fund_reviews_v3''then incoming_owned:=new.source_capture->''ownershipLedger'';end if;');
 old:='exists(select 1 from app.selected_step_fund_reviews_v3 where tournament_id=new.tournament_id and event_id<>new.event_id and sanctioning_expense_event_id=expense_id)';
 replacement:='exists(select 1 from app.selected_step_fund_reviews_v3 other where other.tournament_id=new.tournament_id and other.event_id<>new.event_id and other.sanctioning_expense_event_id=expense_id and(incoming_owned is null or app.shared_sanctioning_reviews_compatible_v3(new.tournament_id,new.event_id,incoming_owned,other.event_id,other.source_capture->''ownershipLedger'',expense_id)is distinct from true))';
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'shared_sanction_guard_reuse_anchor_changed';end if;d:=replace(d,old,replacement);execute replace(d,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$guard$;
do $secure$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and p.proname in('selected_step_shared_sanctioning_enabled_v3','current_consolation_shared_expense_v3','shared_sanctioning_reviews_compatible_v3')loop execute format('alter function %s owner to postgres',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;end$secure$;
commit;
