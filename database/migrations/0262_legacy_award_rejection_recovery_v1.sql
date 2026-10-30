-- Preserve exact accepted replay; reject new legacy penny awards with durable receipts.
-- 0260 remains the authoritative insert guard. No history, grants or request hashes change.
begin;
do $patch$
declare name text; definition text; anchor text; addition text; original text;
begin
 foreach name in array array['write_q_accounting_v6','write_no_q_accounting_v7','write_event_settlement_v5']loop
  select pg_get_functiondef(p.oid)into strict definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname=name;
  original:=definition;
  if name='write_event_settlement_v5' then
   anchor:='ledger:=app.settlement_ledger_v5(p_tournament_id);';
   addition:=anchor||E'\n  if p_action=''draft'' then perform app.assert_whole_five_award_array_v1(p_request->''prizeClaims'',''amountMinor'');end if;';
   if strpos(definition,anchor)=0 then raise exception '0262 v5 draft anchor missing';end if;
   definition:=replace(definition,anchor,addition);
   anchor:='source:=draft.request_payload->''source'';';
   if strpos(definition,anchor)=0 then raise exception '0262 v5 final anchor missing';end if;
   definition:=replace(definition,anchor,'perform app.assert_whole_five_award_array_v1(draft.request_payload->''prizeClaims'',''amountMinor'');'||E'\n   '||anchor);
   anchor:='code:=case when sqlerrm in(';
  else
   anchor:='if p_action=''draft''then';
   addition:='perform app.assert_whole_five_award_array_v1(s->''manifest''->''regularSchedule''->''awards'',''totalAwardMinor'');';
   if name='write_q_accounting_v6' then addition:=addition||E'\n  perform app.assert_whole_five_q_awards_v1(s->''qReview''->''obligations'');';end if;
   if strpos(definition,anchor)=0 then raise exception '0262 accounting draft anchor missing';end if;
   definition:=replace(definition,anchor,addition||E'\n  '||anchor);
   anchor:='if d.source_digest is distinct from s->>''sourceDigest''then raise exception ''source_changed'';end if;';
   if strpos(definition,anchor)=0 then raise exception '0262 accounting final anchor missing';end if;
   definition:=replace(definition,anchor,anchor||E'\n   perform app.assert_whole_five_award_array_v1(d.source_manifest->''regularSchedule''->''awards'',''totalAwardMinor'');');
   anchor:='''crosscheck_incomplete'')then sqlerrm';
  end if;
  if strpos(definition,anchor)=0 then raise exception '0262 rejection anchor missing for %',name;end if;
  if name='write_event_settlement_v5' then definition:=replace(definition,anchor,anchor||'''whole_five_awards_required'',');
  else definition:=replace(definition,anchor,replace(anchor,')then sqlerrm',',''whole_five_awards_required'')then sqlerrm'));end if;
  if definition=original then raise exception '0262 empty patch';end if;
  execute definition;
 end loop;
end
$patch$;
commit;
