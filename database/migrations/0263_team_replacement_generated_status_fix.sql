-- Repair existing team replacement transfer for generated scorer status.
-- Generated status derives from copied scorer fields; no historical row changes.
begin;
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.transfer_event_replacement_membership_and_credit()'::regprocedure);
 p:=replace(d,'actor_profile_id,operation_receipt_id,reason,scorer_resolution_status','actor_profile_id,operation_receipt_id,reason');
 if p=d then raise exception 'Team replacement column anchor missing';end if;d:=p;
 p:=replace(d,'''Transferred with pre-play event replacement'',v_entry_version.scorer_resolution_status','''Transferred with pre-play event replacement''');
 if p=d then raise exception 'Team replacement value anchor missing';end if;execute p;
end$$;
commit;
