-- LOCAL proposal. Pure director-approved app rounding; no financial writer.
-- Exact parity with src/lib/results/regular-prize-rounding-v3.ts.
begin;
create function app.calculate_regular_prize_rounding_v3(p_input jsonb)
returns jsonb language plpgsql immutable set search_path='' as $function$
declare
 gross numeric; expense numeric; benefit numeric; budget numeric; minimum numeric; target numeric; down numeric; delta numeric;
 expected integer; total integer; c integer; d integer; maximum integer; s integer; second integer; first integer; i integer; j integer; k integer; parity integer; offset_n integer;
 cohorts jsonb; item jsonb; result_cohorts jsonb:='[]'; awards jsonb:='[]'; raw_fraction jsonb; deviation_fraction jsonb;
 weights numeric[]:='{}'; mult integer[]; raw numeric[]:='{}'; divisor numeric:=0; cost numeric; best_cost numeric; values_n integer[]; best_values integer[];
 candidates integer[]; pair_options integer[]; root_n numeric[]; root_d numeric[]; q numeric; a numeric; b numeric; remainder_n numeric; numerator_n numeric; denominator_n numeric;
begin
 if jsonb_typeof(p_input)is distinct from'object'then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 if(select count(*)from jsonb_object_keys(p_input))<>5 or not(p_input?&array['grossBaseIncomeMinor','expenseTotalMinor','benefitExpenseMinor','expectedQualifierCount','cohorts'])then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 foreach item in array array[p_input->'grossBaseIncomeMinor',p_input->'expenseTotalMinor',p_input->'benefitExpenseMinor']loop
  if jsonb_typeof(item)is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_input');end if;
  a:=(item#>>'{}')::numeric;if a<>trunc(a)or a<0 or a>9007199254740991 then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 end loop;
 gross:=(p_input->>'grossBaseIncomeMinor')::numeric;expense:=(p_input->>'expenseTotalMinor')::numeric;benefit:=(p_input->>'benefitExpenseMinor')::numeric;
 if gross<1 then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 if p_input->'expectedQualifierCount'not in('4'::jsonb,'5'::jsonb)then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
 expected:=(p_input->>'expectedQualifierCount')::integer;cohorts:=p_input->'cohorts';
 if jsonb_typeof(cohorts)is distinct from'array'then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
 if jsonb_array_length(cohorts)<>(case when expected=4 then 3 else 4 end) then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
 mult:=case when expected=4 then array[1,1,2]else array[1,1,2,1]end;
 for i in 1..array_length(mult,1)loop
  item:=cohorts->(i-1);
  if jsonb_typeof(item)is distinct from'object'then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
  if(select count(*)from jsonb_object_keys(item))<>3 or not(item?&array['bandStart','bandEnd','weight'])or item->'bandStart'is distinct from to_jsonb(case when i=4 then 5 else i end)or item->'bandEnd'is distinct from to_jsonb(case when i=3 then 4 when i=4 then 5 else i end)or jsonb_typeof(item->'weight')is distinct from'number'then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
  a:=(item->>'weight')::numeric;if a<>trunc(a)or a<1 or a>9007199254740991 then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
  weights:=array_append(weights,a);divisor:=divisor+a*mult[i];
 end loop;
 if expense>gross or benefit>expense then return jsonb_build_object('status','blocked','code','invalid_financial_basis');end if;
 budget:=gross-expense;minimum:=div(85*gross+99,100);down:=div(budget,500)*500;
 target:=case when down+benefit>=minimum then down else div(budget+499,500)*500 end;
 if target>10000000 then return jsonb_build_object('status','blocked','code','unsupported_computational_domain');end if;
 if target<expected*500 then return jsonb_build_object('status','blocked','code','insufficient_award_budget');end if;
 if target+benefit<minimum then return jsonb_build_object('status','blocked','code','minimum_return_unmet');end if;
 if target+benefit>9007199254740991 then return jsonb_build_object('status','blocked','code','unsafe_result');end if;
 total:=(target/500)::integer;for i in 1..array_length(mult,1)loop raw:=array_append(raw,total*weights[i]);end loop;
 -- Enumerate only shared semifinal award c (<=5,000). For fixed c, all
 -- remaining branch minima occur at an endpoint/root; equal top-place bounds
 -- split into two parities. Integer division is exact even for huge weights.
 for c in 1..((total-case when expected=5 then 1 else 0 end)/4)loop
  if expected=4 then candidates:=array[0];else
   maximum:=least(c,total-4*c);candidates:='{}';
   root_n:=array[1::numeric,maximum::numeric,raw[4],(total-3*c)*divisor-raw[1]];root_d:=array[1::numeric,1::numeric,divisor,divisor];
   for parity in 0..1 loop root_n:=root_n||array[(total-2*c+parity)*divisor-2*raw[1],(total-2*c-parity)*divisor-2*raw[2]];root_d:=root_d||array[divisor,divisor];end loop;
   foreach second in array array[div(raw[2],divisor)::integer,div(raw[2]+divisor-1,divisor)::integer]loop root_n:=root_n||array[(total-2*c-2*second)::numeric,(total-2*c-second)*divisor-raw[1]];root_d:=root_d||array[1::numeric,divisor];end loop;
   foreach first in array array[div(raw[1],divisor)::integer,div(raw[1]+divisor-1,divisor)::integer]loop root_n:=root_n||array[(total-2*c-2*first)::numeric,(total-3*c-first)::numeric,(total-2*c-first)*divisor-raw[2]];root_d:=root_d||array[1::numeric,1::numeric,divisor];end loop;
   for j in 1..array_length(root_n,1)loop
    q:=div(root_n[j],root_d[j]);if root_n[j]<0 and mod(root_n[j],root_d[j])<>0 then q:=q-1;end if;
    for offset_n in -2..2 loop k:=q::integer+offset_n;if k>=1 and k<=maximum then candidates:=array_append(candidates,k);end if;end loop;
   end loop;
   select array_agg(distinct value)into candidates from unnest(candidates)value;
  end if;
  foreach d in array candidates loop
   s:=total-2*c-d;
   pair_options:=array[c,s/2,div(raw[2],divisor)::integer,div(raw[2]+divisor-1,divisor)::integer,s-div(raw[1]+divisor-1,divisor)::integer,s-div(raw[1],divisor)::integer];
   foreach second in array pair_options loop
    first:=s-second;if second<c or first<second then continue;end if;
    values_n:=case when expected=4 then array[first,second,c]else array[first,second,c,d]end;
    cost:=0;for i in 1..array_length(mult,1)loop cost:=cost+mult[i]*abs(values_n[i]*divisor-raw[i]);end loop;
    if best_cost is null or cost<best_cost or(cost=best_cost and values_n>best_values)then best_cost:=cost;best_values:=values_n;end if;
   end loop;
  end loop;
 end loop;
 if best_values is null then return jsonb_build_object('status','blocked','code','insufficient_award_budget');end if;
 for i in 1..array_length(mult,1)loop
  numerator_n:=target*weights[i];a:=numerator_n;b:=divisor;while b<>0 loop remainder_n:=mod(a,b);a:=b;b:=remainder_n;end loop;
  raw_fraction:=jsonb_build_object('numeratorMinor',div(numerator_n,a)::text,'denominator',div(divisor,a)::text);
  numerator_n:=abs(best_values[i]*500*divisor-target*weights[i]);a:=numerator_n;b:=divisor;while b<>0 loop remainder_n:=mod(a,b);a:=b;b:=remainder_n;end loop;
  deviation_fraction:=jsonb_build_object('numeratorMinor',div(numerator_n,a)::text,'denominator',div(divisor,a)::text);
  result_cohorts:=result_cohorts||jsonb_build_array((cohorts->(i-1))||jsonb_build_object('recipientCount',mult[i],'awardMinor',best_values[i]*500,'rawAward',raw_fraction,'absoluteDeviation',deviation_fraction));
  for j in 1..mult[i]loop awards:=awards||jsonb_build_array(best_values[i]*500);end loop;
 end loop;
 numerator_n:=best_cost*500;a:=numerator_n;b:=divisor;while b<>0 loop remainder_n:=mod(a,b);a:=b;b:=remainder_n;end loop;
 delta:=target-budget;
 return jsonb_build_object('status','calculated','policyVersion','regular-prize-cohort-5usd-v3','currency','USD','amountBasis','total_award','expectedQualifierCount',expected,
 'grossBaseIncomeMinor',gross,'expenseTotalMinor',expense,'benefitExpenseMinor',benefit,'originalBudgetMinor',budget,'roundedBudgetMinor',target,'roundingUnitMinor',500,
 'direction',case when delta>0 then'up'when delta<0 then'down'else'unchanged'end,'adjustmentMinor',delta,'requiredFundingMinor',greatest(delta,0),'restrictedBalanceMinor',greatest(-delta,0),
 'minimumReturnMinor',minimum,'participantReturnMinor',target+benefit,'awardsMinor',awards,'cohorts',result_cohorts,'objective',jsonb_build_object('numeratorMinor',div(numerator_n,a)::text,'denominator',div(divisor,a)::text));
end;
$function$;
alter function app.calculate_regular_prize_rounding_v3(jsonb) owner to postgres;
revoke all on function app.calculate_regular_prize_rounding_v3(jsonb)from public,anon,authenticated,service_role;
comment on function app.calculate_regular_prize_rounding_v3(jsonb)is'Pure app regular-prize rounding: positive $5 awards, equal cohorts, exact L1/lex optimum, explicit $100k target limit; no funding or payment certification.';
commit;
