-- Pure fictional local tests. No verified qualification or payout is implied.
begin;
do $$declare cards jsonb;r jsonb;i integer;begin
 select jsonb_agg(jsonb_build_object('participantId',('a2810000-0000-4000-8000-'||lpad(n::text,12,'0')),'gamePoints',40-2*n,'gamesWon',20-n,'plusPoints',1000-n,'qualified',n<=3,'qualificationRank',case when n<=3 then n else null end) order by n) into cards from generate_series(1,16)n;
 if app.calculate_multi_event_pool_awards_v1(null,'graduated-acc-weighted-largest-remainder-5usd-v2',4,1000,cards)->>'code'<>'unsupported_pool_input' or app.calculate_multi_event_pool_awards_v1('q',null,4,1000,cards)->>'code'<>'unsupported_pool_input' then raise exception 'NULL policy accepted';end if;
 if app.calculate_multi_event_pool_awards_v1('q','graduated-acc-weighted-largest-remainder-5usd-v2',4,1000,jsonb_set(cards,'{0,gamePoints}','1'))->>'code'<>'invalid_pool_card' then raise exception 'Invalid score relationship accepted';end if;
 r:=app.calculate_multi_event_pool_awards_v1('q','graduated-acc-weighted-largest-remainder-5usd-v2',4,1000,cards);
 if r->>'status'<>'calculated' or r->>'fundMinor'<>'16000' or (select jsonb_agg((x->>'amountMinor')::integer order by ord)from jsonb_array_elements(r->'awards')with ordinality t(x,ord))<>'[6500,5000,3000,1500]'::jsonb or r->'awards'->3->>'participantId'<>'a2810000-0000-4000-8000-000000000004' then raise exception 'funded backfill calculation %',r;end if;
 r:=app.calculate_multi_event_pool_awards_v1('q','equal-paid-playoff-qualifiers-v2',null,1000,cards);
 if r->>'code'<>'equal_pool_not_whole_five' then raise exception 'fractional equal award accepted %',r;end if;
 r:=app.calculate_multi_event_pool_awards_v1('side','graduated-acc-weighted-largest-remainder-5usd-v2',4,1000,jsonb_set(cards,'{3,gamePoints}',cards->2->'gamePoints'));
 -- Match all three criteria to make a real unresolved tie at a paid place.
 cards:=jsonb_set(jsonb_set(jsonb_set(cards,'{3,gamePoints}',cards->2->'gamePoints'),'{3,gamesWon}',cards->2->'gamesWon'),'{3,plusPoints}',cards->2->'plusPoints');
 r:=app.calculate_multi_event_pool_awards_v1('side','graduated-acc-weighted-largest-remainder-5usd-v2',4,1000,cards);
 if r->>'code'<>'pool_tie_resolution_required' then raise exception 'unresolved tie accepted %',r;end if;
 if has_function_privilege('authenticated','app.calculate_multi_event_pool_awards_v1(text,text,integer,bigint,jsonb)','execute')then raise exception 'private kernel exposed';end if;
end$$;
rollback;
