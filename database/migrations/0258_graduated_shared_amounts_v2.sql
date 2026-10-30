-- LOCAL proposal: pure shared graduated amount policy; no wrapper or record changes.
-- Observed ACC raw weights plus application-owned exact largest-remainder $5
-- rounding. Eligibility, ties, obligations and payments are outside this function.
begin;
create function app.calculate_graduated_pool_amounts_v2(p_input jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare n integer;fee bigint;r integer;k integer;fund bigint;d bigint;den bigint;num bigint;j integer;i integer;
 branch text;amounts bigint[]:='{}';remainders bigint[]:='{}';numerators bigint[]:='{}';denominators bigint[]:='{}';raw jsonb;total bigint:=0;missing integer;
 a bigint;b bigint;t bigint;g bigint;key text;
begin
 if jsonb_typeof(p_input)is distinct from'object'then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 if(select count(*)from jsonb_object_keys(p_input))<>3 or not(p_input?&array['paidCount','feeMinor','ratio'])then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 foreach key in array array['paidCount','feeMinor','ratio']loop
  if jsonb_typeof(p_input->key)is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_input');end if;
  if(p_input->>key)::numeric<>trunc((p_input->>key)::numeric)or abs((p_input->>key)::numeric)>9007199254740991 then return jsonb_build_object('status','blocked','code','invalid_input');end if;
 end loop;
 if(p_input->>'paidCount')::numeric not between 1 and 10000 then return jsonb_build_object('status','blocked','code','unsupported_paid_count');end if;
 if(p_input->>'feeMinor')::numeric not between 500 and 100000000 then return jsonb_build_object('status','blocked','code','unsupported_fee');end if;
 if(p_input->>'ratio')::numeric not between 2 and 100 then return jsonb_build_object('status','blocked','code','unsupported_ratio');end if;
 if mod((p_input->>'feeMinor')::numeric,500)<>0 then return jsonb_build_object('status','blocked','code','unsupported_lattice');end if;
 n:=(p_input->>'paidCount')::numeric::integer;fee:=(p_input->>'feeMinor')::numeric::bigint;r:=(p_input->>'ratio')::numeric::integer;
 fund:=n::bigint*fee;k:=(n+r-1)/r;d:=k::bigint*(k+1)/2;
 if fund<k*fee then return jsonb_build_object('status','blocked','code','fund_below_fee_floor');end if;
 branch:=case when k=1 then'single_recipient'when fund>d*fee then'descending_linear'else'entry_fee_floor'end;
 for j in 1..k loop
  if k=1 then num:=fund;den:=1;
  elsif branch='descending_linear'then num:=fund*(k-j+1);den:=d;
  else den:=d-k;num:=fee*den+(fund-fee*k)*(k-j);end if;
  amounts:=array_append(amounts,(num/(den*500))*500);remainders:=array_append(remainders,mod(num,den*500));total:=total+amounts[j];
  a:=num;b:=den;while b<>0 loop t:=mod(a,b);a:=b;b:=t;end loop;g:=a;
  numerators:=array_append(numerators,num/g);denominators:=array_append(denominators,den/g);
 end loop;
 if total>fund or mod(fund-total,500)<>0 then raise exception 'Graduated pool floor invariant failed';end if;
 missing:=((fund-total)/500)::integer;if missing<0 or missing>=k then raise exception 'Graduated pool remainder invariant failed';end if;
 -- The raw denominator is shared within each branch. Integer remainders alone
 -- give exact priority; equal remainders favor the higher finishing place.
 for i in select x from generate_subscripts(remainders,1)x order by remainders[x]desc,x limit missing loop amounts[i]:=amounts[i]+500;end loop;
 if(select sum(x)from unnest(amounts)x)<>fund or exists(select 1 from generate_subscripts(amounts,1)x where amounts[x]<fee or amounts[x]<=0 or mod(amounts[x],500)<>0 or(x>1 and amounts[x]>amounts[x-1]))then raise exception 'Graduated pool conservation/order/fee-floor invariant failed';end if;
 select jsonb_agg(jsonb_build_object('numeratorMinor',numerators[x]::text,'denominator',denominators[x]::text)order by x)into raw from generate_subscripts(numerators,1)x;
 return jsonb_build_object('status','calculated','policyVersion','graduated-acc-weighted-largest-remainder-5usd-v2','currency','USD','paidCount',n,'feeMinor',fee,'ratio',r,'recipientCount',k,'fundMinor',fund,'roundingUnitMinor',500,'branch',branch,'moneyMoved',false,'awardsMinor',to_jsonb(amounts),'unroundedAwards',raw);
end$$;
revoke all on function app.calculate_graduated_pool_amounts_v2(jsonb)from public,anon,authenticated,service_role;
commit;
