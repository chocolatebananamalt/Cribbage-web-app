-- UNEXECUTED/default off. Requires manual-mixed handoff and dispute binding. Install before the progression candidate.
-- No score is written here. Changed results need later manual transcription AND independent hybrid review.
begin;
create table app.manual_mixed_preverification_adjudications_v1(
 id uuid primary key default extensions.gen_random_uuid(),actor_id uuid not null references app.profiles(id),identity_binding_id uuid not null references app.paper_official_identity_bindings(id),operation_id uuid not null,
 game_id uuid not null references app.canonical_games(id),submission_id uuid not null references app.score_submissions(id),game_version integer not null,revision integer not null,
 dispute_id uuid not null references app.event_disputes(id),resolution_event_id uuid not null references app.event_dispute_state_events(id),
 original_winner_side text not null,original_margin integer not null,winner_side text not null check(winner_side in('a','b')),margin integer not null check(margin between 1 and 121),
 digital_preference_version integer not null,paper_preference_version integer not null,paper_reference text not null,reason text not null,request jsonb not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),unique(game_id,revision),check((winner_side,margin)is distinct from(original_winner_side,original_margin)));
alter table app.manual_mixed_preverification_adjudications_v1 owner to postgres;alter table app.manual_mixed_preverification_adjudications_v1 enable row level security;alter table app.manual_mixed_preverification_adjudications_v1 force row level security;
revoke all on app.manual_mixed_preverification_adjudications_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.manual_mixed_preverification_adjudications_v1 for each row execute function app.reject_immutable_history();create trigger no_truncate before truncate on app.manual_mixed_preverification_adjudications_v1 for each statement execute function app.reject_immutable_history();
alter table app.hybrid_game_cases add column preverification_adjudication_id uuid references app.manual_mixed_preverification_adjudications_v1(id);
create function app.manual_mixed_adjudication_live_holds_v1(gid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.canonical_games g join app.tournaments t on t.id=g.tournament_id and t.status='open'where g.id=gid and g.state='submitted'
 and not app.paper_game_has_active_case(g.id)and not app.device_recovery_has_active_case(g.id)
 and not exists(select 1 from app.qualification_result_versions where event_id=g.event_id)
 and not exists(select 1 from app.event_disputes d where d.canonical_game_id=g.id and app.event_dispute_is_open(d.id))
 and app.legacy_financial_liability_exists_v1(g.tournament_id,g.event_id)is false
 and not exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=g.tournament_id and event_id=g.event_id)
 and not exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=g.tournament_id and event_id=g.event_id)
 and not exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=g.tournament_id and event_id=g.event_id));$$;
create function app.manual_mixed_adjudication_matches_v1(aid uuid,gid uuid,sid uuid,base integer,w text,m integer,live boolean)returns boolean language sql stable security definer set search_path=''as $$
 select(not live or app.manual_mixed_handoff_enabled_v1())and exists(select 1 from app.manual_mixed_preverification_adjudications_v1 a
 join app.canonical_games g on g.id=a.game_id
 join app.score_submissions s on s.id=a.submission_id and s.canonical_game_id=g.id and s.source_method='digital'and s.winner_side=a.original_winner_side and s.margin=a.original_margin
 join app.manual_mixed_handoff_v1 h on h.submission_id=s.id and h.game_id=g.id and h.decision='no'and h.game_version=a.game_version
 join app.event_disputes d on d.id=a.dispute_id and d.canonical_game_id=g.id and d.tournament_id=g.tournament_id and d.event_id=g.event_id
 join app.event_dispute_state_events e on e.id=a.resolution_event_id and e.dispute_id=d.id and e.state='resolved'and e.created_at>=h.recorded_at
 join app.event_participants digital on digital.id=s.submitter_participant_id and digital.id in(g.side_a_participant_id,g.side_b_participant_id)and(not live or digital.profile_id=h.actor_id)and digital.event_id=g.event_id and digital.tournament_id=g.tournament_id
 join app.tournament_roster_entries rd on rd.id=digital.roster_entry_id and(not live or(rd.scorecard_type='digital'and rd.scorecard_preference_version=a.digital_preference_version))
 join app.event_participants paper on paper.id=case when digital.id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end and paper.event_id=g.event_id and paper.tournament_id=g.tournament_id
 join app.tournament_roster_entries rp on rp.id=paper.roster_entry_id and(not live or(rp.scorecard_type='paper'and rp.scorecard_preference_version=a.paper_preference_version))
 where a.id=aid and a.game_id=gid and a.submission_id=sid and a.game_version=base and a.winner_side=w and a.margin=m
 and not exists(select 1 from app.manual_mixed_preverification_adjudications_v1 newer where newer.game_id=g.id and newer.revision>a.revision)
 and case when live then g.version=base and digital.status='checked_in'and paper.status='checked_in'and app.manual_mixed_adjudication_live_holds_v1(g.id)
 and app.paper_official_is_independent(a.actor_id,g.tournament_id,g.id)
 and a.identity_binding_id=(select id from app.paper_official_identity_bindings where tournament_id=g.tournament_id and official_profile_id=a.actor_id order by binding_version desc limit 1)
 and exists(select 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=a.actor_id and role in('director','co_director','cross_checker'))
 and exists(select 1 from auth.users where id=a.actor_id and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp()))
 else g.version=base+1 and g.state in('verified','corrected')and g.winner_side=w and g.margin=m
 and exists(select 1 from app.hybrid_game_cases c join app.hybrid_game_reviews r on r.hybrid_case_id=c.id and r.decision='approve'and r.reviewer_profile_id<>a.actor_id and r.reviewer_profile_id<>c.first_official_profile_id
 where c.preverification_adjudication_id=a.id and c.canonical_game_id=g.id and c.digital_submission_id=s.id and c.digital_participant_id=digital.id and c.digital_scorecard_preference_version=a.digital_preference_version and c.paper_scorecard_preference_version=a.paper_preference_version and c.paper_evidence_reference=a.paper_reference and c.base_game_version=base and c.winner_side=w and c.margin=m and app.hybrid_game_latest_state(c.id)='approved')end);
$$;
create function app.manual_mixed_current_adjudication_id_v1(gid uuid,sid uuid,base integer,w text,m integer)returns uuid language sql stable security definer set search_path=''as $$select id from app.manual_mixed_preverification_adjudications_v1 a where a.game_id=gid and app.manual_mixed_adjudication_matches_v1(a.id,gid,sid,base,w,m,true)order by revision desc limit 1$$;
create function public.get_manual_mixed_adjudication_source_v1(p_game_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare s jsonb;head uuid;begin
 s:=public.get_manual_mixed_dispute_binding_v1(p_game_id);if s is null then return null;end if;
 select id into head from app.manual_mixed_preverification_adjudications_v1 where game_id=p_game_id order by revision desc limit 1;
 return s||jsonb_build_object('adjudicationHeadId',head);end$$;
create function public.record_manual_mixed_adjudication_v1(p_game_id uuid,p_request jsonb)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;g app.canonical_games%rowtype;s app.score_submissions%rowtype;h app.manual_mixed_handoff_v1%rowtype;a app.manual_mixed_preverification_adjudications_v1%rowtype;prior app.manual_mixed_preverification_adjudications_v1%rowtype;head uuid;rev integer;binding uuid;dp integer;pp integer;begin
 if app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;actor:=app.manual_mixed_handoff_actor_v1();if actor is null then return null;end if;
 if p_request is null or jsonb_typeof(p_request)<>'object'or(select count(*)from jsonb_object_keys(p_request))<>10 or not(p_request?&array['submissionId','gameVersion','disputeId','resolutionEventId','expectedHeadId','winnerSide','margin','paperReference','reason','operationId'])then return null;end if;
 if coalesce(p_request->>'submissionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(p_request->>'disputeId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(p_request->>'resolutionEventId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 if coalesce(p_request->>'operationId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 select*into g from app.canonical_games where id=p_game_id for update nowait;if not found then return null;end if;
 perform 1 from app.tournaments where id=g.tournament_id for update nowait;
 perform 1 from app.tournament_roles where tournament_id=g.tournament_id and profile_id=actor and role in('director','co_director','cross_checker')for share nowait;if not found or app.paper_official_is_independent(actor,g.tournament_id,g.id)is distinct from true then return null;end if;
 select*into prior from app.manual_mixed_preverification_adjudications_v1 where actor_id=actor and operation_id=(p_request->>'operationId')::uuid;
 if found then if prior.game_id is distinct from p_game_id or prior.request is distinct from p_request then return null;end if;a:=prior;
 else
 if app.manual_mixed_adjudication_live_holds_v1(g.id)is distinct from true or app.hybrid_game_has_active_case(g.id)or exists(select 1 from app.manual_mixed_dispute_bindings_v1 where game_id=g.id)then return null;end if;
 if jsonb_typeof(p_request->'gameVersion')<>'number'or (p_request->>'gameVersion')!~'^[1-9][0-9]{0,8}$'or g.version<>(p_request->>'gameVersion')::integer or coalesce(p_request->>'winnerSide','')not in('a','b')or jsonb_typeof(p_request->'margin')<>'number'or coalesce(p_request->>'margin','')!~'^[0-9]{1,3}$'or(p_request->>'margin')::integer not between 1 and 121 then return null;end if;
 if jsonb_typeof(p_request->'paperReference')<>'string'or length(btrim(p_request->>'paperReference'))not between 1 and 200 or p_request->>'paperReference'<>btrim(p_request->>'paperReference')or(p_request->>'paperReference')~'[[:cntrl:]]'or jsonb_typeof(p_request->'reason')<>'string'or length(btrim(p_request->>'reason'))not between 1 and 1000 or p_request->>'reason'<>btrim(p_request->>'reason')or(p_request->>'reason')~'[[:cntrl:]]'then return null;end if;
 select id,revision into head,rev from app.manual_mixed_preverification_adjudications_v1 where game_id=g.id order by revision desc limit 1;
 if p_request->'expectedHeadId'is distinct from coalesce(to_jsonb(head),'null'::jsonb)then return null;end if;
 select*into h from app.manual_mixed_handoff_v1 where game_id=g.id and game_version=g.version and submission_id=(p_request->>'submissionId')::uuid and decision='no';if not found then return null;end if;
 select*into s from app.score_submissions where id=h.submission_id and canonical_game_id=g.id and source_method='digital'for share nowait;if not found or(select count(*)from app.score_submissions where canonical_game_id=g.id)<>1 or(s.winner_side,s.margin)is not distinct from(p_request->>'winnerSide',(p_request->>'margin')::integer)then return null;end if;
 perform 1 from app.event_disputes d join app.event_dispute_state_events e on e.dispute_id=d.id and e.canonical_game_id=g.id and e.event_id=g.event_id and e.tournament_id=g.tournament_id and e.state='resolved'and e.created_at>=h.recorded_at where d.id=(p_request->>'disputeId')::uuid and e.id=(p_request->>'resolutionEventId')::uuid and d.canonical_game_id=g.id for share of d,e nowait;if not found then return null;end if;
 select rd.scorecard_preference_version,rp.scorecard_preference_version into dp,pp from app.event_participants digital join app.tournament_roster_entries rd on rd.id=digital.roster_entry_id and rd.scorecard_type='digital'join app.event_participants paper on paper.id=case when digital.id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end join app.tournament_roster_entries rp on rp.id=paper.roster_entry_id and rp.scorecard_type='paper'where digital.id=s.submitter_participant_id and digital.status='checked_in'and paper.status='checked_in';if not found then return null;end if;
 select id into binding from app.paper_official_identity_bindings where tournament_id=g.tournament_id and official_profile_id=actor order by binding_version desc limit 1;
 if app.manual_mixed_handoff_actor_v1()is distinct from actor then return null;end if;
 insert into app.manual_mixed_preverification_adjudications_v1(actor_id,identity_binding_id,operation_id,game_id,submission_id,game_version,revision,dispute_id,resolution_event_id,original_winner_side,original_margin,winner_side,margin,digital_preference_version,paper_preference_version,paper_reference,reason,request)
 values(actor,binding,(p_request->>'operationId')::uuid,g.id,s.id,g.version,coalesce(rev,0)+1,(p_request->>'disputeId')::uuid,(p_request->>'resolutionEventId')::uuid,s.winner_side,s.margin,p_request->>'winnerSide',(p_request->>'margin')::integer,dp,pp,p_request->>'paperReference',p_request->>'reason',p_request)returning*into a;
 if app.manual_mixed_adjudication_matches_v1(a.id,g.id,s.id,g.version,a.winner_side,a.margin,true)is distinct from true then raise exception 'adjudication_source_postcondition_failed';end if;
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(g.tournament_id,actor,'manual_mixed_adjudication',a.id,'pending_manual_transcription_and_independent_review',jsonb_build_object('originalSubmissionId',s.id,'gameVersion',g.version,'request',p_request,'verified',false));
 end if;
 return jsonb_build_object('kind','manual-mixed-adjudication-receipt-v1','actorId',actor,'gameId',g.id,'adjudicationId',a.id,'request',a.request,'recordedAt',a.recorded_at,'verified',false);
end$$;

-- A case captures exactly one current adjudication; later amendments require rejecting that case first.
create function app.bind_manual_mixed_case_adjudication_v1()returns trigger language plpgsql security definer set search_path=''as $$declare a app.manual_mixed_preverification_adjudications_v1%rowtype;begin
 select*into a from app.manual_mixed_preverification_adjudications_v1 where game_id=new.canonical_game_id order by revision desc limit 1;
 if found then
 if new.paper_evidence_reference is distinct from a.paper_reference or app.manual_mixed_adjudication_matches_v1(a.id,new.canonical_game_id,new.digital_submission_id,new.base_game_version,new.winner_side,new.margin,true)is distinct from true then raise exception 'adjudicated_paper_claim_mismatch';end if;
 new.preverification_adjudication_id:=a.id;
 elsif new.preverification_adjudication_id is not null then raise exception 'adjudication_unavailable';end if;return new;end$$;
create trigger bind_preverification_adjudication before insert on app.hybrid_game_cases for each row execute function app.bind_manual_mixed_case_adjudication_v1();
create function app.reject_original_binding_after_adjudication_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.manual_mixed_preverification_adjudications_v1 where game_id=new.game_id)then raise exception 'changed_result_adjudication_already_recorded';end if;return new;end$$;
create trigger adjudication_conflict before insert on app.manual_mixed_dispute_bindings_v1 for each row execute function app.reject_original_binding_after_adjudication_v1();
create or replace function app.guard_manual_mixed_handoff_review_v1()returns trigger language plpgsql security definer set search_path=''as $$declare c app.hybrid_game_cases%rowtype;a app.manual_mixed_preverification_adjudications_v1%rowtype;begin
 if new.decision='approve'then
 select*into c from app.hybrid_game_cases where id=new.hybrid_case_id;
 if c.preverification_adjudication_id is not null then
 select*into a from app.manual_mixed_preverification_adjudications_v1 where id=c.preverification_adjudication_id;
 if new.reviewer_profile_id=a.actor_id or c.paper_evidence_reference is distinct from a.paper_reference or app.manual_mixed_adjudication_matches_v1(a.id,c.canonical_game_id,c.digital_submission_id,c.base_game_version,c.winner_side,c.margin,true)is distinct from true then raise exception 'adjudication_independent_review_required';end if;
 elsif exists(select 1 from app.manual_mixed_handoff_v1 h where h.submission_id=new.asserted_digital_submission_id and h.decision='no')and app.manual_mixed_dispute_binding_current_v1(new.canonical_game_id,new.asserted_digital_submission_id)is distinct from true then raise exception 'mixed_opponent_disagreement_unresolved';end if;
 end if;return new;end$$;
-- Exact reviewed seams: retain independent assertion of original digital evidence.
do $seams$declare d text;oid regprocedure;needle text;replacement text;begin
 select p.oid::regprocedure into strict oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='create_hybrid_digital_paper_case_v1';select pg_get_functiondef(oid)into d;
 needle:='if v_submission.winner_side<>(p_paper_claim->>''winnerSide'') or v_submission.margin<>(p_paper_claim->>''margin'')::integer then';
 replacement:='if (v_submission.winner_side<>(p_paper_claim->>''winnerSide'') or v_submission.margin<>(p_paper_claim->>''margin'')::integer) and app.manual_mixed_current_adjudication_id_v1(p_game_id,p_digital_submission_id,v_game.version,p_paper_claim->>''winnerSide'',(p_paper_claim->>''margin'')::integer)is null then';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_create_comparison_seam_changed';end if;d:=replace(d,needle,replacement);
 needle:='''winnerSide'',v_submission.winner_side,''margin'',v_submission.margin,''authoritative'',false';replacement:='''winnerSide'',p_paper_claim->>''winnerSide'',''margin'',(p_paper_claim->>''margin'')::integer,''authoritative'',false';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_create_response_seam_changed';end if;d:=replace(d,needle,replacement);
 needle:='v_paper_roster.scorecard_preference_version,v_submission.winner_side,v_submission.margin,trim';replacement:='v_paper_roster.scorecard_preference_version,p_paper_claim->>''winnerSide'',(p_paper_claim->>''margin'')::integer,trim';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_create_insert_seam_changed';end if;execute replace(d,needle,replacement);
 select p.oid::regprocedure into strict oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='review_hybrid_digital_paper_case_v1';select pg_get_functiondef(oid)into d;
 needle:='or v_submission.winner_side<>v_case.winner_side or v_submission.margin<>v_case.margin';
 replacement:='or ((v_submission.winner_side<>v_case.winner_side or v_submission.margin<>v_case.margin) and (v_case.preverification_adjudication_id is null or app.manual_mixed_adjudication_matches_v1(v_case.preverification_adjudication_id,v_case.canonical_game_id,v_case.digital_submission_id,v_case.base_game_version,v_case.winner_side,v_case.margin,true)is distinct from true))';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_review_seam_changed';end if;execute replace(d,needle,replacement);
 select pg_get_functiondef('app.revalidate_game(uuid)'::regprocedure)into d;
 needle:='if (select count(*) from app.score_submissions where id=hybrid_case.digital_submission_id and canonical_game_id=game_id and submitter_participant_id=hybrid_case.digital_participant_id and winner_side=hybrid_case.winner_side and margin=hybrid_case.margin and source_method=''digital'')<>1 then raise exception ''hybrid completion digital evidence is invalid''; end if;';
 replacement:='if hybrid_case.preverification_adjudication_id is null then '||needle||' else if app.manual_mixed_adjudication_matches_v1(hybrid_case.preverification_adjudication_id,game_id,hybrid_case.digital_submission_id,hybrid_case.base_game_version,hybrid_case.winner_side,hybrid_case.margin,false)is distinct from true then raise exception ''hybrid adjudication evidence is invalid'';end if;end if;';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_invariant_seam_changed';end if;execute replace(d,needle,replacement);
 select pg_get_functiondef('public.get_hybrid_game_workspace_v1(uuid,uuid)'::regprocedure)into d;
 needle:='''paperVerificationId'',sp.verification_id) order by e.name,r.round_number,g.id),''[]''::jsonb) into v_candidates';replacement:='''paperVerificationId'',sp.verification_id)||jsonb_strip_nulls(jsonb_build_object(''adjudicationReference'',(select adj.paper_reference from app.manual_mixed_preverification_adjudications_v1 adj where adj.game_id=g.id and app.manual_mixed_adjudication_matches_v1(adj.id,g.id,s.id,g.version,adj.winner_side,adj.margin,true)order by adj.revision desc limit 1)))order by e.name,r.round_number,g.id),''[]''::jsonb) into v_candidates';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_paper_reference_projection_seam_changed';end if;d:=replace(d,needle,replacement);
 needle:='''digitalSubmissionId'',c.digital_submission_id,''digitalWinnerSide'',c.winner_side,''digitalMargin'',c.margin,';
 replacement:='''digitalSubmissionId'',c.digital_submission_id,''digitalWinnerSide'',(select winner_side from app.score_submissions where id=c.digital_submission_id),''digitalMargin'',(select margin from app.score_submissions where id=c.digital_submission_id),';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_original_digital_projection_seam_changed';end if;d:=replace(d,needle,replacement);
 needle:='''paperVerificationId'',sp.verification_id) order by e.name,r.round_number,g.id),''[]''::jsonb) into v_reviews';replacement:='''paperVerificationId'',sp.verification_id)||case when c.preverification_adjudication_id is null then ''{}''::jsonb else jsonb_build_object(''adjudicationId'',c.preverification_adjudication_id,''adjudicationReference'',c.paper_evidence_reference)end order by e.name,r.round_number,g.id),''[]''::jsonb) into v_reviews';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudication_case_link_projection_seam_changed';end if;d:=replace(d,needle,replacement);
 needle:='where c.tournament_id=p_tournament_id and c.first_official_profile_id<>p_actor_id';replacement:=needle||' and not exists(select 1 from app.manual_mixed_preverification_adjudications_v1 adj where adj.id=c.preverification_adjudication_id and adj.actor_id=p_actor_id)';
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'adjudicator_review_visibility_seam_changed';end if;execute replace(d,needle,replacement);
end$seams$;
do $permissions$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='app'and p.proname in('manual_mixed_adjudication_live_holds_v1','manual_mixed_adjudication_matches_v1','manual_mixed_current_adjudication_id_v1','bind_manual_mixed_case_adjudication_v1','reject_original_binding_after_adjudication_v1'))or(n.nspname='public'and p.proname in('get_manual_mixed_adjudication_source_v1','record_manual_mixed_adjudication_v1'))loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;end$permissions$;
commit;
