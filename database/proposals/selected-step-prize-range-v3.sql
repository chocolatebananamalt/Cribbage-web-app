-- PRIVATE / DEFAULT OFF through the existing V3 proposal writer. Pure range
-- validation of the actual conserved ledger; optional funds are never prizes.
begin;
do $range$declare body text;old text;replacement text;begin
 if not exists(select 1 from pg_proc where oid=to_regprocedure('app.playoff_prize_proposal_range_safe_v2(jsonb,jsonb)')and proowner='postgres'::regrole)then raise exception'untrusted V3 range prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid='app.playoff_prize_proposal_range_safe_v2(jsonb,jsonb)'::regprocedure;
 old:='part->''poolId''is distinct from''null''::jsonb';replacement:='(case when part->>''bucket''in(''q'',''side'')then coalesce(part->>''poolId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''else part->''poolId''is distinct from''null''::jsonb end)';
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'V3 range pool anchor changed';end if;body:=replace(body,old,replacement);
 old:='part->>''bucket''is distinct from''regular_entry''';replacement:='coalesce(part->>''bucket'','''')not in(''regular_entry'',''q'',''side'')';
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'V3 range entry anchor changed';end if;body:=replace(body,old,replacement);
 old:='else expense_total:=expense_total+part_amount;end if;';replacement:='elsif part->>''bucket''=''operating_expense''then expense_total:=expense_total+part_amount;end if;';
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'V3 range fund anchor changed';end if;body:=replace(body,old,replacement);
 execute format('create function app.selected_step_prize_range_inner_v3(source_input jsonb,history jsonb)returns boolean language plpgsql immutable set search_path=''''as %L',body);
end$range$;
create function app.selected_step_prize_range_safe_v3(source_input jsonb,history jsonb)returns boolean language plpgsql immutable set search_path=''as $$
declare ledger jsonb:=source_input#>'{ledger,current}';eid text:=source_input#>>'{binding,eventId}';p jsonb;s jsonb;a jsonb;seen text[]:='{}';pool_ids text[]:='{}';total numeric:=0;
begin
 if ledger is distinct from source_input#>'{ledger,retained}'or ledger->>'kind'is distinct from'event-ledger-snapshot-v1'
  or ledger->>'tournamentId'is distinct from source_input#>>'{binding,tournamentId}'or ledger->'eventIds'is distinct from jsonb_build_array(eid)
  or jsonb_typeof(ledger->'pools')is distinct from'array'or jsonb_typeof(ledger->'sources')is distinct from'array'
  or coalesce(eid,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return false;end if;
 for p in select value from jsonb_array_elements(ledger->'pools')loop
  if app.event_prize_exact_keys_source_v1(p,array['poolId','eventId','kind'])is distinct from true or p->>'eventId'is distinct from eid
   or coalesce(p->>'kind','')not in('q','side')or coalesce(p->>'poolId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or p->>'poolId'=any(pool_ids)then return false;end if;
  pool_ids:=array_append(pool_ids,p->>'poolId');
 end loop;
 for s in select value from jsonb_array_elements(ledger->'sources')loop
  if coalesce(s->>'sourceId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or s->>'physicalEvidenceId'is distinct from s->>'sourceId'or s->>'sourceId'=any(seen)
   or jsonb_typeof(s->'allocations')is distinct from'array'or jsonb_typeof(s->'amountMinor')is distinct from'number'or coalesce(s->>'amountMinor','')!~'^[1-9][0-9]{0,15}$'then return false;end if;
  seen:=array_append(seen,s->>'sourceId');total:=total+(s->>'amountMinor')::numeric;if total>9007199254740991 then return false;end if;
  for a in select value from jsonb_array_elements(s->'allocations')loop
   if a->>'eventId'is distinct from eid then return false;end if;
   if a->>'bucket'in('q','side')and not exists(select 1 from jsonb_array_elements(ledger->'pools')x where x->>'poolId'=a->>'poolId'and x->>'eventId'=eid and x->>'kind'=a->>'bucket')then return false;end if;
  end loop;
 end loop;
 return app.selected_step_prize_range_inner_v3(source_input,history);
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;
-- Only the distinct V3 writer changes. Legacy regular-only validation stays.
do $writer$declare body text;old text:='app.playoff_prize_proposal_range_safe_v2(request_value->''input'',request_value->''overrideHistory'')';begin
 if not exists(select 1 from pg_proc where oid=to_regprocedure('app.save_selected_step_prize_proposal_v3(uuid,uuid,uuid,uuid,text)')and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted V3 proposal writer';end if;
 select replace(pg_get_functiondef('app.save_selected_step_prize_proposal_v3(uuid,uuid,uuid,uuid,text)'::regprocedure),E'\r\n',E'\n')into body;
 if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'V3 proposal range call anchor changed';end if;
 execute replace(replace(body,old,'app.selected_step_prize_range_safe_v3(request_value->''input'',request_value->''overrideHistory'')'),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$writer$;
alter function app.selected_step_prize_range_inner_v3(jsonb,jsonb)owner to postgres;
alter function app.selected_step_prize_range_safe_v3(jsonb,jsonb)owner to postgres;
revoke all on function app.selected_step_prize_range_inner_v3(jsonb,jsonb),app.selected_step_prize_range_safe_v3(jsonb,jsonb)from public,anon,authenticated,service_role;
commit;

