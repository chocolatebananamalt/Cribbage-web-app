-- Local/unexecuted: opponent response on the digital player's device is NOT authenticated review.
begin;
create function app.manual_mixed_handoff_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.manual_mixed_handoff_actor_v1()returns uuid language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare actor uuid:=auth.uid();j jsonb:=auth.jwt();begin
 if actor is null or j->>'sub'is distinct from actor::text or coalesce(j->>'role','')<>'authenticated'or coalesce(j->>'exp','')!~'^[0-9]{1,16}$'or(j->>'exp')::numeric<=extract(epoch from clock_timestamp())or coalesce(j->>'session_id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=(j->>'session_id')::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 return actor;end$$;
create table app.manual_mixed_handoff_v1(actor_id uuid not null references app.profiles(id),operation_id uuid not null,game_id uuid not null references app.canonical_games(id),submission_id uuid not null references app.score_submissions(id),game_version integer not null,decision text not null check(decision in('yes','no')),recorded_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),unique(submission_id));
alter table app.manual_mixed_handoff_v1 enable row level security;alter table app.manual_mixed_handoff_v1 force row level security;
revoke all on app.manual_mixed_handoff_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.manual_mixed_handoff_v1 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.manual_mixed_handoff_v1 for each statement execute function app.reject_immutable_history();
create function public.get_manual_mixed_handoff_v1(p_game_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare c jsonb;v integer;h app.manual_mixed_handoff_v1%rowtype;begin
 if app.manual_mixed_handoff_actor_v1()is null or app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;
 c:=public.get_assigned_game_context(p_game_id);if c is null or c->>'actorId'is distinct from auth.uid()::text or c->'ownSubmission'='null'::jsonb then return null;end if;
 select g.version into v from app.canonical_games g join app.score_submissions s on s.canonical_game_id=g.id and s.id=(c#>>'{ownSubmission,id}')::uuid and s.source_method='digital'
 join app.event_participants d on d.id=s.submitter_participant_id and d.profile_id=auth.uid()and d.status='checked_in'
 join app.tournament_roster_entries rd on rd.id=d.roster_entry_id and rd.scorecard_type='digital'
 join app.event_participants p on p.id=case when d.id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end and p.status='checked_in'
 join app.tournament_roster_entries rp on rp.id=p.roster_entry_id and rp.scorecard_type='paper'
 where g.id=p_game_id and d.event_id=g.event_id and p.event_id=g.event_id and d.tournament_id=g.tournament_id and p.tournament_id=g.tournament_id;
 if not found then return null;end if;
 select *into h from app.manual_mixed_handoff_v1 where submission_id=(c#>>'{ownSubmission,id}')::uuid;
 return jsonb_build_object('kind','manual-mixed-handoff-v1','actorId',auth.uid(),'gameId',p_game_id,'gameVersion',v,'submission',c->'ownSubmission','paperPlayer',c->'opponent','digitalPlayer',c->'player','response',case when h.submission_id is null then null else jsonb_build_object('operationId',h.operation_id,'decision',h.decision,'recordedAt',h.recorded_at)end,'canRespond',c->>'state'='submitted'and c->>'progressionStatus'='current','tentative',true,'verified',false);
end$$;
create function public.record_manual_mixed_handoff_v1(p_game_id uuid,p_submission_id uuid,p_game_version integer,p_operation_id uuid,p_decision text)returns jsonb language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();c jsonb;h app.manual_mixed_handoff_v1%rowtype;begin
 if a is null or app.manual_mixed_handoff_actor_v1()is distinct from a or app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;
 if p_decision is null or p_decision not in('yes','no')or p_operation_id is null or p_game_version is null or p_submission_id is null then return null;end if;
 perform 1 from app.canonical_games where id=p_game_id for update nowait;
 c:=public.get_manual_mixed_handoff_v1(p_game_id);if c is null then return null;end if;
 select*into h from app.manual_mixed_handoff_v1 where actor_id=a and operation_id=p_operation_id;
 if found then if h.game_id<>p_game_id or h.submission_id<>p_submission_id or h.game_version<>p_game_version or h.decision<>p_decision then return null;end if;return c;end if;
 if c->'canRespond'is distinct from'true'::jsonb then return null;end if;
 if c->>'gameVersion'is distinct from p_game_version::text or c#>>'{submission,id}'is distinct from p_submission_id::text or c->'response'<>'null'::jsonb then return null;end if;
 if app.manual_mixed_handoff_actor_v1()is distinct from a then return null;end if;
 insert into app.manual_mixed_handoff_v1 values(a,p_operation_id,p_game_id,p_submission_id,p_game_version,p_decision,clock_timestamp());
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)select tournament_id,a,'manual_mixed_handoff',p_game_id,'tentative_opponent_response',jsonb_build_object('operationId',p_operation_id,'submissionId',p_submission_id,'decision',p_decision,'authenticatedOpponent',false,'verified',false)from app.canonical_games where id=p_game_id;
 return public.get_manual_mixed_handoff_v1(p_game_id);
 exception when lock_not_available then return null;end$$;
alter function app.manual_mixed_handoff_actor_v1()owner to postgres;revoke all on function app.manual_mixed_handoff_actor_v1()from public,anon,authenticated,service_role;
alter function app.manual_mixed_handoff_enabled_v1()owner to postgres;alter function public.get_manual_mixed_handoff_v1(uuid)owner to postgres;alter function public.record_manual_mixed_handoff_v1(uuid,uuid,integer,uuid,text)owner to postgres;
revoke all on function app.manual_mixed_handoff_enabled_v1(),public.get_manual_mixed_handoff_v1(uuid),public.record_manual_mixed_handoff_v1(uuid,uuid,integer,uuid,text)from public,anon,authenticated,service_role;
-- A No never becomes a verified result through the existing manual approval path.
create function app.guard_manual_mixed_handoff_review_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.decision='approve'and exists(select 1 from app.manual_mixed_handoff_v1 h where h.submission_id=new.asserted_digital_submission_id and h.decision='no')then raise exception 'mixed_opponent_disagreement_unresolved';end if;return new;end$$;
create trigger manual_mixed_handoff_disagreement before insert on app.hybrid_game_reviews for each row execute function app.guard_manual_mixed_handoff_review_v1();
alter function app.guard_manual_mixed_handoff_review_v1()owner to postgres;revoke all on function app.guard_manual_mixed_handoff_review_v1()from public,anon,authenticated,service_role;
-- Read only the cases already visible through the existing role-separated manual workspace.
create function public.get_manual_mixed_official_status_v1(tid uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare a uuid;w jsonb;begin
 if app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;a:=app.manual_mixed_handoff_actor_v1();if a is null then return null;end if;
 w:=public.get_hybrid_game_workspace_v1(a,tid);if w is null or w->'actorIdentityConfirmed'is distinct from'true'::jsonb then return null;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('gameId',g.id,'eventId',g.event_id,'decision',h.decision))from app.manual_mixed_handoff_v1 h join app.canonical_games g on g.id=h.game_id where g.tournament_id=tid and exists(select 1 from jsonb_array_elements(coalesce(w->'candidates','[]'::jsonb)||coalesce(w->'reviewCases','[]'::jsonb))x where x->>'gameId'=g.id::text)),'[]'::jsonb);
 end$$;
alter function public.get_manual_mixed_official_status_v1(uuid)owner to postgres;revoke all on function public.get_manual_mixed_official_status_v1(uuid)from public,anon,authenticated,service_role;
commit;
