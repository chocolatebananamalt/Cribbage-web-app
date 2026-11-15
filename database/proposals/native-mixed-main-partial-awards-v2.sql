-- PRIVATE SOURCE CANDIDATE. No new grant, gate or table. Run only after review.
-- V1 accepted rows and positive-only obligation schema remain unchanged.
begin;

-- Additional modes require this independent closed gate. Existing all/graduated
-- admission, captured source bytes and historical records are not rewritten.
create function app.native_mixed_partial_prize_enabled_v2()returns boolean
language sql stable set search_path=''as $gate$select false$gate$;
alter function app.native_mixed_partial_prize_enabled_v2() owner to postgres;
revoke all on function app.native_mixed_partial_prize_enabled_v2()from public,anon,authenticated,service_role;
do $admission$declare oidv oid:=to_regprocedure('app.native_mixed_latest_prize_pin_v1(uuid,uuid)');body text;old text;new text;begin
 if oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'missing trusted prize admission';end if;
 body:=pg_get_functiondef(oidv);
 old:=$old$or plan#>>'{draft,method}'is distinct from'graduated'or plan#>>'{draft,recipients}'is distinct from'all'$old$;
 new:=$new$or not ((plan#>>'{draft,method}'='graduated'and plan#>>'{draft,recipients}'='all')or(app.native_mixed_partial_prize_enabled_v2()and((plan#>>'{draft,method}'='winner-takes-all')or(plan#>>'{draft,method}'in('graduated','equal','winner-multiplier')and plan#>>'{draft,recipients}'in('top-2','top-4')))))$new$;
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'prize admission source incompatible';end if;
 execute replace(replace(body,old,new),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$admission$;
create function app.native_mixed_main_paid_groups_v2(source jsonb,groups jsonb)returns boolean
language plpgsql immutable set search_path=''as $body$
declare plan jsonb:=source#>'{playoffSource,capture,latestPrize,plan,draft}';paid integer;g jsonb;i integer;begin
 if source#>>'{playoffSource,capture,latestPrize,kind}'is distinct from'native-mixed-latest-prize-pin-v1' or jsonb_typeof(groups)is distinct from'array' or jsonb_array_length(groups)<>4 then return false;end if;
 if plan->>'method'='winner-takes-all'then paid:=1;
 elsif plan->>'method'in('graduated','equal','winner-multiplier')then
  paid:=case plan->>'recipients'when'all'then 5 when'top-2'then 2 when'top-4'then 4 else null end;
 else return false;end if;
 if paid is null then return false;end if;
 for i in 0..3 loop
  g:=groups->i;
  if g->'firstPlace'is distinct from ((source#>'{completion,finishingGroups}')->i)->'firstPlace'or g->'lastPlace'is distinct from((source#>'{completion,finishingGroups}')->i)->'lastPlace' or jsonb_typeof(g->'perPersonMinor')is distinct from'number'or coalesce(g->>'perPersonMinor','')!~'^(0|[1-9][0-9]{0,11})$' then return false;end if;
  if (g->>'lastPlace')::integer<=paid then if(g->>'perPersonMinor')::bigint<=0 then return false;end if;
  elsif(g->>'firstPlace')::integer<=paid or(g->>'perPersonMinor')::bigint<>0 then return false;end if;
 end loop;return true;
exception when others then return false;end$body$;
alter function app.native_mixed_main_paid_groups_v2(jsonb,jsonb) owner to postgres;
revoke all on function app.native_mixed_main_paid_groups_v2(jsonb,jsonb)from public,anon,authenticated,service_role;
do $patch$declare oidv oid:=to_regprocedure('app.native_mixed_main_finance_record_bound_v1(uuid)');body text;old text;new text;begin
 if oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'missing trusted native Main function';end if;
 body:=pg_get_functiondef(oidv);
 old:='   for i in 0..3 loop';new:='   if d#>>''{manualPolicy,version}''=''native-mixed-main-manual-whole-group-v2'' and app.native_mixed_main_paid_groups_v2(v.source_capture,d->''groups'') is distinct from true then return false;end if;
   for i in 0..3 loop';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
 old:='or coalesce(g->>''perPersonMinor'','''')!~''^[1-9][0-9]{0,11}$''';new:='or coalesce(g->>''perPersonMinor'','''')!~(case when d#>>''{manualPolicy,version}''=''native-mixed-main-manual-whole-group-v2'' then ''^(0|[1-9][0-9]{0,11})$'' else ''^[1-9][0-9]{0,11}$'' end)';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
 old:='for g in select value from jsonb_array_elements(groups)loop';new:='for g in select value from jsonb_array_elements(groups) where (value->>''perPersonMinor'')::bigint>0 loop';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
execute replace(body,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');end$patch$;
do $patch$declare oidv oid:=to_regprocedure('app.execute_native_mixed_main_finance_v1(uuid,uuid,uuid,jsonb)');body text;old text;new text;begin
 if oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'missing trusted native Main function';end if;
 body:=pg_get_functiondef(oidv);
 old:='d#>>''{manualPolicy,version}''is distinct from''native-mixed-main-manual-whole-group-v1''';new:='coalesce(d#>>''{manualPolicy,version}'','''') not in(''native-mixed-main-manual-whole-group-v1'',''native-mixed-main-manual-whole-group-v2'')';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
 old:='   groups:=''[]'';';new:='   if d#>>''{manualPolicy,version}''=''native-mixed-main-manual-whole-group-v2'' and app.native_mixed_main_paid_groups_v2(source->''capture'',d->''groups'') is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''saved_paid_places_required'');end if;
   groups:=''[]'';';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
 old:='coalesce(g->>''perPersonMinor'','''')!~''^[1-9][0-9]{0,11}$''';new:='coalesce(g->>''perPersonMinor'','''')!~(case when d#>>''{manualPolicy,version}''=''native-mixed-main-manual-whole-group-v2'' then ''^(0|[1-9][0-9]{0,11})$'' else ''^[1-9][0-9]{0,11}$'' end)';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
 old:='for g in select value from jsonb_array_elements(groups)loop';new:='for g in select value from jsonb_array_elements(groups) where (value->>''perPersonMinor'')::bigint>0 loop';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
 old:='if jsonb_array_length(recipients)<>5 or(select count(distinct x->>''participantId'')from jsonb_array_elements(recipients)x)<>5';new:='if jsonb_array_length(recipients)<1 or jsonb_array_length(recipients)>5 or(select count(distinct x->>''participantId'')from jsonb_array_elements(recipients)x)<>jsonb_array_length(recipients)';if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'native Main source incompatible';end if;body:=replace(body,old,new);
execute replace(body,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');end$patch$;
commit;
