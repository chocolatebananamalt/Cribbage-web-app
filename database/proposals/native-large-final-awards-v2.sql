-- UNEXECUTED private source extension; requires verified large-field provenance.
-- No row/schema changes, grants, payout or gate enablement. V1 $5 methods only.
begin;
create function app.native_large_final_awards_enabled_v2()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
alter function app.native_large_final_awards_enabled_v2()owner to postgres;
revoke all on function app.native_large_final_awards_enabled_v2()from public,anon,authenticated,service_role;
do $patch$declare oidv oid:=to_regprocedure('app.native_playoff_final_award_source_v1(uuid,uuid,uuid)');body text;old text;new text;begin
 if to_regprocedure('app.playoff_series_chart_slots_v2(integer)')is null or oidv is null or not exists(select 1 from pg_proc where oid=oidv and proowner='postgres'::regrole and prosecdef)then raise exception 'trusted large-field prerequisites missing';end if;
 body:=pg_get_functiondef(oidv);
old:='if qualifier_count not in(4,5)then';new:='if qualifier_count<4 or qualifier_count>64 or(qualifier_count>5 and not app.native_large_final_awards_enabled_v2())then';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'final award source incompatible';end if;body:=replace(body,old,new);
old:='     if(match_row->>''round'')=''semifinal''then place_first:=3;place_last:=4;
     elsif qualifier_count=5 and(match_row->>''slot'')::integer=1 then place_first:=5;place_last:=5;end if;';new:='     -- Same-round losers form one equal finishing cohort; byes are not games.
     declare nodes jsonb:=app.playoff_series_chart_slots_v2(qualifier_count);node jsonb;last_round integer;round_index integer;begin
      node:=nodes->((match_row->>''slot'')::integer-1);last_round:=(nodes->(jsonb_array_length(nodes)-1)->>''roundNumber'')::integer;round_index:=(node->>''roundNumber'')::integer;
      if node is null or round_index>=last_round then return jsonb_build_object(''status'',''blocked'',''code'',''recipient_mapping_incomplete'');end if;
      place_first:=power(2,last_round-round_index)::integer+1;
      place_last:=least(qualifier_count,power(2,last_round-round_index+1)::integer);
     end;';if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'final award source incompatible';end if;body:=replace(body,old,new);
execute replace(body,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');end$patch$;
commit;
