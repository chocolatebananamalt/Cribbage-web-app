-- UNEXECUTED closed source candidate. Preserve all existing match/game rows.
begin;
create function app.playoff_series_large_fields_enabled_v2()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
create function app.playoff_series_chart_slots_v2(q integer)returns jsonb language plpgsql immutable set search_path=''as $chart$
declare seeds integer[];feeds jsonb:='[]';next_feeds jsonb;nodes jsonb:='[]';a jsonb;b jsonb;i integer;round_no integer:=1;rounds integer;slot_no integer;size integer;begin
 if q is null or q<4 or q>64 then return null;end if;
 size:=case when q<=4 then 4 when q<=8 then 8 when q<=16 then 16 when q<=32 then 32 else 64 end;
 case size
 when 4 then seeds:=array[1,4,2,3];
 when 8 then seeds:=array[1,8,4,5,3,6,2,7];
 when 16 then seeds:=array[1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15];
 when 32 then seeds:=array[1,32,16,17,9,24,8,25,5,28,12,21,13,20,4,29,3,30,14,19,11,22,6,27,7,26,10,23,15,18,2,31];
 when 64 then seeds:=array[1,64,32,33,16,49,17,48,9,56,24,41,25,40,8,57,5,60,28,37,12,53,21,44,13,52,20,45,29,36,4,61,3,62,30,35,14,51,19,46,11,54,22,43,27,38,6,59,7,58,26,39,10,55,23,42,15,50,18,47,31,34,2,63];
 end case;
 rounds:=case size when 4 then 2 when 8 then 3 when 16 then 4 when 32 then 5 else 6 end;
 foreach i in array seeds loop feeds:=feeds||jsonb_build_array(jsonb_build_object('seed',case when i<=q then i else null end,'parentSlot',null));end loop;
 while jsonb_array_length(feeds)>1 loop
  next_feeds:='[]';
  for i in 0..jsonb_array_length(feeds)/2-1 loop
   a:=feeds->(i*2);b:=feeds->(i*2+1);
   if a->'seed'='null'::jsonb and a->'parentSlot'='null'::jsonb then next_feeds:=next_feeds||jsonb_build_array(b);
   elsif b->'seed'='null'::jsonb and b->'parentSlot'='null'::jsonb then next_feeds:=next_feeds||jsonb_build_array(a);
   else slot_no:=jsonb_array_length(nodes)+1;
    nodes:=nodes||jsonb_build_array(jsonb_build_object('slot',slot_no,'bracketMatchId','r'||round_no||'-m'||(i+1),'roundNumber',round_no,'round',case when round_no=rounds then'final'when round_no=rounds-1 then'semifinal'else'regular'end,'sides',jsonb_build_array(a,b)));
    next_feeds:=next_feeds||jsonb_build_array(jsonb_build_object('seed',null,'parentSlot',slot_no));
   end if;
  end loop;feeds:=next_feeds;round_no:=round_no+1;
 end loop;
 if jsonb_array_length(nodes)<>q-1 then return null;end if;return nodes;
end$chart$;
alter function app.playoff_series_large_fields_enabled_v2()owner to postgres;
alter function app.playoff_series_chart_slots_v2(integer)owner to postgres;
revoke all on function app.playoff_series_large_fields_enabled_v2(),app.playoff_series_chart_slots_v2(integer)from public,anon,authenticated,service_role;
-- Only the four existing small-slot CHECKs are broadened; no rows or hashes
-- change. Roll back atomically on any unexpected catalog shape.
do $constraints$declare t text;c record;found_count integer;begin
 foreach t in array array['playoff_series_matches_v1','playoff_series_generations_v1','playoff_series_game_operations_v1','playoff_series_game_operation_conflicts_v1']loop
  found_count:=0;
  for c in select conname from pg_constraint where conrelid=to_regclass('app.'||t)and contype='c'and regexp_replace(pg_get_constraintdef(oid),'[ ()]','','g')='CHECKslot>=1ANDslot<=4'loop
   found_count:=found_count+1;execute format('alter table app.%I drop constraint %I',t,c.conname);
  end loop;
  if found_count<>1 then raise exception 'unexpected playoff slot constraints';end if;
  execute format('alter table app.%I add constraint %I check(slot between 1 and 63)',t,t||'_slot_v2_check');
 end loop;
end$constraints$;
do $patch$declare oidv oid:=to_regprocedure('app.playoff_series_match_source_v1(uuid,uuid,uuid,integer)');body text;old text;new text;begin
 if oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'missing trusted series function';end if;body:=pg_get_functiondef(oidv);
old:='if q.qualifier_count not in(4,5)then';new:='if q.qualifier_count<4 or q.qualifier_count>64 or(q.qualifier_count>5 and not app.playoff_series_large_fields_enabled_v2())then';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'series source incompatible';end if;body:=replace(body,old,new);
old:=' if q.qualifier_count=4 then
  if slot_no=1 then x:=ids[1];y:=ids[4];round_name:=''semifinal'';
  elsif slot_no=2 then x:=ids[2];y:=ids[3];round_name:=''semifinal'';
  elsif slot_no=3 then parent_a:=app.playoff_series_current_result_v1(tid,eid,qid,1);parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,2);round_name:=''final'';
   if parent_a is null or parent_b is null then return jsonb_build_object(''status'',''blocked'',''code'',''parent_series_incomplete'');end if;x:=(parent_a->>''winnerId'')::uuid;y:=(parent_b->>''winnerId'')::uuid;
  else return jsonb_build_object(''status'',''blocked'',''code'',''invalid_slot'');end if;
 else
  if slot_no=1 then x:=ids[4];y:=ids[5];round_name:=''regular'';
  elsif slot_no=2 then parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,1);round_name:=''semifinal'';
   if parent_b is null then return jsonb_build_object(''status'',''blocked'',''code'',''parent_series_incomplete'');end if;x:=ids[1];y:=(parent_b->>''winnerId'')::uuid;
  elsif slot_no=3 then x:=ids[3];y:=ids[2];round_name:=''semifinal'';
  elsif slot_no=4 then parent_a:=app.playoff_series_current_result_v1(tid,eid,qid,2);parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,3);round_name:=''final'';
   if parent_a is null or parent_b is null then return jsonb_build_object(''status'',''blocked'',''code'',''parent_series_incomplete'');end if;x:=(parent_a->>''winnerId'')::uuid;y:=(parent_b->>''winnerId'')::uuid;
  else return jsonb_build_object(''status'',''blocked'',''code'',''invalid_slot'');end if;
 end if;';new:=' declare node jsonb;side jsonb;begin
  node:=app.playoff_series_chart_slots_v2(q.qualifier_count)->(slot_no-1);
  if node is null or node->>''slot''is distinct from slot_no::text then return jsonb_build_object(''status'',''blocked'',''code'',''invalid_slot'');end if;
  round_name:=node->>''round'';side:=node->''sides''->0;
  if side->>''seed''is not null then x:=ids[(side->>''seed'')::integer];else parent_a:=app.playoff_series_current_result_v1(tid,eid,qid,(side->>''parentSlot'')::integer);if parent_a is null then return jsonb_build_object(''status'',''blocked'',''code'',''parent_series_incomplete'');end if;x:=(parent_a->>''winnerId'')::uuid;end if;
  side:=node->''sides''->1;
  if side->>''seed''is not null then y:=ids[(side->>''seed'')::integer];else parent_b:=app.playoff_series_current_result_v1(tid,eid,qid,(side->>''parentSlot'')::integer);if parent_b is null then return jsonb_build_object(''status'',''blocked'',''code'',''parent_series_incomplete'');end if;y:=(parent_b->>''winnerId'')::uuid;end if;
 end;';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'series source incompatible';end if;body:=replace(body,old,new);
execute replace(body,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');end$patch$;
do $patch$declare oidv oid:=to_regprocedure('app.create_playoff_series_generation_v1(uuid,uuid,jsonb)');body text;old text;new text;begin
 if oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'missing trusted series function';end if;body:=pg_get_functiondef(oidv);
old:='(v->>''slot'')!~''^[1-4]$''';new:='(v->>''slot'')!~''^([1-9]|[1-5][0-9]|6[0-3])$''';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'series source incompatible';end if;body:=replace(body,old,new);
execute replace(body,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');end$patch$;
do $patch$declare oidv oid:=to_regprocedure('app.get_native_playoff_finance_recipient_source_v1(uuid,uuid)');body text;old text;new text;begin
 if oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'missing trusted series function';end if;body:=pg_get_functiondef(oidv);
old:='or qualification.qualifier_count not in(4,5)';new:='or qualification.qualifier_count<4 or qualification.qualifier_count>64 or(qualification.qualifier_count>5 and not app.playoff_series_large_fields_enabled_v2())';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'series source incompatible';end if;body:=replace(body,old,new);
old:='slot_count:=case qualification.qualifier_count when 4 then 3 else 4 end;';new:='slot_count:=qualification.qualifier_count-1;';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'series source incompatible';end if;body:=replace(body,old,new);
execute replace(body,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');end$patch$;
commit;
