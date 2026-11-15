-- LOCAL READ-ONLY ADDITIVE PROPOSAL. Requires reviewed mixed v1 then v2.
-- No enrollment, scoring, ledger, credential or table-access grant.
begin;
create function public.get_synthetic_mixed_capability_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare v_fixture app.synthetic_mixed_fixtures_v1%rowtype;v_kind app.synthetic_mixed_enrollment_kinds_v2%rowtype;
 v_official boolean;v_player boolean;v_open boolean;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 or p_actor_id is null then return null;end if;
 select f.* into v_fixture from app.synthetic_mixed_fixtures_v1 f join app.synthetic_mixed_deployments_v1 d using(project_ref)
 where f.event_id=p_event_id and f.tournament_id=p_tournament_id and f.project_ref='nnhcnvksxgxnpvdqjgpg';
 if not found then return null;end if;
 select * into v_kind from app.synthetic_mixed_enrollment_kinds_v2 where event_id=p_event_id and tournament_id=p_tournament_id
 and source_sha256=v_fixture.source_sha256 and protocol_kind='synthetic-mixed-18-v2';
 if not found then return null;end if;
 v_official:=exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker'));
 v_player:=exists(select 1 from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 where p.event_id=p_event_id and p.tournament_id=p_tournament_id and p.profile_id=p_actor_id and p.status='checked_in'and r.scorecard_type='digital'
 and exists(select 1 from app.roster_account_links l where l.tournament_id=p_tournament_id and l.roster_entry_id=p.roster_entry_id and l.profile_id=p_actor_id));
 if not v_official and not v_player then return null;end if;
 select status='open'into v_open from app.tournaments where id=p_tournament_id;
 return jsonb_build_object('kind','synthetic-mixed-18-v2','tournamentId',p_tournament_id,'eventId',p_event_id,'actorId',p_actor_id,
 'participantCount',v_kind.participant_count,'digitalCount',v_kind.digital_count,'paperCount',v_kind.paper_count,'matchCount',v_kind.match_count,
 'isDigitalParticipant',v_player,'isOfficial',v_official,'sourceCurrent',v_fixture.source_snapshot=app.synthetic_mixed_snapshot_v1(p_tournament_id,p_event_id),
 'tournamentOpen',coalesce(v_open,false),'eventStarted',exists(select 1 from app.event_play_starts where event_id=p_event_id and tournament_id=p_tournament_id),
 'officialIdentityConfirmed',v_official and app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id));
end$$;
revoke all on function public.get_synthetic_mixed_capability_v2(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_synthetic_mixed_capability_v2(uuid,uuid,uuid)to service_role;
commit;
