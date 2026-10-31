-- LOCAL PROPOSAL ONLY. No deployment/fixture/artifact rows are seeded here.
-- Owner-reviewed staging enrollment is separate from application deployment.
begin;
create table app.synthetic_paper_deployments_v1(
 project_ref text primary key check(project_ref='nnhcnvksxgxnpvdqjgpg'),
 authorization_reference text not null check(length(trim(authorization_reference)) between 1 and 500),
 enrolled_at timestamptz not null default clock_timestamp());
create table app.synthetic_paper_fixtures_v1(
 event_id uuid primary key,tournament_id uuid not null,
 project_ref text not null references app.synthetic_paper_deployments_v1(project_ref),
 authorization_reference text not null check(length(trim(authorization_reference)) between 1 and 500),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 enrolled_at timestamptz not null default clock_timestamp(),unique(event_id,tournament_id));
create table app.synthetic_paper_artifacts_v1(
 id uuid primary key default extensions.gen_random_uuid(),game_id uuid not null unique,event_id uuid not null,tournament_id uuid not null,
 base_game_version integer not null check(base_game_version>0),winner_side text not null check(winner_side in('a','b')),
 margin integer not null check(margin between 1 and 121),side_a_text text not null,side_b_text text not null,
 side_a_sha256 text generated always as(encode(extensions.digest(side_a_text,'sha256'),'hex'))stored,
 side_b_sha256 text generated always as(encode(extensions.digest(side_b_text,'sha256'),'hex'))stored,
 foreign key(event_id,tournament_id)references app.synthetic_paper_fixtures_v1(event_id,tournament_id),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 generated_at timestamptz not null default clock_timestamp(),unique(id,game_id,tournament_id,event_id));
create table app.synthetic_paper_provenance_v1(
 operation_receipt_id uuid primary key,tournament_id uuid not null,event_id uuid not null,game_id uuid not null,
 artifact_id uuid not null,completion_id uuid not null,actor_id uuid not null references app.profiles(id),
 phase text not null check(phase in('capture','review')),physical_original boolean not null default false check(not physical_original),
 human_review_claimed boolean not null default false check(not human_review_claimed),
 side_a_sha256 text not null check(side_a_sha256~'^[a-f0-9]{64}$'),side_b_sha256 text not null check(side_b_sha256~'^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(completion_id,tournament_id,event_id)references app.paper_game_completions(id,tournament_id,event_id),
 foreign key(artifact_id,game_id,tournament_id,event_id)references app.synthetic_paper_artifacts_v1(id,game_id,tournament_id,event_id));
create index synthetic_paper_fixtures_project_v1 on app.synthetic_paper_fixtures_v1(project_ref);
create index synthetic_paper_artifacts_game_v1 on app.synthetic_paper_artifacts_v1(game_id,tournament_id,event_id);
create index synthetic_paper_provenance_receipt_v1 on app.synthetic_paper_provenance_v1(operation_receipt_id,tournament_id);
create index synthetic_paper_fixtures_tournament_v1 on app.synthetic_paper_fixtures_v1(tournament_id);
create index synthetic_paper_artifacts_fixture_v1 on app.synthetic_paper_artifacts_v1(event_id,tournament_id);
create index synthetic_paper_provenance_artifact_v1 on app.synthetic_paper_provenance_v1(artifact_id,game_id,tournament_id,event_id);
create index synthetic_paper_provenance_completion_v1 on app.synthetic_paper_provenance_v1(completion_id,tournament_id,event_id);
create index synthetic_paper_provenance_actor_v1 on app.synthetic_paper_provenance_v1(actor_id);

create function app.synthetic_paper_card_text_v1(tid uuid,eid uuid,gid uuid,version integer,side text,participant uuid,opponent uuid,verification text,winner text,spread integer)
returns text language sql immutable set search_path=''as $$
 select 'SYNTHETIC TEST SCORECARD'||chr(10)||'Schema: synthetic-paper-card-v1'||chr(10)||'Tournament: '||tid||chr(10)||'Event: '||eid||chr(10)||'Game: '||gid||chr(10)||'Game version: '||version||chr(10)||'Card side: '||side||chr(10)||'Participant: '||participant||chr(10)||'Opponent: '||opponent||chr(10)||'Verification ID: '||verification||chr(10)||'Winner side: '||winner||chr(10)||'Spread points: '||spread||chr(10)||'No physical original; no human review claimed.'||chr(10)
$$;
revoke all on function app.synthetic_paper_card_text_v1(uuid,uuid,uuid,integer,text,uuid,uuid,text,text,integer)from public,anon,authenticated,service_role;

-- 0223 authorized director/co-director capture, but its receipt reader retained
-- the earlier cross-checker-only lookup. Align only that lookup; current binding,
-- independence, actor/target/operation and receipt guards remain unchanged.
do $$declare d text;old text;replacement text;begin
 d:=pg_get_functiondef('public.get_paper_game_operation_reconciliation_v1(uuid,uuid,text,uuid,uuid)'::regprocedure);
 old:='where tournament_id=p_tournament_id and profile_id=p_actor_id and role=''cross_checker'' limit 1;';
 replacement:='where tournament_id=p_tournament_id and profile_id=p_actor_id and role in (''director'',''co_director'',''cross_checker'') order by case role when ''director'' then 1 when ''co_director'' then 2 else 3 end limit 1;';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'paper reconciliation role anchor changed';end if;
 execute replace(d,old,replacement);
end$$;

-- Owner-only fixture preparation helper: no service/API/human execution grant.
-- Enrollment must already exist. Cannot relabel an existing capture or result.
create function app.prepare_synthetic_paper_artifact_v1(gid uuid,winner text,spread integer)returns uuid
language plpgsql security definer set search_path=''as $$
declare g app.canonical_games%rowtype;a text;b text;aid uuid;
begin
 select * into g from app.canonical_games where id=gid for update;
 if not found or g.state<>'pending' or exists(select 1 from app.paper_game_completions where canonical_game_id=gid)
 or exists(select 1 from app.score_submissions where canonical_game_id=gid)or exists(select 1 from app.card_scorelines where canonical_game_id=gid)
 or not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d using(project_ref) where f.event_id=g.event_id and f.tournament_id=g.tournament_id)
 then raise exception'synthetic_artifact_unavailable';end if;
 select s.verification_id into a from app.event_participants p join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.id=g.side_a_participant_id;
 select s.verification_id into b from app.event_participants p join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.id=g.side_b_participant_id;
 if a is null or b is null then raise exception'card_identity_unavailable';end if;
 insert into app.synthetic_paper_artifacts_v1(game_id,event_id,tournament_id,base_game_version,winner_side,margin,side_a_text,side_b_text)
 values(g.id,g.event_id,g.tournament_id,g.version,winner,spread,
 app.synthetic_paper_card_text_v1(g.tournament_id,g.event_id,g.id,g.version,'a',g.side_a_participant_id,g.side_b_participant_id,a,winner,spread),
 app.synthetic_paper_card_text_v1(g.tournament_id,g.event_id,g.id,g.version,'b',g.side_b_participant_id,g.side_a_participant_id,b,winner,spread))returning id into aid;
 return aid;
end$$;
revoke all on function app.prepare_synthetic_paper_artifact_v1(uuid,text,integer)from public,anon,authenticated,service_role;

create function app.guard_synthetic_paper_fixture_v1()returns trigger language plpgsql security definer set search_path=''as $$
begin
 -- Same tournament/event/game lock order as paper capture and qualification;
 -- game locks also wait out digital writers before examining idle state.
 perform 1 from app.tournaments where id=new.tournament_id for update;
 perform 1 from app.events where id=new.event_id and tournament_id=new.tournament_id and format='standard_singles' for update;
 if not found then raise exception'synthetic_fixture_not_idle';end if;
 perform 1 from app.canonical_games where event_id=new.event_id and tournament_id=new.tournament_id order by id for update;
 if exists(select 1 from app.event_participants p left join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id where p.event_id=new.event_id and(p.roster_entry_id is null or r.id is null or r.scorecard_type<>'paper'))
 or exists(select 1 from app.independent_card_corrections where event_id=new.event_id)
 or exists(select 1 from app.game_corrections where event_id=new.event_id)
 or exists(select 1 from app.canonical_games where event_id=new.event_id and state not in('pending','verified'))
 or exists(select 1 from app.device_failure_recoveries r join app.canonical_games g on g.id=r.canonical_game_id where r.event_id=new.event_id and g.state<>'verified')
 or exists(select 1 from app.hybrid_game_cases r join app.canonical_games g on g.id=r.canonical_game_id where r.event_id=new.event_id and g.state<>'verified')
 or exists(select 1 from app.paper_game_completions c where c.event_id=new.event_id and app.paper_game_completion_latest_state(c.id)='pending_review')
 or exists(select 1 from app.qualification_result_versions where event_id=new.event_id)then raise exception'synthetic_fixture_not_idle';end if;
 return new;
end$$;
revoke all on function app.guard_synthetic_paper_fixture_v1()from public,anon,authenticated,service_role;
create trigger synthetic_paper_fixture_guard_v1 before insert on app.synthetic_paper_fixtures_v1 for each row execute function app.guard_synthetic_paper_fixture_v1();

create function app.guard_synthetic_paper_artifact_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare g app.canonical_games%rowtype;a text;b text;
begin
 select * into g from app.canonical_games where id=new.game_id and tournament_id=new.tournament_id and event_id=new.event_id for update;
 if not found or g.state<>'pending' or g.version<>new.base_game_version or exists(select 1 from app.paper_game_completions where canonical_game_id=g.id)
 or exists(select 1 from app.score_submissions where canonical_game_id=g.id) or exists(select 1 from app.card_scorelines where canonical_game_id=g.id)then raise exception'synthetic_artifact_unavailable';end if;
 select s.verification_id into a from app.event_participants p join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.id=g.side_a_participant_id;
 select s.verification_id into b from app.event_participants p join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.id=g.side_b_participant_id;
 if new.side_a_text is distinct from app.synthetic_paper_card_text_v1(g.tournament_id,g.event_id,g.id,g.version,'a',g.side_a_participant_id,g.side_b_participant_id,a,new.winner_side,new.margin)
 or new.side_b_text is distinct from app.synthetic_paper_card_text_v1(g.tournament_id,g.event_id,g.id,g.version,'b',g.side_b_participant_id,g.side_a_participant_id,b,new.winner_side,new.margin)then raise exception'synthetic_artifact_mismatch';end if;
 return new;
end$$;
revoke all on function app.guard_synthetic_paper_artifact_v1()from public,anon,authenticated,service_role;
create trigger synthetic_paper_artifact_guard_v1 before insert on app.synthetic_paper_artifacts_v1 for each row execute function app.guard_synthetic_paper_artifact_v1();

create function app.guard_synthetic_paper_write_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare a app.synthetic_paper_artifacts_v1%rowtype;enrollment timestamptz;
begin
 select enrolled_at into enrollment from app.synthetic_paper_fixtures_v1 where event_id=new.event_id and tournament_id=new.tournament_id;
 if enrollment is null then return new;end if;
 select * into a from app.synthetic_paper_artifacts_v1 where game_id=new.canonical_game_id;
 if not found or current_setting('app.synthetic_paper_artifact',true)is distinct from a.id::text then raise exception'synthetic_evidence_required';end if;
 return new;
end$$;
revoke all on function app.guard_synthetic_paper_write_v1()from public,anon,authenticated,service_role;
create trigger synthetic_paper_capture_guard_v1 before insert on app.paper_game_completions for each row execute function app.guard_synthetic_paper_write_v1();
create trigger synthetic_paper_review_guard_v1 before insert on app.paper_game_completion_reviews for each row execute function app.guard_synthetic_paper_write_v1();

-- Alternate scoring/correction paths cannot author unlabelled results in a
-- fixture explicitly enrolled for the synthetic paper protocol. Ordinary events
-- and exact historical receipt replays are untouched.
do $$declare t text;begin
 foreach t in array array['score_submissions','score_confirmations','card_scorelines','device_failure_recoveries','hybrid_game_cases','game_corrections','independent_card_corrections','independent_card_correction_projections']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_synthetic_paper_write_v1()','aaa_synthetic_'||t,t);
 end loop;
end$$;
create function app.guard_synthetic_canonical_change_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare aid uuid;
begin
 if exists(select 1 from app.synthetic_paper_fixtures_v1 where event_id=new.event_id and tournament_id=new.tournament_id)
 and (new.state,new.version,new.winner_side,new.margin)is distinct from(old.state,old.version,old.winner_side,old.margin)then
 select id into aid from app.synthetic_paper_artifacts_v1 where game_id=new.id;
 if aid is null or current_setting('app.synthetic_paper_artifact',true)is distinct from aid::text then raise exception'synthetic_evidence_required';end if;
 end if;return new;
end$$;
revoke all on function app.guard_synthetic_canonical_change_v1()from public,anon,authenticated,service_role;
create trigger synthetic_canonical_change_guard_v1 before update on app.canonical_games for each row execute function app.guard_synthetic_canonical_change_v1();

create function public.get_synthetic_paper_evidence_v1(p_actor_id uuid,p_tournament_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare cards jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker'))then return null;end if;
 if not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d using(project_ref) where f.tournament_id=p_tournament_id)then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('artifactId',a.id,'gameId',a.game_id,'eventId',a.event_id,'gameVersion',a.base_game_version,
 'sideA',jsonb_build_object('text',a.side_a_text,'sha256',a.side_a_sha256,'reference','SYNTHETIC-v1:'||a.id||':a:'||a.side_a_sha256),
 'sideB',jsonb_build_object('text',a.side_b_text,'sha256',a.side_b_sha256,'reference','SYNTHETIC-v1:'||a.id||':b:'||a.side_b_sha256))order by a.game_id),'[]')into cards from app.synthetic_paper_artifacts_v1 a where a.tournament_id=p_tournament_id;
 return jsonb_build_object('tournamentId',p_tournament_id,'projectRef','nnhcnvksxgxnpvdqjgpg','eventIds',(select jsonb_agg(event_id order by event_id)from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id),'gameIds',(select jsonb_agg(g.id order by g.id)from app.canonical_games g join app.synthetic_paper_fixtures_v1 f on f.event_id=g.event_id and f.tournament_id=g.tournament_id where g.tournament_id=p_tournament_id),'artifacts',cards);
end$$;

create function app.synthetic_paper_claims_valid_v1(a app.synthetic_paper_artifacts_v1,version integer,claim_a jsonb,claim_b jsonb)returns boolean language sql immutable set search_path=''as $$
 select version=a.base_game_version and claim_a->>'evidenceReference'='SYNTHETIC-v1:'||a.id||':a:'||a.side_a_sha256
 and claim_b->>'evidenceReference'='SYNTHETIC-v1:'||a.id||':b:'||a.side_b_sha256
 and claim_a->>'winnerSide'=a.winner_side and claim_b->>'winnerSide'=a.winner_side
 and claim_a->>'margin'=a.margin::text and claim_b->>'margin'=a.margin::text
$$;
revoke all on function app.synthetic_paper_claims_valid_v1(app.synthetic_paper_artifacts_v1,integer,jsonb,jsonb)from public,anon,authenticated,service_role;

create function app.record_synthetic_paper_provenance_v1(a app.synthetic_paper_artifacts_v1,actor uuid,cid uuid,operation uuid,phase_value text)returns void language plpgsql security definer set search_path=''as $$
declare r app.operation_receipts%rowtype;
begin
 select * into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=operation;
 if r.outcome='accepted'and not exists(select 1 from app.synthetic_paper_provenance_v1 where operation_receipt_id=r.id)then
 insert into app.synthetic_paper_provenance_v1(operation_receipt_id,tournament_id,event_id,game_id,artifact_id,completion_id,actor_id,phase,side_a_sha256,side_b_sha256)
 values(r.id,a.tournament_id,a.event_id,a.game_id,a.id,cid,actor,phase_value,a.side_a_sha256,a.side_b_sha256);
 insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(a.tournament_id,actor,a.game_id,r.id,'synthetic_paper_provenance',cid,'synthetic_scorecards_'||phase_value,jsonb_build_object('artifactId',a.id,'sideASha256',a.side_a_sha256,'sideBSha256',a.side_b_sha256,'physicalOriginal',false,'humanReviewClaimed',false));end if;
end$$;
revoke all on function app.record_synthetic_paper_provenance_v1(app.synthetic_paper_artifacts_v1,uuid,uuid,uuid,text)from public,anon,authenticated,service_role;

create function public.complete_synthetic_paper_game_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_game_id uuid,p_completion_id uuid,p_expected_game_version integer,p_side_a_claim jsonb,p_side_b_claim jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare a app.synthetic_paper_artifacts_v1%rowtype;result jsonb;prior_setting text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 select * into a from app.synthetic_paper_artifacts_v1 where game_id=p_game_id and event_id=p_event_id and tournament_id=p_tournament_id;
 if not found or not coalesce(app.synthetic_paper_claims_valid_v1(a,p_expected_game_version,p_side_a_claim,p_side_b_claim),false)then return jsonb_build_object('status','rejected','code','invalid_request','completionId',p_completion_id);end if;
 -- Reuse the canonical writer's authority, lifecycle, locks, request hash,
 -- replay and captured/re-entered matching rules. No direct scoreline writes.
 prior_setting:=current_setting('app.synthetic_paper_artifact',true);perform set_config('app.synthetic_paper_artifact',a.id::text,true);
 result:=public.complete_paper_vs_paper_game_v1(p_actor_id,p_tournament_id,p_event_id,p_game_id,p_completion_id,p_expected_game_version,p_side_a_claim,p_side_b_claim,p_operation_id);
 perform set_config('app.synthetic_paper_artifact',coalesce(prior_setting,''),true);
 if result->>'status'='pending_review'then perform app.record_synthetic_paper_provenance_v1(a,p_actor_id,p_completion_id,p_operation_id,'capture');end if;
 return result;
end$$;

create function public.review_synthetic_paper_game_v1(p_actor_id uuid,p_tournament_id uuid,p_completion_id uuid,p_decision text,p_expected_game_version integer,p_side_a_claim jsonb,p_side_b_claim jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare a app.synthetic_paper_artifacts_v1%rowtype;result jsonb;prior_setting text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 select a1.* into a from app.synthetic_paper_artifacts_v1 a1 join app.paper_game_completions c on c.canonical_game_id=a1.game_id and c.tournament_id=a1.tournament_id where c.id=p_completion_id and a1.tournament_id=p_tournament_id;
 if not found or not coalesce(app.synthetic_paper_claims_valid_v1(a,p_expected_game_version,p_side_a_claim,p_side_b_claim),false)then return jsonb_build_object('status','rejected','code','invalid_request','completionId',p_completion_id);end if;
 prior_setting:=current_setting('app.synthetic_paper_artifact',true);perform set_config('app.synthetic_paper_artifact',a.id::text,true);
 result:=public.review_paper_vs_paper_game_v1(p_actor_id,p_completion_id,p_expected_game_version,p_side_a_claim,p_side_b_claim,p_decision,p_operation_id);
 perform set_config('app.synthetic_paper_artifact',coalesce(prior_setting,''),true);
 if result?'decision'then perform app.record_synthetic_paper_provenance_v1(a,p_actor_id,p_completion_id,p_operation_id,'review');end if;
 return result;
end$$;

do $$declare t text;begin
 foreach t in array array['synthetic_paper_deployments_v1','synthetic_paper_fixtures_v1','synthetic_paper_artifacts_v1','synthetic_paper_provenance_v1']loop
 execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',t||'_immutable',t);
 end loop;
end$$;
revoke all on function public.get_synthetic_paper_evidence_v1(uuid,uuid)from public,anon,authenticated;
revoke all on function public.complete_synthetic_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.review_synthetic_paper_game_v1(uuid,uuid,uuid,text,integer,jsonb,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.get_synthetic_paper_evidence_v1(uuid,uuid)to service_role;
grant execute on function public.complete_synthetic_paper_game_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)to service_role;
grant execute on function public.review_synthetic_paper_game_v1(uuid,uuid,uuid,text,integer,jsonb,jsonb,uuid)to service_role;
commit;
