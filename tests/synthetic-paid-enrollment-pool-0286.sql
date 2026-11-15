-- Continues the synthetic pooled fixture. Add one enrolled but unpaid player.
insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('a4740000-0000-4000-8000-000000000099','b2740000-0000-4000-8000-000000000001','director_manual','TEST ONLY unpaid','test only unpaid','paper','a2740000-0000-4000-8000-000000000001','c2740000-0000-4000-8000-000000000001');
insert into app.event_participants(id,tournament_id,event_id,roster_entry_id,status)values('a6740000-0000-4000-8000-000000000099','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','a4740000-0000-4000-8000-000000000099','registered');
do $$declare t uuid:='b2740000-0000-4000-8000-000000000001';e uuid:='a2740000-0000-4000-8000-000000000011';begin
 if app.event_qr_player_is_paid_and_enrolled(t,e,'a4740000-0000-4000-8000-000000000001') is distinct from true then raise exception 'paid participant blocked by another unpaid participant';end if;
 if app.event_qr_player_is_paid_and_enrolled(t,e,'a4740000-0000-4000-8000-000000000099') is distinct from false then raise exception 'unpaid participant accepted';end if;
 if app.event_qr_player_is_paid_and_enrolled(t,e,'a4740000-0000-4000-8000-000000000098') is distinct from false then raise exception 'wrong roster accepted';end if;
end$$;
rollback;
