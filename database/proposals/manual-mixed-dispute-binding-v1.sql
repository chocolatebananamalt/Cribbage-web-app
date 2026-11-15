-- UNEXECUTED/default off. Resolving a dispute never writes a result.
-- This version supports ONLY a resolved finding confirming the original digital result.
begin;
create table app.manual_mixed_dispute_bindings_v1(actor_id uuid not null references app.profiles(id),operation_id uuid not null,game_id uuid not null references app.canonical_games(id),submission_id uuid not null references app.score_submissions(id),game_version integer not null,dispute_id uuid not null references app.event_disputes(id),resolution_event_id uuid not null references app.event_dispute_state_events(id),winner_side text not null check(winner_side in('a','b')),margin integer not null check(margin between 1 and 121),reason text not null,recorded_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),unique(submission_id));
alter table app.manual_mixed_dispute_bindings_v1 owner to postgres;alter table app.manual_mixed_dispute_bindings_v1 enable row level security;alter table app.manual_mixed_dispute_bindings_v1 force row level security;revoke all on app.manual_mixed_dispute_bindings_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.manual_mixed_dispute_bindings_v1 for each row execute function app.reject_immutable_history();create trigger no_truncate before truncate on app.manual_mixed_dispute_bindings_v1 for each statement execute function app.reject_immutable_history();
create function app.manual_mixed_dispute_binding_current_v1(gid uuid,sid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select app.manual_mixed_handoff_enabled_v1()and exists(select 1 from app.manual_mixed_dispute_bindings_v1 b join app.manual_mixed_handoff_v1 h on h.submission_id=b.submission_id and h.game_id=b.game_id and h.decision='no'
 join app.canonical_games g on g.id=b.game_id and g.version=b.game_version and g.state='submitted'
 join app.score_submissions s on s.id=b.submission_id and s.canonical_game_id=g.id and s.winner_side=b.winner_side and s.margin=b.margin
 join app.event_disputes d on d.id=b.dispute_id and d.canonical_game_id=g.id and d.event_id=g.event_id and d.tournament_id=g.tournament_id
 join app.event_dispute_state_events e on e.id=b.resolution_event_id and e.dispute_id=d.id and e.state='resolved'and e.created_at>=h.recorded_at
 where g.id=gid and b.submission_id=sid and not app.event_dispute_is_open(d.id)
 and not exists(select 1 from app.event_disputes other where other.canonical_game_id=g.id and app.event_dispute_is_open(other.id)));
$$;
create function public.bind_manual_mixed_resolved_dispute_v1(p_game_id uuid,p_submission_id uuid,p_game_version integer,p_dispute_id uuid,p_resolution_event_id uuid,p_operation_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare a uuid;g app.canonical_games%rowtype;s app.score_submissions%rowtype;h app.manual_mixed_handoff_v1%rowtype;b app.manual_mixed_dispute_bindings_v1%rowtype;e app.event_dispute_state_events%rowtype;begin
 if app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;a:=app.manual_mixed_handoff_actor_v1();if a is null then return null;end if;
 if p_game_id is null or p_submission_id is null or p_game_version is null or p_dispute_id is null or p_resolution_event_id is null or p_operation_id is null or p_reason is null then return null;end if;
 select*into g from app.canonical_games where id=p_game_id for update nowait;if not found then return null;end if;
 perform 1 from app.tournaments where id=g.tournament_id and status='open'for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=a and role in('director','co_director','cross_checker')for share nowait;if not found or app.paper_official_is_independent(a,g.tournament_id,g.id)is distinct from true then return null;end if;
 select*into b from app.manual_mixed_dispute_bindings_v1 where actor_id=a and operation_id=p_operation_id;
 if found then if b.game_id is distinct from p_game_id or b.submission_id is distinct from p_submission_id or b.game_version is distinct from p_game_version or b.dispute_id is distinct from p_dispute_id or b.resolution_event_id is distinct from p_resolution_event_id or b.reason is distinct from p_reason then return null;end if;
 else
 if p_operation_id is null or p_dispute_id is null or p_resolution_event_id is null or p_reason is null or p_reason<>btrim(p_reason)or length(p_reason)not between 1 and 1000 or p_reason~'[[:cntrl:]]'or g.version is distinct from p_game_version or g.state<>'submitted'or exists(select 1 from app.qualification_result_versions where event_id=g.event_id)then return null;end if;
 select*into h from app.manual_mixed_handoff_v1 where game_id=g.id and submission_id=p_submission_id and decision='no';if not found then return null;end if;
 select*into s from app.score_submissions where id=p_submission_id and canonical_game_id=g.id and source_method='digital'for share nowait;if not found or(select count(*)from app.score_submissions where canonical_game_id=g.id)<>1 then return null;end if;
 select*into e from app.event_dispute_state_events where id=p_resolution_event_id and dispute_id=p_dispute_id and canonical_game_id=g.id and event_id=g.event_id and tournament_id=g.tournament_id and state='resolved'and created_at>=h.recorded_at for share nowait;
 if not found or exists(select 1 from app.event_disputes d where d.canonical_game_id=g.id and app.event_dispute_is_open(d.id))then return null;end if;
 if app.manual_mixed_handoff_actor_v1()is distinct from a then return null;end if;
 insert into app.manual_mixed_dispute_bindings_v1 values(a,p_operation_id,g.id,p_submission_id,g.version,p_dispute_id,p_resolution_event_id,s.winner_side,s.margin,p_reason,clock_timestamp())returning*into b;
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(g.tournament_id,a,'manual_mixed_dispute_binding',g.id,'original_result_confirmed_pending_cross_check',jsonb_build_object('submissionId',s.id,'gameVersion',g.version,'disputeId',p_dispute_id,'resolutionEventId',e.id,'reason',p_reason,'verified',false));
 end if;
 return jsonb_build_object('kind','manual-mixed-dispute-binding-v1','actorId',a,'operationId',b.operation_id,'gameId',b.game_id,'submissionId',b.submission_id,'gameVersion',b.game_version,'disputeId',b.dispute_id,'resolutionEventId',b.resolution_event_id,'reason',b.reason,'recordedAt',b.recorded_at,'verified',false,'current',app.manual_mixed_dispute_binding_current_v1(g.id,b.submission_id));
end$$;
create or replace function app.guard_manual_mixed_handoff_review_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.decision='approve'and exists(select 1 from app.manual_mixed_handoff_v1 h where h.submission_id=new.asserted_digital_submission_id and h.decision='no')and app.manual_mixed_dispute_binding_current_v1(new.canonical_game_id,new.asserted_digital_submission_id)is distinct from true then raise exception 'mixed_opponent_disagreement_unresolved';end if;return new;end$$;
alter function app.manual_mixed_dispute_binding_current_v1(uuid,uuid)owner to postgres;alter function public.bind_manual_mixed_resolved_dispute_v1(uuid,uuid,integer,uuid,uuid,uuid,text)owner to postgres;
revoke all on function app.manual_mixed_dispute_binding_current_v1(uuid,uuid),public.bind_manual_mixed_resolved_dispute_v1(uuid,uuid,integer,uuid,uuid,uuid,text)from public,anon,authenticated,service_role;
create function public.get_manual_mixed_dispute_binding_v1(p_game_id uuid)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare a uuid;g app.canonical_games%rowtype;s app.score_submissions%rowtype;h app.manual_mixed_handoff_v1%rowtype;choices jsonb;begin
 if app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;a:=app.manual_mixed_handoff_actor_v1();if a is null then return null;end if;
 select*into g from app.canonical_games where id=p_game_id for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=a and role in('director','co_director','cross_checker')for share nowait;if not found or app.paper_official_is_independent(a,g.tournament_id,g.id)is distinct from true then return null;end if;
 select*into h from app.manual_mixed_handoff_v1 where game_id=g.id and decision='no';if not found then return null;end if;
 select*into s from app.score_submissions where id=h.submission_id and canonical_game_id=g.id and source_method='digital';if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('disputeId',d.id,'resolutionEventId',e.id,'note',e.resolution_note)order by e.created_at),'[]'::jsonb)into choices from app.event_disputes d join app.event_dispute_state_events e on e.dispute_id=d.id and e.canonical_game_id=g.id and e.state='resolved'and e.created_at>=h.recorded_at where d.canonical_game_id=g.id and not app.event_dispute_is_open(d.id);
 return jsonb_build_object('kind','manual-mixed-dispute-source-v1','actorId',a,'gameId',g.id,'submissionId',s.id,'gameVersion',g.version,'winnerSide',s.winner_side,'margin',s.margin,'choices',choices,'currentBinding',app.manual_mixed_dispute_binding_current_v1(g.id,s.id),'canBind',g.state='submitted'and not exists(select 1 from app.qualification_result_versions where event_id=g.event_id),'verified',false);
end$$;
alter function public.get_manual_mixed_dispute_binding_v1(uuid)owner to postgres;revoke all on function public.get_manual_mixed_dispute_binding_v1(uuid)from public,anon,authenticated,service_role;
commit;
