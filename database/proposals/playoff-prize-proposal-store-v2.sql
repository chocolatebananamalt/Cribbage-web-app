-- PRIVATE SOURCE CANDIDATE ONLY. Not a migration, grant, release or award writer.
-- Depends on playoff-prize-native-source-v2.sql and its full prerequisites.
-- Uses its unchanged current-role/native-source locks. All three store gates
-- and the independent native-source gate remain false. No existing guard changes.
-- Operation UUID namespace: actor+operation is global across this store's events
-- and tournaments. Generate a fresh UUID for this domain. Existing journals are
-- neither written nor aliased; reciprocal cross-domain UUID exclusion is NOT
-- claimed and would require a separately reviewed coordinated source change.
begin;
create table app.playoff_prize_proposal_operations_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 request_text text not null,request_hash text not null,request_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 check(octet_length(request_text)<=1000000),
 check(request_hash=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex')),
 check(request_payload=request_text::jsonb),
 check(request_payload->>'operationId'=operation_id::text)
);
create table app.playoff_prize_proposal_revisions_v2(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,version bigint not null,
 prior_revision_id uuid,actor_id uuid not null,operation_id uuid not null,
 native_source_digest text not null,source_capture jsonb not null,source_input jsonb not null,override_history jsonb not null,
 mode text not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 unique(id,tournament_id,event_id),unique(tournament_id,event_id,version),unique(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.playoff_prize_proposal_operations_v2(actor_id,operation_id,tournament_id,event_id),
 foreign key(prior_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 check(version between 1 and 9007199254740991),check(native_source_digest~'^[a-f0-9]{64}$'),
 check(mode in('append','adopt-current')),check(jsonb_typeof(override_history)='array'),
 check((source_capture->>'status'='source_available'and source_capture->>'actorId'=actor_id::text
  and source_capture->>'tournamentId'=tournament_id::text and source_capture->>'eventId'=event_id::text
  and source_capture->>'sourceDigest'=native_source_digest and source_capture#>'{capture,input}'=source_input)is true)
);
create table app.playoff_prize_proposal_heads_v2(
 tournament_id uuid not null,event_id uuid not null,revision_id uuid not null,
 primary key(tournament_id,event_id),
 foreign key(revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id)
);
create table app.playoff_prize_proposal_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id)references app.playoff_prize_proposal_operations_v2(actor_id,operation_id),
 check(octet_length(result::text)<=8000000),check(result->>'status'in('saved','rejected'))
);
do $tables$declare n text;begin
 foreach n in array array['playoff_prize_proposal_operations_v2','playoff_prize_proposal_revisions_v2','playoff_prize_proposal_heads_v2','playoff_prize_proposal_outcomes_v2']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  if n<>'playoff_prize_proposal_heads_v2'then
   execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
  end if;
 end loop;
end$tables$;

create function app.playoff_prize_proposal_read_enabled_v2()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.playoff_prize_proposal_write_enabled_v2()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.playoff_prize_proposal_recovery_enabled_v2()returns boolean language sql immutable set search_path=''as $$select false$$;

-- Check the original JSON before jsonb normalizes -0. Otherwise a direct raw
-- request could create an immutable receipt rejected by the JS safe decoder.
create function app.playoff_prize_proposal_json_safe_v2(v json,depth integer)returns boolean
language plpgsql immutable set search_path=''as $$
declare item json;raw text;n numeric;duplicate_keys boolean;
begin
 if depth>32 then return false;end if;
 case json_typeof(v)
 when'number'then
  raw:=v::text;n:=raw::numeric;
  return n=trunc(n)and n between -9007199254740991 and 9007199254740991 and not(n=0 and raw~'^[[:space:]]*-');
 when'array'then
  if json_array_length(v)>10000 then return false;end if;
  for item in select value from json_array_elements(v)loop if app.playoff_prize_proposal_json_safe_v2(item,depth+1)is distinct from true then return false;end if;end loop;return true;
 when'object'then
  select count(*)<>count(distinct pair.key)into duplicate_keys from json_each(v)pair;
  if duplicate_keys then return false;end if;
  for item in select value from json_each(v)loop if app.playoff_prize_proposal_json_safe_v2(item,depth+1)is distinct from true then return false;end if;end loop;return true;
 when'string'then return true;when'boolean'then return true;when'null'then return true;else return false;
 end case;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end$$;

-- Exactly JavaScript trim whitespace, including BOM, with raw text preserved.
create function app.valid_playoff_prize_proposal_reason_v2(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select coalesce(jsonb_typeof(v)='string'and app.event_settings_js_text_length_v3(v#>>'{}')<=2000
 and length(btrim(v#>>'{}',chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)))>0,false);
$$;

-- Structural journaling validation only. No weights, calculated awards, fund
-- balance, fee inference or approval calculation is duplicated in SQL.
create function app.valid_playoff_prize_proposal_history_v2(source_input jsonb,history jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare plan jsonb;record_value jsonb;binding jsonb;qualifiers integer;paid integer;step integer;
 first_place integer;last_place integer;k text;band_keys text[]:=array[]::text[];
 seen text[]:=array[]::text[];latest jsonb:='{}';prior text;amount numeric;plan_count integer;
begin
 if jsonb_typeof(source_input)is distinct from'object'or jsonb_typeof(history)is distinct from'array'
  or jsonb_typeof(source_input#>'{prizeSource,snapshot,plans}')is distinct from'array'
  or jsonb_typeof(source_input#>'{qualification,result,qualifierCount}')is distinct from'number'
  or coalesce(source_input#>>'{qualification,result,qualifierCount}','')!~'^[1-9][0-9]{0,4}$'then return false;end if;
 if jsonb_array_length(history)>10000 then return false;end if;
 qualifiers:=(source_input#>>'{qualification,result,qualifierCount}')::integer;if qualifiers>10000 then return false;end if;
 binding:=source_input->'binding';
 select count(*)into plan_count from jsonb_array_elements(source_input#>'{prizeSource,snapshot,plans}')p
  where p->>'eventClientRowId'=binding->>'eventClientRowId'and p->>'eventKind'=binding->>'eventKind'and p->>'mode'='proposed_v2';
 if plan_count<>1 then return false;end if;
 select p->'draft'into plan from jsonb_array_elements(source_input#>'{prizeSource,snapshot,plans}')p
  where p->>'eventClientRowId'=binding->>'eventClientRowId'and p->>'eventKind'=binding->>'eventKind'and p->>'mode'='proposed_v2';
 if app.valid_event_prize_draft_source_v1(plan)is distinct from true then return false;end if;
 paid:=case when plan->>'method'='winner-takes-all'then 1 when plan->>'recipients'='all'then qualifiers else substring(plan->>'recipients'from 5)::integer end;
 if paid<1 or paid>qualifiers then return false;end if;
 step:=(plan#>>'{rounding,regular}')::integer*100;
 first_place:=1;
 while first_place<=paid loop
  last_place:=least(paid,case when first_place=1 then 1 else(first_place-1)*2 end);
  band_keys:=array_append(band_keys,first_place::text||':'||last_place::text);
  first_place:=case when first_place=1 then 2 else first_place*2-1 end;
 end loop;
 for record_value in select value from jsonb_array_elements(history)loop
  if app.event_prize_exact_keys_source_v1(record_value,array['recordId','firstPlace','lastPlace','priorRecordId','perPersonMinor','voided','reason'])is distinct from true
   or jsonb_typeof(record_value->'recordId')is distinct from'string'or coalesce(record_value->>'recordId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or jsonb_typeof(record_value->'firstPlace')is distinct from'number'or coalesce(record_value->>'firstPlace','')!~'^[1-9][0-9]{0,4}$'
   or jsonb_typeof(record_value->'lastPlace')is distinct from'number'or coalesce(record_value->>'lastPlace','')!~'^[1-9][0-9]{0,4}$'
   or jsonb_typeof(record_value->'perPersonMinor')is distinct from'number'or coalesce(record_value->>'perPersonMinor','')!~'^(0|[1-9][0-9]{0,15})$'
   or jsonb_typeof(record_value->'voided')is distinct from'boolean'
   or app.valid_playoff_prize_proposal_reason_v2(record_value->'reason')is distinct from true then return false;end if;
  if record_value->'priorRecordId'is distinct from'null'::jsonb and(jsonb_typeof(record_value->'priorRecordId')is distinct from'string'or coalesce(record_value->>'priorRecordId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')then return false;end if;
  amount:=(record_value->>'perPersonMinor')::numeric;if amount>9007199254740991 or mod(amount,step)<>0 then return false;end if;
  k:=(record_value->>'firstPlace')||':'||(record_value->>'lastPlace');
  if not(k=any(band_keys))or record_value->>'recordId'=any(seen)then return false;end if;
  prior:=latest->>k;
  if prior is null then
   if record_value->'priorRecordId'is distinct from'null'::jsonb or record_value->'voided'is distinct from'false'::jsonb then return false;end if;
  elsif record_value->>'priorRecordId'is distinct from prior then return false;end if;
  seen:=array_append(seen,record_value->>'recordId');latest:=latest||jsonb_build_object(k,record_value->>'recordId');
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end$$;

-- Representability only: mirror the approved JS comparison's exact integer
-- rational weights and positive nearest-step quotient, then apply the CURRENT
-- latest overrides (void restores the source amount). This returns no awards
-- and confers no payout/fund authority. No fee inference or balance solver.
create function app.playoff_prize_proposal_range_safe_v2(source_input jsonb,history jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare plan jsonb;binding jsonb;ledger jsonb;source_row jsonb;part jsonb;record_value jsonb;latest jsonb:='{}';
 qualifiers integer;paid integer;step integer;first_place integer;last_place integer;group_count integer;i integer;j integer;
 people integer[]:=array[]::integer[];keys text[]:=array[]::text[];weights numeric[]:=array[]::numeric[];
 factor_text text;decimal_text text;factor_num numeric:=1;factor_den numeric:=1;weight numeric;denominator numeric:=0;
 source_amount numeric;allocated numeric;part_amount numeric;entry_total numeric:=0;benefit_total numeric:=0;expense_total numeric:=0;fund numeric;
 source_award numeric;award numeric;band_total numeric;proposed_total numeric:=0;
begin
 if app.valid_playoff_prize_proposal_history_v2(source_input,history)is distinct from true then return false;end if;
 binding:=source_input->'binding';ledger:=source_input#>'{ledger,current}';
 if ledger is distinct from source_input#>'{ledger,retained}'or ledger->>'mode'is distinct from'documented_actual'
  or ledger->'complete'is distinct from'true'::jsonb or jsonb_typeof(ledger->'sources')is distinct from'array'then return false;end if;
 for source_row in select value from jsonb_array_elements(ledger->'sources')loop
  if coalesce(source_row->>'kind','')not in('entry_receipt','expense')or coalesce(source_row->>'state','')not in('active','voided')
   or jsonb_typeof(source_row->'allocations')is distinct from'array'or jsonb_typeof(source_row->'amountMinor')is distinct from'number'
   or coalesce(source_row->>'amountMinor','')!~'^[1-9][0-9]{0,15}$'then return false;end if;
  source_amount:=(source_row->>'amountMinor')::numeric;if source_amount>9007199254740991 then return false;end if;
  if source_row->>'state'='voided'then if jsonb_array_length(source_row->'allocations')<>0 then return false;end if;continue;end if;
  allocated:=0;
  for part in select value from jsonb_array_elements(source_row->'allocations')loop
   if part->'poolId'is distinct from'null'::jsonb or part->'classificationReviewed'is distinct from'true'::jsonb
    or jsonb_typeof(part->'amountMinor')is distinct from'number'or coalesce(part->>'amountMinor','')!~'^[1-9][0-9]{0,15}$'
    or(source_row->>'kind'='entry_receipt'and part->>'bucket'is distinct from'regular_entry')
    or(source_row->>'kind'='expense'and coalesce(part->>'bucket','')not in('player_benefit','operating_expense'))then return false;end if;
   part_amount:=(part->>'amountMinor')::numeric;if part_amount>9007199254740991 then return false;end if;allocated:=allocated+part_amount;
   if part->>'eventId'=binding->>'eventId'then
    if part->>'bucket'='regular_entry'then entry_total:=entry_total+part_amount;
    elsif part->>'bucket'='player_benefit'then benefit_total:=benefit_total+part_amount;
    else expense_total:=expense_total+part_amount;end if;
   end if;
  end loop;
  if allocated<>source_amount then return false;end if;
 end loop;
 fund:=entry_total-benefit_total-expense_total;
 if entry_total>9007199254740991 or benefit_total>9007199254740991 or expense_total>9007199254740991 or fund<0 then return false;end if;
 select p->'draft'into plan from jsonb_array_elements(source_input#>'{prizeSource,snapshot,plans}')p
  where p->>'eventClientRowId'=binding->>'eventClientRowId'and p->>'eventKind'=binding->>'eventKind'and p->>'mode'='proposed_v2';
 qualifiers:=(source_input#>>'{qualification,result,qualifierCount}')::integer;
 paid:=case when plan->>'method'='winner-takes-all'then 1 when plan->>'recipients'='all'then qualifiers else substring(plan->>'recipients'from 5)::integer end;
 step:=(plan#>>'{rounding,regular}')::integer*100;
 if fund>9007199254740991-step::numeric*paid then return false;end if;
 first_place:=1;
 while first_place<=paid loop
  last_place:=least(paid,case when first_place=1 then 1 else(first_place-1)*2 end);
  people:=array_append(people,last_place-first_place+1);keys:=array_append(keys,first_place::text||':'||last_place::text);
  first_place:=case when first_place=1 then 2 else first_place*2-1 end;
 end loop;
 group_count:=array_length(people,1);
 if plan->>'method'in('graduated','winner-multiplier')then
  factor_text:=case when plan->>'method'='graduated'then plan->>'incrementFactorText'else plan->>'winnerMultiplierText'end;
  if length(factor_text)>16 or factor_text!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'then return false;end if;
  decimal_text:=split_part(factor_text,'.',2);for j in 1..length(decimal_text)loop factor_den:=factor_den*10;end loop;
  factor_num:=split_part(factor_text,'.',1)::numeric*factor_den+coalesce(nullif(decimal_text,'')::numeric,0);
  if factor_num<factor_den or factor_num>1000*factor_den then return false;end if;
 end if;
 for i in 1..group_count loop
  weight:=1;
  if plan->>'method'='graduated'then
   for j in 1..(group_count-i)loop weight:=weight*factor_num;end loop;
   for j in 1..(i-1)loop weight:=weight*factor_den;end loop;
  elsif plan->>'method'='winner-multiplier'then weight:=case when i=1 then factor_num else factor_den end;end if;
  weights:=array_append(weights,weight);denominator:=denominator+weight*people[i];
 end loop;
 for record_value in select value from jsonb_array_elements(history)loop latest:=latest||jsonb_build_object((record_value->>'firstPlace')||':'||(record_value->>'lastPlace'),record_value);end loop;
 for i in 1..group_count loop
  -- div(numeric,numeric) is integer quotient. Numeric / may round a ratio just
  -- below a half into the next step and must never replace this expression.
  source_award:=pg_catalog.div(2*fund*weights[i]+denominator*step,2*denominator*step)*step;
  record_value:=latest->keys[i];award:=case when record_value is not null and record_value->'voided'='false'::jsonb then(record_value->>'perPersonMinor')::numeric else source_award end;
  band_total:=award*people[i];proposed_total:=proposed_total+band_total;
  if source_award>9007199254740991 or band_total>9007199254740991 or proposed_total>9007199254740991 then return false;end if;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return false;
end$$;

create function app.valid_playoff_prize_proposal_request_v2(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select coalesce(app.event_prize_exact_keys_source_v1(v,array['kind','operationId','expectedRevisionId','nativeSourceDigest','input','overrideHistory','reason','mode','confirmed'])
 and v->>'kind'='playoff-prize-proposal-save-v2'
 and jsonb_typeof(v->'operationId')='string'and v->>'operationId'~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 and(v->'expectedRevisionId'='null'::jsonb or(jsonb_typeof(v->'expectedRevisionId')='string'and v->>'expectedRevisionId'~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'))
 and jsonb_typeof(v->'nativeSourceDigest')='string'and v->>'nativeSourceDigest'~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'input')='object'and jsonb_typeof(v->'overrideHistory')='array'
 and app.valid_playoff_prize_proposal_reason_v2(v->'reason')
 and v->>'mode'in('append','adopt-current')and v->'confirmed'='true'::jsonb,false);
$$;

create function app.playoff_prize_proposal_revision_document_v2(revision uuid)returns jsonb
language sql security definer set search_path=''as $$
 select jsonb_build_object('revisionId',rev.id,'version',rev.version,'priorRevisionId',rev.prior_revision_id,
 'actorId',rev.actor_id,'operationId',rev.operation_id,'tournamentId',rev.tournament_id,'eventId',rev.event_id,
 'nativeSourceDigest',rev.native_source_digest,'sourceCapture',rev.source_capture,'input',rev.source_input,'overrideHistory',rev.override_history,
 'mode',rev.mode,'reason',rev.reason,'createdAt',to_char(timezone('UTC',rev.created_at),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'proposalOnly',true,'payoutAuthorized',false,'moneyMoved',false)
 from app.playoff_prize_proposal_revisions_v2 rev where rev.id=revision;
$$;
create function app.playoff_prize_proposal_operation_document_v2(actor uuid,op uuid)returns jsonb
language sql security definer set search_path=''as $$
 select jsonb_build_object('kind','playoff-prize-proposal-operation-v2','actorId',journal.actor_id,
 'tournamentId',journal.tournament_id,'eventId',journal.event_id,'operationId',journal.operation_id,
 'requestText',journal.request_text,'requestHash',journal.request_hash,'result',outcome.result)
 from app.playoff_prize_proposal_operations_v2 journal join app.playoff_prize_proposal_outcomes_v2 outcome
 on outcome.actor_id=journal.actor_id and outcome.operation_id=journal.operation_id
 where journal.actor_id=actor and journal.operation_id=op;
$$;
create function app.playoff_prize_proposal_attempt_v2(actor uuid,tid uuid,eid uuid,op uuid,h text,s text,c text)returns jsonb
language sql immutable set search_path=''as $$select jsonb_build_object('kind','playoff-prize-proposal-attempt-v2','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'requestHash',h,'status',s,'code',c)$$;

create function app.get_playoff_prize_proposal_workspace_v2(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();native jsonb;head app.playoff_prize_proposal_revisions_v2%rowtype;head_document jsonb;stale boolean;
begin
 if app.playoff_prize_proposal_read_enabled_v2()is distinct from true or actor is null or tid is null or eid is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 perform 1 from app.events where id=eid and tournament_id=tid for share nowait;if not found then return null;end if;
 native:=app.get_playoff_prize_native_source_v2(tid,eid);
 if not pg_try_advisory_xact_lock_shared(hashtextextended('playoff-prize-proposal-event-v2:'||tid::text||':'||eid::text,0))then raise lock_not_available;end if;
 select rev.*into head from app.playoff_prize_proposal_heads_v2 ptr join app.playoff_prize_proposal_revisions_v2 rev on rev.id=ptr.revision_id and rev.tournament_id=ptr.tournament_id and rev.event_id=ptr.event_id where ptr.tournament_id=tid and ptr.event_id=eid;
 if exists(select 1 from app.playoff_prize_proposal_revisions_v2 rev where rev.tournament_id=tid and rev.event_id=eid and(head.id is null or rev.version>head.version))then raise exception'playoff_prize_proposal_head_inconsistent';end if;
 head_document:=app.playoff_prize_proposal_revision_document_v2(head.id);
 stale:=native->>'status'is distinct from'source_available'or(head.id is not null and jsonb_build_array(head.source_capture->'capture',head.source_capture->'coverage')is distinct from jsonb_build_array(native->'capture',native->'coverage'));
 return jsonb_build_object('kind','playoff-prize-proposal-workspace-v2','actorId',actor,'tournamentId',tid,'eventId',eid,'nativeSource',native,'head',head_document,'stale',stale,'writeAuthorized',false,'finalizationAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Historical owned recovery deliberately does not call the current source
-- getter or require the current head/source. Current official access is required.
create function app.get_playoff_prize_proposal_operation_v2(tid uuid,eid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();request_value jsonb;op uuid;h text;journal app.playoff_prize_proposal_operations_v2%rowtype;document jsonb;
begin
 if app.playoff_prize_proposal_recovery_enabled_v2()is distinct from true or actor is null or tid is null or eid is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 begin
  if app.playoff_prize_proposal_json_safe_v2(request_text::json,0)is distinct from true then return null;end if;
  request_value:=request_text::jsonb;op:=(request_value->>'operationId')::uuid;
 exception when invalid_text_representation then return null;end;
 if app.valid_playoff_prize_proposal_request_v2(request_value)is distinct from true or op is null then return null;end if;
 h:=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex');
 if current_setting('transaction_isolation')<>'read committed'then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'retry_exact','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 perform 1 from app.events where id=eid and tournament_id=tid for share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock_shared(hashtextextended('playoff-prize-proposal-operation-v2:'||actor::text||':'||op::text,0))then raise lock_not_available;end if;
 select*into journal from app.playoff_prize_proposal_operations_v2 where actor_id=actor and operation_id=op;
 if journal.actor_id is null then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'unknown','operation_not_found');end if;
 if journal.tournament_id is distinct from tid or journal.event_id is distinct from eid or journal.request_text is distinct from request_text or journal.request_hash is distinct from h or journal.request_payload is distinct from request_value then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'rejected','operation_conflict');end if;
 document:=app.playoff_prize_proposal_operation_document_v2(actor,op);
 if document is null then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'unknown','operation_incomplete');end if;return document;
exception when lock_not_available then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'retry_exact','source_busy');end$$;

create function app.save_playoff_prize_proposal_v2(tid uuid,eid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();request_value jsonb;op uuid;h text;native jsonb;journal app.playoff_prize_proposal_operations_v2%rowtype;
 head app.playoff_prize_proposal_revisions_v2%rowtype;expected uuid;new_id uuid;new_version bigint;result_value jsonb;document jsonb;code text;
begin
 if actor is null or tid is null or eid is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 begin
  if app.playoff_prize_proposal_json_safe_v2(request_text::json,0)is distinct from true then return null;end if;
  request_value:=request_text::jsonb;op:=(request_value->>'operationId')::uuid;
 exception when invalid_text_representation then return null;end;
 if app.valid_playoff_prize_proposal_request_v2(request_value)is distinct from true or op is null then return null;end if;
 h:=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex');
 if app.playoff_prize_proposal_write_enabled_v2()is distinct from true then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'unavailable','feature_disabled');end if;
 if current_setting('transaction_isolation')<>'read committed'then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'retry_exact','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 perform 1 from app.events where id=eid and tournament_id=tid for share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('playoff-prize-proposal-operation-v2:'||actor::text||':'||op::text,0))then raise lock_not_available;end if;
 select*into journal from app.playoff_prize_proposal_operations_v2 where actor_id=actor and operation_id=op;
 if journal.actor_id is not null then
  if journal.tournament_id is distinct from tid or journal.event_id is distinct from eid or journal.request_text is distinct from request_text or journal.request_hash is distinct from h or journal.request_payload is distinct from request_value then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'rejected','operation_conflict');end if;
  document:=app.playoff_prize_proposal_operation_document_v2(actor,op);
  if document is null then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'unknown','operation_incomplete');end if;return document;
 end if;
 native:=app.get_playoff_prize_native_source_v2(tid,eid);
 if native->>'status'='retry_exact'then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'retry_exact',coalesce(native->>'code','source_busy'));end if;
 if native->>'status'is distinct from'source_available'then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'blocked','native_source_unavailable');end if;
 if native->>'actorId'is distinct from actor::text or native->>'tournamentId'is distinct from tid::text or native->>'eventId'is distinct from eid::text then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'blocked','native_source_scope_mismatch');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('playoff-prize-proposal-event-v2:'||tid::text||':'||eid::text,0))then raise lock_not_available;end if;
 select rev.*into head from app.playoff_prize_proposal_heads_v2 ptr join app.playoff_prize_proposal_revisions_v2 rev on rev.id=ptr.revision_id and rev.tournament_id=ptr.tournament_id and rev.event_id=ptr.event_id where ptr.tournament_id=tid and ptr.event_id=eid for update of ptr nowait;
 if exists(select 1 from app.playoff_prize_proposal_revisions_v2 rev where rev.tournament_id=tid and rev.event_id=eid and(head.id is null or rev.version>head.version))then raise exception'playoff_prize_proposal_head_inconsistent';end if;
 expected:=(request_value->>'expectedRevisionId')::uuid;
 if expected is distinct from head.id then code:='head_conflict';
 elsif request_value->>'nativeSourceDigest'is distinct from native->>'sourceDigest'or request_value->'input'is distinct from native#>'{capture,input}'then code:='native_source_changed';
 elsif app.valid_playoff_prize_proposal_history_v2(request_value->'input',request_value->'overrideHistory')is distinct from true then code:='invalid_override_history';
 elsif app.playoff_prize_proposal_range_safe_v2(request_value->'input',request_value->'overrideHistory')is distinct from true then code:='unsafe_proposal_range';
 elsif request_value->>'mode'='adopt-current'then
  if head.id is null or jsonb_build_array(head.source_capture->'capture',head.source_capture->'coverage')is not distinct from jsonb_build_array(native->'capture',native->'coverage')or request_value->'overrideHistory'is distinct from'[]'::jsonb then code:='invalid_source_adoption';end if;
 elsif head.id is not null then
  if jsonb_build_array(head.source_capture->'capture',head.source_capture->'coverage')is distinct from jsonb_build_array(native->'capture',native->'coverage')then code:='explicit_source_adoption_required';
  elsif jsonb_array_length(request_value->'overrideHistory')<jsonb_array_length(head.override_history)
   or exists(select 1 from jsonb_array_elements(head.override_history)with ordinality old_record(value,n)where old_record.value is distinct from(request_value->'overrideHistory')->((old_record.n-1)::integer))then code:='immutable_history_prefix_required';end if;
 end if;
 -- All changes below share this function's exception savepoint. source_busy
 -- rolls back the reservation, revision, head AND outcome; no poisoned retry.
 insert into app.playoff_prize_proposal_operations_v2(actor_id,operation_id,tournament_id,event_id,request_text,request_hash,request_payload)values(actor,op,tid,eid,request_text,h,request_value);
 if code is null then
  new_id:=gen_random_uuid();new_version:=coalesce(head.version,0)+1;
  insert into app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,native_source_digest,source_capture,source_input,override_history,mode,reason)
   values(new_id,tid,eid,new_version,head.id,actor,op,request_value->>'nativeSourceDigest',native,request_value->'input',request_value->'overrideHistory',request_value->>'mode',request_value->>'reason');
  if head.id is null then insert into app.playoff_prize_proposal_heads_v2(tournament_id,event_id,revision_id)values(tid,eid,new_id);
  else update app.playoff_prize_proposal_heads_v2 set revision_id=new_id where tournament_id=tid and event_id=eid and revision_id=head.id;if not found then raise exception'playoff_prize_proposal_head_changed';end if;end if;
  result_value:=jsonb_build_object('status','saved','revision',app.playoff_prize_proposal_revision_document_v2(new_id));
 else result_value:=jsonb_build_object('status','rejected','code',code);end if;
 insert into app.playoff_prize_proposal_outcomes_v2(actor_id,operation_id,result)values(actor,op,result_value);
 return app.playoff_prize_proposal_operation_document_v2(actor,op);
exception when lock_not_available then return app.playoff_prize_proposal_attempt_v2(actor,tid,eid,op,h,'retry_exact','source_busy');end$$;

-- Callable surface remains completely revoked. No schema exposure or session
-- impersonation is implied: auth.uid() comes from the caller's own session.
create function public.get_playoff_prize_proposal_workspace_provider_v2(p_tid uuid,p_eid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_playoff_prize_proposal_workspace_v2(p_tid,p_eid)$$;
create function public.save_playoff_prize_proposal_provider_v2(p_tid uuid,p_eid uuid,p_request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.save_playoff_prize_proposal_v2(p_tid,p_eid,p_request_text)$$;
create function public.get_playoff_prize_proposal_operation_provider_v2(p_tid uuid,p_eid uuid,p_request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.get_playoff_prize_proposal_operation_v2(p_tid,p_eid,p_request_text)$$;

do $acl$declare f regprocedure;begin
 foreach f in array array[
 'app.playoff_prize_proposal_read_enabled_v2()'::regprocedure,'app.playoff_prize_proposal_write_enabled_v2()'::regprocedure,'app.playoff_prize_proposal_recovery_enabled_v2()'::regprocedure,
 'app.playoff_prize_proposal_json_safe_v2(json,integer)'::regprocedure,
 'app.valid_playoff_prize_proposal_reason_v2(jsonb)'::regprocedure,'app.valid_playoff_prize_proposal_history_v2(jsonb,jsonb)'::regprocedure,'app.playoff_prize_proposal_range_safe_v2(jsonb,jsonb)'::regprocedure,'app.valid_playoff_prize_proposal_request_v2(jsonb)'::regprocedure,
 'app.playoff_prize_proposal_revision_document_v2(uuid)'::regprocedure,'app.playoff_prize_proposal_operation_document_v2(uuid,uuid)'::regprocedure,'app.playoff_prize_proposal_attempt_v2(uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,
 'app.get_playoff_prize_proposal_workspace_v2(uuid,uuid)'::regprocedure,'app.get_playoff_prize_proposal_operation_v2(uuid,uuid,text)'::regprocedure,'app.save_playoff_prize_proposal_v2(uuid,uuid,text)'::regprocedure,
 'public.get_playoff_prize_proposal_workspace_provider_v2(uuid,uuid)'::regprocedure,'public.save_playoff_prize_proposal_provider_v2(uuid,uuid,text)'::regprocedure,'public.get_playoff_prize_proposal_operation_provider_v2(uuid,uuid,text)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$acl$;
commit;
