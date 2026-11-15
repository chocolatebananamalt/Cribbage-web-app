-- Continues the base fixture before synthetic mode is activated: a comp remains
-- eligible by the exact existing obligation semantics, with no payment record.
insert into app.roster_payment_obligation_versions(tournament_id,roster_entry_id,version,amount_owed_minor,reason,actor_profile_id,operation_receipt_id) values('b2740000-0000-4000-8000-000000000001','a4740000-0000-4000-8000-000000000001',1,0,'TEST ONLY comp','a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');
do $$begin
 if app.event_qr_player_is_paid_and_enrolled('b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','a4740000-0000-4000-8000-000000000001') is distinct from true or app.event_qr_player_is_paid_and_enrolled_legacy_0286('b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','a4740000-0000-4000-8000-000000000001') is distinct from true then raise exception 'legacy comp parity changed';end if;
end$$;
rollback;
