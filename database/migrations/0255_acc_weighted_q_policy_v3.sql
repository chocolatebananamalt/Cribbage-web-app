-- LOCAL ONLY: new explicitly disclosed ACC-weighted/application-balanced Q policy.
-- Existing chart/equal policies, reviews, receipts and accounting history are not rewritten.
begin;
do $$declare c record;n integer;begin
 select count(*)into n from pg_constraint where conrelid='app.q_operating_policies_v2'::regclass and contype='c'and pg_get_constraintdef(oid)like'%method%';
 if n<>2 then raise exception 'Reviewed Q method constraint count changed';end if;
 for c in select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='app.q_operating_policies_v2'::regclass and contype='c'and pg_get_constraintdef(oid)like'%method%'loop
  if c.definition not like'%equal-paid-playoff-qualifiers-v2%'or c.definition not like'%graduated-paid-card-rank-v2%'or c.definition like'%acc-weighted-largest-remainder%'then raise exception 'Reviewed Q method constraint definition changed';end if;
  execute format('alter table app.q_operating_policies_v2 drop constraint %I',c.conname);
 end loop;
end$$;
alter table app.q_operating_policies_v2 add constraint q_operating_method_v3_check check(method in('equal-paid-playoff-qualifiers-v2','graduated-paid-card-rank-v2','acc-weighted-largest-remainder-5usd-v1'));
alter table app.q_operating_policies_v2 add constraint q_operating_configuration_v3_check check(
 (method='equal-paid-playoff-qualifiers-v2'and ratio is null and schedule_id is null)or
 (method='graduated-paid-card-rank-v2'and ratio is not null and schedule_id is not null and
 ((ratio=6 and schedule_id in('friend-q-p2-10-6-v1','friend-q-p3-20-6-v1','friend-q-p4-50-6-v1'))or(ratio=4 and schedule_id in('friend-q-p5-10-4-v1','friend-q-p6-20-4-v1','friend-q-p7-50-4-v1'))))or
 (method='acc-weighted-largest-remainder-5usd-v1'and ratio is not null and ratio in(4,6)and schedule_id is not null and schedule_id='acc-weighted-largest-remainder-5usd-v1'));

-- Exact rational arithmetic; independent original $5 rounding is deliberately
-- replaced only in this new opt-in version. Remainder ties prefer higher place.
create function app.calculate_acc_weighted_pool_v1(p_input jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare n integer;fee bigint;r integer;k integer;fund bigint;d bigint;den bigint;num bigint;j integer;i integer;
 branch text;amounts bigint[]:='{}';remainders bigint[]:='{}';numerators bigint[]:='{}';denominators bigint[]:='{}';raw jsonb:='[]';total bigint:=0;missing integer;
 a bigint;b bigint;t bigint;g bigint;key text;
begin
 if jsonb_typeof(p_input)is distinct from'object'then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 if(select count(*)from jsonb_object_keys(p_input))<>3 or not(p_input?&array['paidCount','feeMinor','ratio'])then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 foreach key in array array['paidCount','feeMinor','ratio']loop
  if jsonb_typeof(p_input->key)is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_input');end if;
  if(p_input->>key)::numeric<>trunc((p_input->>key)::numeric)or abs((p_input->>key)::numeric)>9007199254740991 then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 end loop;
 if(p_input->>'paidCount')::numeric not between 1 and 256 then return jsonb_build_object('status','blocked','code','unsupported_paid_count');end if;
 if(p_input->>'feeMinor')::numeric not in(1000,2000,5000)then return jsonb_build_object('status','blocked','code','unsupported_fee');end if;
 if(p_input->>'ratio')::numeric not in(4,6)then return jsonb_build_object('status','blocked','code','unsupported_ratio');end if;
 n:=(p_input->>'paidCount')::numeric::integer;fee:=(p_input->>'feeMinor')::numeric::bigint;r:=(p_input->>'ratio')::numeric::integer;
 fund:=n::bigint*fee;k:=(n+r-1)/r;d:=k::bigint*(k+1)/2;
 if mod(fund,500)<>0 or mod(fee,500)<>0 then return jsonb_build_object('status','blocked','code','unsupported_lattice');end if;
 if fund<k*fee then return jsonb_build_object('status','blocked','code','fund_below_fee_floor');end if;
 branch:=case when k=1 then'single_recipient'when fund>d*fee then'descending_linear'else'entry_fee_floor'end;
 for j in 1..k loop
  if k=1 then num:=fund;den:=1;
  elsif branch='descending_linear'then num:=fund*(k-j+1);den:=d;
  else den:=d-k;num:=fee*den+(fund-fee*k)*(k-j);end if;
  numerators:=array_append(numerators,num);denominators:=array_append(denominators,den);
  amounts:=array_append(amounts,(num/(den*500))*500);remainders:=array_append(remainders,mod(num,den*500));total:=total+amounts[j];
  a:=num;b:=den;while b<>0 loop t:=mod(a,b);a:=b;b:=t;end loop;g:=a;
  raw:=raw||jsonb_build_array(jsonb_build_object('numeratorMinor',(num/g)::text,'denominator',(den/g)::text));
 end loop;
 if total>fund or mod(fund-total,500)<>0 then raise exception 'Balanced Q floor invariant failed';end if;
 missing:=((fund-total)/500)::integer;if missing<0 or missing>=k then raise exception 'Balanced Q remainder invariant failed';end if;
 -- All places share the same exact raw denominator in each branch. No decimal
 -- division or floating comparison is used to rank fractional remainders.
 for i in select x from generate_subscripts(remainders,1)x order by remainders[x]desc,x limit missing loop amounts[i]:=amounts[i]+500;end loop;
 if(select sum(x)from unnest(amounts)x)<>fund or exists(select 1 from generate_subscripts(amounts,1)x where amounts[x]<fee or mod(amounts[x],500)<>0 or(x>1 and amounts[x]>amounts[x-1]))then raise exception 'Balanced Q conservation/order/fee-floor invariant failed';end if;
 return jsonb_build_object('status','calculated','policyVersion','acc-weighted-largest-remainder-5usd-v1','currency','USD','paidCount',n,'feeMinor',fee,'ratio',r,'recipientCount',k,'fundMinor',fund,'roundingUnitMinor',500,'branch',branch,'awardsMinor',to_jsonb(amounts),'unroundedAwards',raw);
end$$;
revoke all on function app.calculate_acc_weighted_pool_v1(jsonb)from public,anon,authenticated,service_role;

create function public.save_q_operating_policy_v3(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare c jsonb;w jsonb;pool jsonb;prior app.operation_receipts%rowtype;h text;response jsonb;code text;pid uuid;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();fee integer;setupcode text;ratio integer;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if p_actor_id is null or p_tournament_id is null or p_operation_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 c:=app.q_pool_context_v1(p_tournament_id);perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||(c->>'eventId'),0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open','pending_finalization')for no key update;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director'for update;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_operating_v3',p_actor_id,p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if prior.tournament_id=p_tournament_id and prior.operation_type='q_operating_v3'and prior.request_hash=h then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  if jsonb_typeof(p_request)is distinct from'object'then raise exception 'invalid_request';end if;
  if(select count(*)from jsonb_object_keys(p_request))<>7 or not(p_request?&array['action','poolVersionId','method','ratio','scheduleId','disclosureReference','disclosed'])
   or p_request->>'action'is distinct from'publish'or p_request->>'method'is distinct from'acc-weighted-largest-remainder-5usd-v1'
   or p_request->>'scheduleId'is distinct from'acc-weighted-largest-remainder-5usd-v1'or p_request->'disclosed'is distinct from'true'::jsonb
   or jsonb_typeof(p_request->'poolVersionId')is distinct from'string'or(p_request->>'poolVersionId')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(p_request->'ratio')is distinct from'number'or p_request->'ratio'not in('4'::jsonb,'6'::jsonb)
   or jsonb_typeof(p_request->'disclosureReference')is distinct from'string'or length(trim(p_request->>'disclosureReference'))not between 1 and 500 or p_request->>'disclosureReference'<>trim(p_request->>'disclosureReference')or p_request->>'disclosureReference'~'[[:cntrl:]]'then raise exception 'invalid_request';end if;
  pid:=(p_request->>'poolVersionId')::uuid;ratio:=(p_request->>'ratio')::integer;w:=public.get_q_operating_workspace_v2(p_actor_id,p_tournament_id);
  select value into pool from jsonb_array_elements(w->'membership'->'pools')where value->>'poolVersionId'=pid::text;
  if pool is null then raise exception 'pool_version_mismatch';end if;
  if exists(select 1 from app.q_pool_policies_v1 where pool_version_id=pid)or exists(select 1 from app.q_operating_policies_v2 where pool_version_id=pid)then raise exception 'policy_frozen';end if;
  if c->>'started'='true'then raise exception 'entries_locked';end if;
  if w->>'canPublish'is distinct from'true'then raise exception 'collection_or_consent_already_started';end if;
  select pool_type_code,entry_fee_cents into setupcode,fee from app.tournament_setup_q_pool_versions where id=pid and tournament_id=p_tournament_id;
  if setupcode<>('Graduated (1-in-'||ratio::text||')')then raise exception 'setup_method_conflict';end if;
  if fee not in(1000,2000,5000)then raise exception 'unsupported_payout_domain';end if;
  response:=jsonb_build_object('status','q_policy_published','policyId',rid,'poolVersionId',pid);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','pool_version_mismatch','policy_frozen','entries_locked','collection_or_consent_already_started','setup_method_conflict','unsupported_payout_domain')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,p_tournament_id,p_actor_id,'q_operating_v3',coalesce(pid,p_tournament_id),h,p_operation_id,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then insert into app.q_operating_policies_v2(id,tournament_id,event_id,pool_version_id,method,ratio,schedule_id,disclosure_reference,actor_id,operation_receipt_id,published_at)
 values(rid,p_tournament_id,(c->>'eventId')::uuid,pid,'acc-weighted-largest-remainder-5usd-v1',ratio,'acc-weighted-largest-remainder-5usd-v1',p_request->>'disclosureReference',p_actor_id,oid,clock_timestamp());end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,oid,'q_operating_v3',case when code is null then rid else p_tournament_id end,case when code is null then'q_acc_weighted_policy_frozen'else'q_acc_weighted_policy_rejected'end,response);
 return response;
end$$;
create function public.get_q_operating_reconciliation_v3(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare r app.operation_receipts%rowtype;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_operating_v3',p_actor_id,p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id=p_tournament_id and r.operation_type='q_operating_v3'and r.request_hash=h then return jsonb_build_object('authorized',true,'result',r.response_payload);end if;
 return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','code','idempotency_conflict'));
end$$;
revoke all on function public.save_q_operating_policy_v3(uuid,uuid,jsonb,uuid),public.get_q_operating_reconciliation_v3(uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.save_q_operating_policy_v3(uuid,uuid,jsonb,uuid),public.get_q_operating_reconciliation_v3(uuid,uuid,uuid,jsonb)to service_role;

-- Existing old/equal calculator remains byte-for-byte callable. No table chart
-- entry is edited or replaced by a formula amount.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.calculate_q_obligations_v2(jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.calculate_q_obligations_v2(','FUNCTION app.calculate_q_obligations_pre_acc_v3(');
 if p=d then raise exception 'Legacy Q calculator clone anchor changed';end if;execute p;
end$$;
create function app.calculate_q_obligations_with_acc_v3(w jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb;pol jsonb;e jsonb;ep jsonb;card jsonb;contributors jsonb;ranked jsonb;rows jsonb;item jsonb;chart jsonb;computed jsonb;output jsonb:='[]';
 fund numeric;n integer;i integer;fee bigint;ratio integer;awards jsonb;amount bigint;kind text;code text;
begin
 begin
  if w is null or jsonb_typeof(w)<>'object' or w->'membership' is null or w->'membership'='null'::jsonb
   or w->'membership'->>'supported' is distinct from 'true' or jsonb_array_length(w->'blockers')<>0
   or jsonb_array_length(w->'cards')=0 or jsonb_array_length(w->'membership'->'pools') not between 1 and 2 then raise exception 'source_blocked';end if;
  for p in select value from jsonb_array_elements(w->'membership'->'pools')loop
   select value into pol from jsonb_array_elements(w->'policies')where value->>'poolVersionId'=p->>'poolVersionId';
   if pol is null then raise exception 'policy_required';end if;
   fee:=(p->>'feeMinor')::bigint;contributors:='[]';fund:=0;
   for e in select value from jsonb_array_elements(w->'membership'->'entries')loop
    if (e->>'receivedMinor')::numeric>0 and e->>'allocationCurrent' is distinct from 'true' then raise exception 'funding_unresolved';end if;
    select value into ep from jsonb_array_elements(e->'pools')where value->>'poolVersionId'=p->>'poolVersionId';
    if ep is null then raise exception 'funding_unresolved';end if;
    if ep->>'elected'='true' then
     if ep->>'prePlayElected' is distinct from 'true' or ep->>'paidEntryEligible' is distinct from 'true' or e->>'allocationCurrent' is distinct from 'true'
      or(ep->>'amountAllocatedMinor')::numeric is distinct from fee::numeric
      or coalesce(not starts_with(ep->>'consentReference','Q policy '||(pol->>'id')||': '),true)
      or coalesce(length(trim(substr(ep->>'consentReference',length('Q policy '||(pol->>'id')||': ')+1))),0)=0 then raise exception 'funding_unresolved';end if;
     select value into card from jsonb_array_elements(w->'cards')where value->>'participantId'=e->>'participantId';
     if card is null then raise exception 'source_blocked';end if;
     contributors:=contributors||jsonb_build_array(jsonb_build_object('participantId',e->>'participantId','displayName',e->>'displayName','amountMinor',fee,
      'qualificationRank',card->'qualificationRank','qRank',null,'gamePoints',card->'gamePoints','gamesWon',card->'gamesWon','plusPoints',card->'plusPoints','qualified',card->'qualified'));
     fund:=fund+fee;
    elsif(ep->>'amountAllocatedMinor')::numeric<>0 then raise exception 'funding_unresolved';end if;
   end loop;
   if fund>9007199254740991 then raise exception 'invalid_amount';end if;
   rows:='[]';kind:='award';
   if pol->>'method'='equal-paid-playoff-qualifiers-v2' then
    select coalesce(jsonb_agg(value order by(value->>'qualificationRank')::integer),'[]')into ranked from jsonb_array_elements(contributors)where value->>'qualified'='true';
    n:=jsonb_array_length(ranked);
    if n=0 then
     kind:='refund';for item in select value from jsonb_array_elements(contributors)order by value->>'participantId'loop
      rows:=rows||jsonb_build_array(jsonb_build_object('participantId',item->>'participantId','displayName',item->>'displayName','amountMinor',fee,'qualificationRank',null,'qRank',null));
     end loop;
    else
     i:=0;for item in select value from jsonb_array_elements(ranked)loop
      amount:=floor(fund/n)::bigint+case when i<mod(fund,n)then 1 else 0 end;i:=i+1;
      rows:=rows||jsonb_build_array(jsonb_build_object('participantId',item->>'participantId','displayName',item->>'displayName','amountMinor',amount,'qualificationRank',item->'qualificationRank','qRank',i));
     end loop;
    end if;
   elsif pol->>'method'='acc-weighted-largest-remainder-5usd-v1' then
    if pol->>'scheduleId'is distinct from'acc-weighted-largest-remainder-5usd-v1'then raise exception 'policy_required';end if;
    if exists(select 1 from jsonb_array_elements(contributors)a join jsonb_array_elements(contributors)b on a->>'participantId'<b->>'participantId'
      where a->'gamePoints'=b->'gamePoints'and a->'gamesWon'=b->'gamesWon'and a->'plusPoints'=b->'plusPoints')then raise exception 'q_cash_tie_unresolved';end if;
    ratio:=(pol->>'ratio')::integer;n:=jsonb_array_length(contributors);
    computed:=app.calculate_acc_weighted_pool_v1(jsonb_build_object('paidCount',n,'feeMinor',fee,'ratio',ratio));
    if computed->>'status'is distinct from'calculated'then raise exception 'unsupported_payout_domain';end if;
    awards:=computed->'awardsMinor';
    select coalesce(jsonb_agg(value order by(value->>'gamePoints')::integer desc,(value->>'gamesWon')::integer desc,(value->>'plusPoints')::integer desc),'[]')into ranked from jsonb_array_elements(contributors);
    i:=0;for item in select value from jsonb_array_elements(ranked)limit jsonb_array_length(awards)loop
     amount:=(awards->>i)::bigint;i:=i+1;
     rows:=rows||jsonb_build_array(jsonb_build_object('participantId',item->>'participantId','displayName',item->>'displayName','amountMinor',amount,'qualificationRank',item->'qualificationRank','qRank',i));
    end loop;
   elsif pol->>'method'='graduated-paid-card-rank-v2' then
    -- Monetary tie authority is unresolved: even previously recorded cuts are not silently reused.
    if exists(select 1 from jsonb_array_elements(contributors)a join jsonb_array_elements(contributors)b on a->>'participantId'<b->>'participantId'
      where a->'gamePoints'=b->'gamePoints'and a->'gamesWon'=b->'gamesWon'and a->'plusPoints'=b->'plusPoints')then raise exception 'q_cash_tie_unresolved';end if;
    ratio:=(pol->>'ratio')::integer;n:=jsonb_array_length(contributors);
    select value into chart from jsonb_array_elements(app.q_chart_catalog_v2())where value->>'scheduleId'=pol->>'scheduleId'and(value->>'feeMinor')::bigint=fee and(value->>'ratio')::integer=ratio and(value->>'paidCount')::integer=n;
    if chart is null then raise exception 'chart_review_required';end if;
    awards:=chart->'awardsMinor';
    if jsonb_array_length(awards)<>ceil(n::numeric/ratio)::integer or(select sum(value::text::numeric)from jsonb_array_elements(awards))<>fund then raise exception 'unbalanced_chart';end if;
    select coalesce(jsonb_agg(value order by(value->>'gamePoints')::integer desc,(value->>'gamesWon')::integer desc,(value->>'plusPoints')::integer desc),'[]')into ranked from jsonb_array_elements(contributors);
    i:=0;for item in select value from jsonb_array_elements(ranked)limit jsonb_array_length(awards)loop
     amount:=(awards->>i)::bigint;i:=i+1;
     rows:=rows||jsonb_build_array(jsonb_build_object('participantId',item->>'participantId','displayName',item->>'displayName','amountMinor',amount,'qualificationRank',item->'qualificationRank','qRank',i));
    end loop;
   else raise exception 'policy_required';end if;
   if coalesce((select sum((value->>'amountMinor')::numeric)from jsonb_array_elements(rows)),0)<>fund then raise exception 'unbalanced_chart';end if;
   output:=output||jsonb_build_array(jsonb_build_object('poolVersionId',p->>'poolVersionId','policyId',pol->>'id','name',p->>'name','fundMinor',fund::bigint,'kind',kind,'status','unpaid','rows',rows));
  end loop;
  return jsonb_build_object('obligations',output,'blockers','[]'::jsonb);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range or division_by_zero then
  code:=case when sqlerrm in('source_blocked','funding_unresolved','policy_required','q_cash_tie_unresolved','chart_review_required','unbalanced_chart','unsupported_payout_domain')then sqlerrm else 'invalid_amount'end;
  return jsonb_build_object('obligations',null,'blockers',jsonb_build_array(code));
 end;
end $$;

create or replace function app.calculate_q_obligations_v2(w jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(w->'policies')='array'then
  if exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then return app.calculate_q_obligations_with_acc_v3(w);end if;
 end if;
 return app.calculate_q_obligations_pre_acc_v3(w);
end$$;
revoke all on function app.calculate_q_obligations_pre_acc_v3(jsonb),app.calculate_q_obligations_with_acc_v3(jsonb),app.calculate_q_obligations_v2(jsonb)from public,anon,authenticated,service_role;

do $$declare d text;p text;old text;replacement text;begin
 d:=pg_get_functiondef('public.get_q_operating_workspace_v2(uuid,uuid)'::regprocedure);
 old:=$old$ manifest:=jsonb_build_object('version','friend-operating-v2','pdfSha256','f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d',
  'legacySources',s,'scoreFinancialManifest',b->'manifest','policies',policies,'cards',cards,'blockers',blocks);$old$;replacement:=$new$ if exists(select 1 from jsonb_array_elements(policies)p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then
 manifest:=jsonb_build_object('version','q-operating-mixed-methods-v3','accAlgorithmVersion','acc-weighted-largest-remainder-5usd-v1',
  'algorithmDisclosure','Observed ACC raw weights with adopted application-owned exact largest-remainder 5USD rounding; remainder ties favor higher place',
  'legacySources',s,'scoreFinancialManifest',b->'manifest','policies',policies,'cards',cards,'blockers',blocks);
 else
 manifest:=jsonb_build_object('version','friend-operating-v2','pdfSha256','f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d',
  'legacySources',s,'scoreFinancialManifest',b->'manifest','policies',policies,'cards',cards,'blockers',blocks);
 end if;$new$;
 d:=replace(d,E'\r\n',E'\n');old:=replace(old,E'\r\n',E'\n');replacement:=replace(replacement,E'\r\n',E'\n');
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Operating manifest source anchor changed';end if;p:=replace(d,old,replacement);execute p;
end$$;

do $$declare d text;p text;old text;replacement text;begin
 d:=pg_get_functiondef('app.q_obligation_sources_v2(uuid,uuid)'::regprocedure);
 old:=$old$ manifest:=jsonb_build_object('calculatorVersion','q-unpaid-v2','catalogRevision',app.q_chart_catalog_revision_v2(),'operatingWorkspace',w,'context',c);$old$;replacement:=$new$ if exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then
 manifest:=jsonb_build_object('calculatorVersion','q-unpaid-dispatch-v3','accAlgorithmVersion','acc-weighted-largest-remainder-5usd-v1','catalogRevision',app.q_chart_catalog_revision_v2(),'operatingWorkspace',w,'context',c);
 else
 manifest:=jsonb_build_object('calculatorVersion','q-unpaid-v2','catalogRevision',app.q_chart_catalog_revision_v2(),'operatingWorkspace',w,'context',c);
 end if;$new$;
 d:=replace(d,E'\r\n',E'\n');old:=replace(old,E'\r\n',E'\n');replacement:=replace(replacement,E'\r\n',E'\n');
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Obligation manifest source anchor changed';end if;p:=replace(d,old,replacement);execute p;
end$$;
commit;

