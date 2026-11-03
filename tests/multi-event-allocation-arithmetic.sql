-- Isolated disposable PostgreSQL only; no hosted database or money records.
do $$
declare sources jsonb := '[{"kind":"roster_receipt","id":"10000000-0000-4000-8000-000000000001","amountMinor":6000},{"kind":"expense","id":"10000000-0000-4000-8000-000000000002","amountMinor":3000},{"kind":"side_election","id":"10000000-0000-4000-8000-000000000003","amountMinor":1000}]';
lines jsonb := '[{"sourceKind":"roster_receipt","sourceId":"10000000-0000-4000-8000-000000000001","eventId":"20000000-0000-4000-8000-000000000001","component":"base","componentId":null,"amountMinor":5000},{"sourceKind":"roster_receipt","sourceId":"10000000-0000-4000-8000-000000000001","eventId":"20000000-0000-4000-8000-000000000001","component":"q","componentId":"30000000-0000-4000-8000-000000000001","amountMinor":1000},{"sourceKind":"expense","sourceId":"10000000-0000-4000-8000-000000000002","eventId":"20000000-0000-4000-8000-000000000001","component":"expense","componentId":null,"amountMinor":2000},{"sourceKind":"expense","sourceId":"10000000-0000-4000-8000-000000000002","eventId":"20000000-0000-4000-8000-000000000002","component":"expense","componentId":null,"amountMinor":1000},{"sourceKind":"side_election","sourceId":"10000000-0000-4000-8000-000000000003","eventId":"20000000-0000-4000-8000-000000000001","component":"side","componentId":"40000000-0000-4000-8000-000000000001","amountMinor":1000}]';
begin
 if app.multi_event_allocation_arithmetic_v1(sources,lines) is distinct from true then raise exception 'valid allocation rejected'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,lines-4) is not false then raise exception 'missing source accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,lines || jsonb_build_array(lines->0)) is not false then raise exception 'duplicate component accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources || jsonb_build_array(sources->0),lines) is not false then raise exception 'duplicate source accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{0,amountMinor}','4999')) is not false then raise exception 'unallocated money accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{0,amountMinor}','5001')) is not false then raise exception 'overspend accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{0,component}','null')) is not false then raise exception 'null component accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{4,sourceKind}','"roster_receipt"')) is not false then raise exception 'wrong source type accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{1,componentId}','null')) is not false then raise exception 'missing pool id accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{0,eventId}','"BAD"')) is not false then raise exception 'invalid event accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{0,sourceId}','"10000000-0000-4000-8000-000000000099"')) is not false then raise exception 'orphan allocation accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1(sources,jsonb_set(lines,'{0,amountMinor}','1.5')) is not false then raise exception 'fractional cents accepted'; end if;
 if app.multi_event_allocation_arithmetic_v1('[]','[]') is distinct from true then raise exception 'empty ledger arithmetic rejected'; end if;
 if has_function_privilege('anon','app.multi_event_allocation_arithmetic_v1(jsonb,jsonb)','execute') or has_function_privilege('authenticated','app.multi_event_allocation_arithmetic_v1(jsonb,jsonb)','execute') or has_function_privilege('service_role','app.multi_event_allocation_arithmetic_v1(jsonb,jsonb)','execute') then raise exception 'unintended execute grant'; end if;
end $$;
