-- LOCAL ADDITIVE PROPOSAL ONLY. Requires synthetic-mixed-evidence-v1.sql.
-- Preserves the verified 17-player v1 checkpoint. No enrollment/data seeded.
-- Eighteen-player scoring protocol only; qualification/finance remain blocked.
begin;
create table app.synthetic_mixed_enrollment_kinds_v2(
 event_id uuid primary key,tournament_id uuid not null,
 protocol_kind text not null default 'synthetic-mixed-18-v2'check(protocol_kind='synthetic-mixed-18-v2'),
 participant_count integer not null default 18 check(participant_count=18),
 digital_count integer not null default 6 check(digital_count=6),
 paper_count integer not null default 12 check(paper_count=12),
 match_count integer not null default 108 check(match_count=108),
 source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_fixtures_v1(event_id,tournament_id));
alter table app.synthetic_mixed_enrollment_kinds_v2 enable row level security;
alter table app.synthetic_mixed_enrollment_kinds_v2 force row level security;
revoke all on app.synthetic_mixed_enrollment_kinds_v2 from public,anon,authenticated,service_role;
create trigger synthetic_mixed_enrollment_kinds_v2_immutable before update or delete on app.synthetic_mixed_enrollment_kinds_v2 for each row execute function app.reject_immutable_history();
create function app.enroll_synthetic_mixed_fixture_v2(tid uuid,eid uuid,project text,authorization_ref text)returns void
language plpgsql security definer set search_path=''as $$
declare snap jsonb;v_fixture_game record;
begin
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update;
 if not found then raise exception'synthetic_mixed_fixture_unavailable';end if;
 perform 1 from app.events where id=eid and tournament_id=tid and format='standard_singles'and scoring_method='digital'for update;
 if not found or project<>'nnhcnvksxgxnpvdqjgpg' or not exists(select 1 from app.synthetic_mixed_deployments_v1 where project_ref=project)
 or exists(select 1 from app.synthetic_paper_fixtures_v1 where event_id=eid)
 or exists(select 1 from app.synthetic_mixed_fixtures_v1 where event_id=eid)then raise exception'synthetic_mixed_fixture_unavailable';end if;
 perform 1 from app.canonical_games where event_id=eid and tournament_id=tid order by id for update;
 snap:=app.synthetic_mixed_snapshot_v1(tid,eid);
 if(select count(*)from app.event_participants where event_id=eid and tournament_id=tid)<>18
 or(select count(*)from app.canonical_games where event_id=eid and tournament_id=tid)<>108
 or jsonb_array_length(snap->'participants')is distinct from 18 or jsonb_array_length(snap->'games')is distinct from 108
 or(select count(*)from jsonb_array_elements(snap->'participants')p where p->>'mode'='digital'and p->>'status'='checked_in'and p->>'profileId'is not null
 and jsonb_array_length(p->'links')=1 and p->'links'->0->>1=p->>'profileId')<>6
 or(select count(*)from jsonb_array_elements(snap->'participants')p where p->>'mode'='paper'and p->>'status'='checked_in'and p->>'profileId'is null and jsonb_array_length(p->'links')=0)<>12
 or(select count(distinct p->>'profileId')from jsonb_array_elements(snap->'participants')p where p->>'mode'='digital')<>6
 or exists(select 1 from app.canonical_games where event_id=eid and(state<>'pending'or winner_side is not null or margin is not null))
 or exists(select 1 from app.score_submissions where event_id=eid)or exists(select 1 from app.card_scorelines where event_id=eid)
 or exists(select 1 from app.paper_game_completions where event_id=eid)or exists(select 1 from app.hybrid_game_cases where event_id=eid)
 or exists(select 1 from app.device_failure_recoveries where event_id=eid)or exists(select 1 from app.qualification_result_versions where event_id=eid)
 then raise exception'synthetic_mixed_fixture_not_idle';end if;
 if exists(select 1 from app.canonical_games where event_id=eid group by least(side_a_participant_id,side_b_participant_id),greatest(side_a_participant_id,side_b_participant_id)having count(*)>1)
 or exists(select 1 from app.event_participants p left join app.canonical_games g on g.event_id=eid and p.id in(g.side_a_participant_id,g.side_b_participant_id)where p.event_id=eid group by p.id having count(g.id)<>12)
 or(select count(*)from app.rounds where event_id=eid)<>12
 or exists(select 1 from app.canonical_games cg join app.rounds r on r.id=cg.round_id where cg.event_id=eid and r.round_number not between 1 and 12)
 or exists(select 1 from app.canonical_games cg join app.rounds r on r.id=cg.round_id where cg.event_id=eid group by r.round_number having count(*)<>9)
 or exists(select 1 from app.event_participants participant cross join app.rounds round_row
 left join app.canonical_games game_row on game_row.round_id=round_row.id and participant.id in(game_row.side_a_participant_id,game_row.side_b_participant_id)
 where participant.event_id=eid and round_row.event_id=eid group by participant.id,round_row.id having count(game_row.id)<>1)
 or(select count(*)from app.event_schedule_publications where event_id=eid and tournament_id=tid and game_count=12 and participant_count=18 and match_count=108)<>1
 or exists(select 1 from app.canonical_games game_row join app.rounds round_row on round_row.id=game_row.round_id
 cross join lateral(values(game_row.side_a_participant_id,game_row.side_a_table_seat_snapshot),(game_row.side_b_participant_id,game_row.side_b_table_seat_snapshot))seat_row(participant_id,current_seat)
 join app.event_participants participant on participant.id=seat_row.participant_id join app.initial_seating_assignments initial_seat on initial_seat.tournament_id=tid and initial_seat.roster_entry_id=participant.roster_entry_id
 where game_row.event_id=eid and round_row.round_number=1 and seat_row.current_seat is distinct from initial_seat.verification_id)
 or exists(select 1 from app.odd_field_makeup_games_v1 where event_id=eid)
 then raise exception'synthetic_mixed_schedule_invalid';end if;
 insert into app.synthetic_mixed_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference,source_snapshot,source_sha256)
 values(eid,tid,project,authorization_ref,snap,encode(extensions.digest(snap::text,'sha256'),'hex'));
 for v_fixture_game in select c.*,a.scorecard_type am,b.scorecard_type bm,pa.profile_id ap,pb.profile_id bp from app.canonical_games c
 join app.event_participants pa on pa.id=c.side_a_participant_id join app.tournament_roster_entries a on a.id=pa.roster_entry_id
 join app.event_participants pb on pb.id=c.side_b_participant_id join app.tournament_roster_entries b on b.id=pb.roster_entry_id where c.event_id=eid loop
 insert into app.synthetic_mixed_games_v1(game_id,event_id,tournament_id,pairing,side_a_participant_id,side_b_participant_id,digital_participant_id,digital_profile_id,base_game_version)
 values(v_fixture_game.id,eid,tid,case when v_fixture_game.am='digital'and v_fixture_game.bm='digital'then'DD'when v_fixture_game.am='paper'and v_fixture_game.bm='paper'then'PP'else'PD'end,
 v_fixture_game.side_a_participant_id,v_fixture_game.side_b_participant_id,case when v_fixture_game.am<>v_fixture_game.bm then case when v_fixture_game.am='digital'then v_fixture_game.side_a_participant_id else v_fixture_game.side_b_participant_id end end,
 case when v_fixture_game.am<>v_fixture_game.bm then case when v_fixture_game.am='digital'then v_fixture_game.ap else v_fixture_game.bp end end,v_fixture_game.version);
 end loop;
 insert into app.synthetic_mixed_enrollment_kinds_v2(event_id,tournament_id,source_sha256)values(eid,tid,encode(extensions.digest(snap::text,'sha256'),'hex'));
end$$;
revoke all on function app.enroll_synthetic_mixed_fixture_v2(uuid,uuid,text,text)from public,anon,authenticated,service_role;
-- A scripted PD result must be checked BEFORE an immutable own submission is
-- stored. Otherwise a typo could strand the game behind the frozen artifact.
-- This affects only the explicitly enrolled eighteen-player v2 protocol.
create function app.guard_synthetic_mixed_pd_submission_v2()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if exists(select 1 from app.synthetic_mixed_games_v1 m join app.synthetic_mixed_enrollment_kinds_v2 k on k.event_id=m.event_id and k.tournament_id=m.tournament_id
 where m.game_id=new.canonical_game_id and m.pairing='PD')and not exists(select 1 from app.synthetic_mixed_artifacts_v1 a
 where a.game_id=new.canonical_game_id and a.event_id=new.event_id and a.tournament_id=new.tournament_id and a.winner_side=new.winner_side and a.margin=new.margin)
 then raise exception'synthetic_mixed_scripted_paper_result_required';end if;
 return new;
end$$;
revoke all on function app.guard_synthetic_mixed_pd_submission_v2()from public,anon,authenticated,service_role;
create trigger aab_synthetic_mixed_pd_submission_v2 before insert on app.score_submissions for each row execute function app.guard_synthetic_mixed_pd_submission_v2();
commit;
