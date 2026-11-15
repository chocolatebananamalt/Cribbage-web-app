-- PRIVATE LOCAL CANDIDATE. No journal/schema installation, grant or recipient authority.
create function app.native_mixed_pool_amounts_v1(policy jsonb,paid_count integer,recipient_count integer)returns jsonb
language plpgsql immutable set search_path=''as $$
declare kind text;method text;fee numeric;ratio numeric;unit numeric;fund numeric;k integer;d numeric;den numeric;num numeric;raw jsonb:='[]';
 amounts numeric[]:='{}';rem numeric[]:='{}';nums numeric[]:='{}';dens numeric[]:='{}';total numeric:=0;missing integer;i integer;j integer;branch text;
 a numeric;b numeric;t numeric;each_amount numeric;key text;code text;
begin
 if jsonb_typeof(policy)is distinct from'object'then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 if(select count(*)from jsonb_object_keys(policy))<>6 or not(policy?&array['version','kind','method','feeMinor','ratio','roundingUnitMinor'])then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 kind:=policy->>'kind';method:=policy->>'method';
 if policy->>'version'is distinct from'native-mixed-pool-policy-v1'or kind is null or kind not in('q','side')or jsonb_typeof(policy->'feeMinor')is distinct from'number'or jsonb_typeof(policy->'roundingUnitMinor')is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 fee:=(policy->>'feeMinor')::numeric;unit:=(policy->>'roundingUnitMinor')::numeric;
 if fee<>trunc(fee)or abs(fee)>9007199254740991 or unit not in(100,500,1000)then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 if paid_count is null or paid_count not between 1 and 10000 or recipient_count is null or recipient_count not between 1 and paid_count then return jsonb_build_object('status','blocked','code','invalid_counts');end if;
 k:=recipient_count;fund:=paid_count::numeric*fee;
 if method='q-equal-exact-selected-step-v1'then
  if kind<>'q'or policy->'ratio'is distinct from'null'::jsonb or fee not between 100 and 100000000 or mod(fee,100)<>0 then return jsonb_build_object('status','blocked','code','invalid_equal_policy');end if;
  if mod(fund,k::numeric*unit)<>0 then return jsonb_build_object('status','blocked','code','equal_split_not_exact');end if;
  branch:='equal';each_amount:=(fund/k)::bigint;
  for j in 1..k loop amounts:=array_append(amounts,each_amount);nums:=array_append(nums,each_amount);dens:=array_append(dens,1);end loop;
 else
  if jsonb_typeof(policy->'ratio')is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_ratio_or_recipient_count');end if;
  ratio:=(policy->>'ratio')::numeric;
  if ratio<>trunc(ratio)or ratio not between 1 and 2147483647 then return jsonb_build_object('status','blocked','code','invalid_ratio_or_recipient_count');end if;
  if k<>ceil(paid_count::numeric/ratio)then return jsonb_build_object('status','blocked','code','invalid_ratio_or_recipient_count');end if;
  if kind='q'and method='q-v3-raw-selected-step-v1'then
   if fee not between 500 and 100000000 then return jsonb_build_object('status','blocked','code','unsupported_fee');end if;
   if mod(fee,500)<>0 then return jsonb_build_object('status','blocked','code','unsupported_lattice');end if;
   if mod(fund,unit)<>0 then return jsonb_build_object('status','blocked','code','fund_not_divisible_by_step');end if;
   d:=k::numeric*(k+1)/2;
   branch:=case when k=1 then'single_recipient'when fund>d*fee then'descending_linear'else'entry_fee_floor'end;
  elsif kind='side'and method='side-sheet20-40-selected-step-v1'then
   if fee not in(1000,2000,5000,10000)then return jsonb_build_object('status','blocked','code','unverified_fee_tab');end if;
   if k>(case when fee=1000 then 56 else 128 end)then return jsonb_build_object('status','blocked','code','verified_weight_row_capacity_exceeded');end if;
   if mod(fund,unit)<>0 then return jsonb_build_object('status','blocked','code','fund_not_divisible_by_increment');end if;
   d:=k::numeric*(k+1)/2;branch:=case when fund>4000*d then'descending_linear'else'fixed_20_dollar_baseline'end;
   if branch='fixed_20_dollar_baseline'and fund<2000*k then return jsonb_build_object('status','blocked','code','fund_below_sheet_baseline');end if;
   if branch='fixed_20_dollar_baseline'and k=1 then return jsonb_build_object('status','blocked','code','one_recipient_baseline_formula_unverified');end if;
  else return jsonb_build_object('status','blocked','code','method_kind_mismatch');end if;
  for j in 1..k loop
   if branch='single_recipient'then num:=fund;den:=1;
   elsif branch='descending_linear'then num:=fund*(k-j+1);den:=d;
   else den:=d-k;num:=(case when kind='q'then fee else 2000 end)*den+(fund-(case when kind='q'then fee else 2000 end)*k)*(k-j);end if;
   amounts:=array_append(amounts,floor(num/(den*unit))*unit);rem:=array_append(rem,mod(num,den*unit));total:=total+amounts[j];
   a:=num;b:=den;while b<>0 loop t:=mod(a,b);a:=b;b:=t;end loop;nums:=array_append(nums,num/a);dens:=array_append(dens,den/a);
  end loop;
  if total>fund or mod(fund-total,unit)<>0 then return jsonb_build_object('status','blocked','code','unsupported_conservation');end if;
  missing:=((fund-total)/unit)::integer;if missing<0 or missing>=k then return jsonb_build_object('status','blocked','code','unsupported_conservation');end if;
  -- Every raw denominator within this branch is shared; exact remainder order.
  for i in select x from generate_subscripts(rem,1)x order by rem[x]desc,x limit missing loop amounts[i]:=amounts[i]+unit;end loop;
  if(select sum(x)from unnest(amounts)x)<>fund or exists(select 1 from generate_subscripts(amounts,1)x where amounts[x]<(case when kind='q'then fee else 2000 end)or mod(amounts[x],unit)<>0 or(x>1 and amounts[x]>amounts[x-1]))then
   code:=case when kind='q'then'rounding_below_fee_floor'else'selected_increment_violates_baseline_or_order'end;return jsonb_build_object('status','blocked','code',code);end if;
 end if;
 select jsonb_agg(jsonb_build_object('numeratorMinor',trunc(nums[x])::text,'denominator',trunc(dens[x])::text)order by x)into raw from generate_subscripts(nums,1)x;
 return jsonb_build_object('status','calculated','calculationVersion','native-mixed-pool-amounts-v1','amountPolicy',policy,'paidCount',paid_count,'recipientCount',k,'fundMinor',fund,'roundingUnitMinor',unit,'branch',branch,'awardsMinor',to_jsonb(amounts),'unroundedAwards',raw,'refunds','[]'::jsonb,'recipientSelectionPerformed',false,'financialFinalizationAllowed',false,'moneyMoved',false);
end$$;
alter function app.native_mixed_pool_amounts_v1(jsonb,integer,integer)owner to postgres;
revoke all on function app.native_mixed_pool_amounts_v1(jsonb,integer,integer)from public,anon,authenticated,service_role;
