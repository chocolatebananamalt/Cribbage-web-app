-- LOCAL ONLY: a private amount-and-ranking kernel. No payments or accounting
-- finalization. Callers must independently supply verified, current source data.
begin;
create function app.calculate_multi_event_pool_awards_v1(kind text,method text,ratio integer,fee bigint,cards jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare c jsonb; ranked jsonb; calc jsonb; awards jsonb:='[]'; n integer;k integer;i integer;amount bigint;fund bigint;qualified integer;policy text;
begin
 if kind is null or method is null or kind not in('q','side') or method not in('equal-paid-playoff-qualifiers-v2','graduated-acc-weighted-largest-remainder-5usd-v2')
  or(kind='side' and method<>'graduated-acc-weighted-largest-remainder-5usd-v2')
  or fee is null or fee<500 or mod(fee,500)<>0 or fee>100000000
  or jsonb_typeof(cards)is distinct from'array' or jsonb_array_length(cards)>10000 then return jsonb_build_object('status','blocked','code','unsupported_pool_input');end if;
 if(method='equal-paid-playoff-qualifiers-v2' and ratio is not null) or (method='graduated-acc-weighted-largest-remainder-5usd-v2' and (ratio is null or ratio not in(4,6,8,10))) then return jsonb_build_object('status','blocked','code','unsupported_pool_policy');end if;
 for c in select value from jsonb_array_elements(cards) loop
  if jsonb_typeof(c)is distinct from'object' or not(c?&array['participantId','gamePoints','gamesWon','plusPoints','qualified','qualificationRank'])
   or (select count(*)from jsonb_object_keys(c))<>6 or coalesce(c->>'participantId','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(c->'gamePoints') is distinct from 'number' or jsonb_typeof(c->'gamesWon') is distinct from 'number' or jsonb_typeof(c->'plusPoints') is distinct from 'number'
   or coalesce(c->>'gamePoints','')!~'^[0-9]{1,5}$' or coalesce(c->>'gamesWon','')!~'^[0-9]{1,5}$' or coalesce(c->>'plusPoints','')!~'^[0-9]{1,9}$'
   or jsonb_typeof(c->'qualified') is distinct from'boolean'
   or (c->>'qualified'='true' and (jsonb_typeof(c->'qualificationRank') is distinct from'number' or coalesce(c->>'qualificationRank','')!~'^[1-9][0-9]{0,4}$'))
   or (c->>'qualified'='false' and c->'qualificationRank' is distinct from 'null'::jsonb)
   or (c->>'gamePoints')::integer not between 2*(c->>'gamesWon')::integer and 3*(c->>'gamesWon')::integer
  then return jsonb_build_object('status','blocked','code','invalid_pool_card');end if;
 end loop;
 if (select count(distinct x->>'participantId') from jsonb_array_elements(cards)x)<>jsonb_array_length(cards)
 or (select count(distinct x->>'qualificationRank') from jsonb_array_elements(cards)x where x->>'qualified'='true')<>(select count(*) from jsonb_array_elements(cards)x where x->>'qualified'='true') then return jsonb_build_object('status','blocked','code','duplicate_pool_card');end if;
 n:=jsonb_array_length(cards);if n=0 then return jsonb_build_object('status','calculated','fundMinor',0,'awards','[]'::jsonb,'moneyMoved',false);end if;
 fund:=n::bigint*fee;
 if method='equal-paid-playoff-qualifiers-v2' then
  select coalesce(jsonb_agg(x order by (x->>'qualificationRank')::integer),'[]'),count(*) into ranked,qualified from jsonb_array_elements(cards)x where x->>'qualified'='true';
  if qualified=0 then
   select jsonb_agg(jsonb_build_object('participantId',x->'participantId','amountMinor',fee,'kind','refund') order by x->>'participantId') into awards from jsonb_array_elements(cards)x;
  else
   if mod(fund,qualified::bigint*500)<>0 then return jsonb_build_object('status','blocked','code','equal_pool_not_whole_five');end if;
   for i in 0..qualified-1 loop awards:=awards||jsonb_build_array(jsonb_build_object('participantId',ranked->i->'participantId','amountMinor',fund/qualified,'kind','award'));end loop;
  end if;
 else
  calc:=app.calculate_graduated_pool_amounts_v2(jsonb_build_object('paidCount',n,'feeMinor',fee,'ratio',ratio));
  if calc->>'status'<>'calculated' then return calc;end if;k:=(calc->>'recipientCount')::integer;
  -- Do not choose an arbitrary winner or unequal award across identical cards.
  if exists(select 1 from (select x, row_number() over(order by (x->>'gamePoints')::integer desc,(x->>'gamesWon')::integer desc,(x->>'plusPoints')::integer desc) pos,
   count(*) over(partition by x->>'gamePoints',x->>'gamesWon',x->>'plusPoints') ties from jsonb_array_elements(cards)x)s where ties>1 and pos<=k) then return jsonb_build_object('status','blocked','code','pool_tie_resolution_required');end if;
  select jsonb_agg(x order by (x->>'gamePoints')::integer desc,(x->>'gamesWon')::integer desc,(x->>'plusPoints')::integer desc) into ranked from jsonb_array_elements(cards)x;
  for i in 0..k-1 loop amount:=(calc->'awardsMinor'->>i)::bigint;awards:=awards||jsonb_build_array(jsonb_build_object('participantId',ranked->i->'participantId','amountMinor',amount,'kind','award'));end loop;
 end if;
 if (select coalesce(sum((x->>'amountMinor')::numeric),0) from jsonb_array_elements(awards)x)<>fund then return jsonb_build_object('status','blocked','code','pool_conservation_failed');end if;
 return jsonb_build_object('status','calculated','fundMinor',fund,'awards',awards,'moneyMoved',false);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','invalid_pool_card');end$$;
revoke all on function app.calculate_multi_event_pool_awards_v1(text,text,integer,bigint,jsonb) from public,anon,authenticated,service_role;

-- Read only, service mediated and explicitly simulated. Never persists awards.
create function public.get_multi_event_award_preview_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb;binding app.event_prize_schedule_bindings_v2%rowtype;rule app.setup_prize_schedule_versions_v2%rowtype;
 q app.qualification_result_versions%rowtype;v3 app.playoff_outcome_versions_v3%rowtype;v4 app.playoff_outcome_versions_v4%rowtype;
 cv app.consolation_playoff_outcome_versions_v1%rowtype;source jsonb;mrp jsonb;calc jsonb;regular jsonb;policy jsonb;cards jsonb;pool jsonb;
 pools jsonb:='[]';components jsonb;kind text;pooltotal numeric:=0;manifest jsonb; eventkind text;
begin
 s:=public.get_classified_multi_event_sources_v1(actor,tid,eid);
 if s is null then return null;end if;
 if s->>'status' is distinct from'available' then return jsonb_build_object('status','blocked','code','financial_source_blocked','source',s,'accountingAvailable',false,'moneyMoved',false);end if;
 select * into binding from app.event_prize_schedule_bindings_v2 where tournament_id=tid and event_id=eid;
 select * into rule from app.setup_prize_schedule_versions_v2 where id=binding.declaration_version_id and tournament_id=tid and client_row_id=binding.client_row_id;
 if rule.id is null or not exists(select 1 from app.tournament_setup_activations a where a.id=binding.activation_id and a.tournament_id=tid and a.event_id=eid and a.setup_event_version_id=binding.setup_event_version_id) or rule.id is distinct from (select id from app.setup_prize_schedule_versions_v2 where tournament_id=tid and client_row_id=binding.client_row_id order by version desc limit 1) or rule.settings_fingerprint is distinct from binding.settings_fingerprint or rule.settings_fingerprint is distinct from app.event_prize_settings_digest_v2(app.event_prize_settings_v2(tid,binding.client_row_id)) or not app.valid_regular_prize_schedule_v3(rule.schedule_payload) then return jsonb_build_object('status','blocked','code','current_declaration_required','accountingAvailable',false,'moneyMoved',false);end if;
 select * into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null or app.qualification_resolution_snapshot_current_v1(q.id) is distinct from true then return jsonb_build_object('status','blocked','code','current_qualification_required','accountingAvailable',false,'moneyMoved',false);end if;
 select event_type into eventkind from app.events where id=eid and tournament_id=tid and operational_state='active';
 if eventkind='main' then
  select * into v3 from app.playoff_outcome_versions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
  select * into v4 from app.playoff_outcome_versions_v4 where tournament_id=tid and event_id=eid order by version desc limit 1;
  source:=case when v3.id is not null and v4.id is null then jsonb_build_object('kind','playoff_outcome_v3','resultId',v3.id,'qualificationResultVersionId',v3.qualification_result_version_id) when v4.id is not null and v3.id is null then jsonb_build_object('kind','playoff_outcome_v4','resultId',v4.id,'qualificationResultVersionId',v4.qualification_result_version_id) else null end;
  if source is null or source->>'qualificationResultVersionId' is distinct from q.id::text or app.settlement_source_current_v5(tid,eid,source) is distinct from true then return jsonb_build_object('status','blocked','code','current_playoff_required','accountingAvailable',false,'moneyMoved',false);end if;
  mrp:=app.canonical_settlement_mrp_v5(tid,eid,source);
 elsif eventkind='consolation' then
  select * into cv from app.consolation_playoff_outcome_versions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if cv.id is null or cv.qualification_result_version_id is distinct from q.id or cv.source_digest is distinct from app.consolation_four_qualifier_source_v1(tid,eid,q.id) or cv.outcomes is distinct from app.derive_consolation_four_qualifier_v1(q.id,cv.series) then return jsonb_build_object('status','blocked','code','current_playoff_required','accountingAvailable',false,'moneyMoved',false);end if;
  source:=jsonb_build_object('kind','consolation_playoff_outcome_v1','resultId',cv.id,'qualificationResultVersionId',q.id,'sourceDigest',cv.source_digest);
  mrp:=jsonb_build_object('status','available','rows',cv.outcomes);
 else return jsonb_build_object('status','blocked','code','unsupported_event','accountingAvailable',false,'moneyMoved',false);end if;
 if mrp->>'status' is distinct from'available' or jsonb_typeof(mrp->'rows') is distinct from'array' or jsonb_array_length(mrp->'rows')<>(rule.schedule_payload->>'expectedQualifierCount')::integer then return jsonb_build_object('status','blocked','code','playoff_awards_unavailable','accountingAvailable',false,'moneyMoved',false);end if;
 calc:=app.calculate_regular_prize_rounding_v3(jsonb_build_object('grossBaseIncomeMinor',s->'baseIncomeMinor','expenseTotalMinor',s->'classifiedExpenses'->'expenseMinor','benefitExpenseMinor',s->'classifiedExpenses'->'benefitMinor','expectedQualifierCount',rule.schedule_payload->'expectedQualifierCount','cohorts',rule.schedule_payload->'cohorts'));
 if calc->>'status' is distinct from'calculated' then return jsonb_build_object('status','blocked','code','regular_calculation_blocked','detail',calc,'accountingAvailable',false,'moneyMoved',false);end if;
 select jsonb_agg(jsonb_build_object('participantId',r->'participantId','bandStart',r->'bandStart','bandEnd',r->'bandEnd','amountMinor',c->'awardMinor')order by (r->>'bandStart')::integer,r->>'participantId') into regular from jsonb_array_elements(mrp->'rows')r join jsonb_array_elements(calc->'cohorts')c on r->'bandStart'=c->'bandStart' and r->'bandEnd'=c->'bandEnd';
 if regular is null or jsonb_array_length(regular)<>(rule.schedule_payload->>'expectedQualifierCount')::integer or (select count(distinct x->>'participantId')from jsonb_array_elements(regular)x)<>jsonb_array_length(regular) or (select sum((x->>'amountMinor')::numeric)from jsonb_array_elements(regular)x)<>(calc->>'roundedBudgetMinor')::numeric then return jsonb_build_object('status','blocked','code','regular_awards_unavailable','accountingAvailable',false,'moneyMoved',false);end if;
 for policy in select value from jsonb_array_elements(s->'poolWorkspace'->'policies') loop
  kind:=policy->>'kind';
  select coalesce(jsonb_agg(jsonb_build_object('participantId',r.participant_id,'gamePoints',r.game_points,'gamesWon',r.games_won,'plusPoints',r.plus_points,'qualified',r.qualification_status='qualified','qualificationRank',case when r.qualification_status='qualified' then r.ranking_ordinal else null end)order by r.participant_id),'[]') into cards
   from jsonb_array_elements(s->'sources')src cross join lateral jsonb_array_elements(coalesce(src->'eventComponents'->kind,'[]'))component
   join app.event_participants ep on ep.tournament_id=tid and ep.event_id=eid and ep.roster_entry_id::text=src->>'rosterEntryId'
   join app.qualification_result_rows r on r.result_version_id=q.id and r.participant_id=ep.id
   where component->>'policyId'=policy->>'policyId';
  select coalesce(jsonb_agg(jsonb_build_object('receiptId',src->'receiptId','electionId',component->'electionId','amountMinor',component->'amountMinor')order by src->>'receiptId'),'[]') into components from jsonb_array_elements(s->'sources')src cross join lateral jsonb_array_elements(coalesce(src->'eventComponents'->kind,'[]'))component where component->>'policyId'=policy->>'policyId';
  if jsonb_array_length(cards)<>jsonb_array_length(components) or exists(select 1 from jsonb_array_elements(components)x where (x->>'amountMinor')::bigint<>(policy->>'feeMinor')::bigint) then return jsonb_build_object('status','blocked','code','pool_paid_sources_incomplete','accountingAvailable',false,'moneyMoved',false);end if;
  pool:=app.calculate_multi_event_pool_awards_v1(kind,policy->>'method',nullif(policy->>'ratio','')::integer,(policy->>'feeMinor')::bigint,cards);
  if pool->>'status' is distinct from'calculated' then return jsonb_build_object('status','blocked','code','pool_calculation_blocked','policyId',policy->'policyId','detail',pool,'accountingAvailable',false,'moneyMoved',false);end if;
  pooltotal:=pooltotal+(pool->>'fundMinor')::numeric;
  pools:=pools||jsonb_build_array(jsonb_build_object('policyId',policy->'policyId','poolDefinitionId',policy->'poolDefinitionId','kind',kind,'sourceComponents',components,'calculation',pool));
 end loop;
 if pooltotal<>(s->>'qIncomeMinor')::numeric+(s->>'sideIncomeMinor')::numeric then return jsonb_build_object('status','blocked','code','pool_conservation_failed','accountingAvailable',false,'moneyMoved',false);end if;
 manifest:=jsonb_build_object('version','multi-event-award-preview-v1','financialSourceDigest',s->'sourceDigest','binding',to_jsonb(binding),'declaration',to_jsonb(rule),'qualification',to_jsonb(q),'playoffSource',source,'mrp',mrp,'pools',pools,'regularCalculation',calc,'regularAwards',regular);
 return jsonb_build_object('status','preview','eventId',eid,'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'financialSourceDigest',s->'financialSourceDigest','baseIncomeMinor',s->'baseIncomeMinor','qIncomeMinor',s->'qIncomeMinor','sideIncomeMinor',s->'sideIncomeMinor','expenseMinor',s->'expenseMinor','benefitMinor',s->'classifiedExpenses'->'benefitMinor','requiredFundingMinor',calc->'requiredFundingMinor','restrictedResidualMinor',calc->'restrictedBalanceMinor','regularAwards',regular,'pools',pools,'accountingAvailable',false,'moneyMoved',false);
end$$;
revoke all on function public.get_multi_event_award_preview_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_multi_event_award_preview_v1(uuid,uuid,uuid)to service_role;
commit;
