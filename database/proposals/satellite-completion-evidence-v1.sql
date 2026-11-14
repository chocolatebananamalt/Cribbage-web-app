-- Unexecuted read-only source. No grant, award, fund certification or calculator.
-- Requires Satellite recorded reconciliation and existing authoritative standings.
begin;
create function app.satellite_completion_evidence_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function public.get_satellite_completion_evidence_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid:=auth.uid();claims jsonb:=auth.jwt();sid text;recorded jsonb;standings jsonb;body jsonb;fund_review jsonb;begin
 if app.satellite_completion_evidence_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if actor is null or claims->>'sub'is distinct from actor::text or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),claims->>'role','')<>'authenticated'
 or jsonb_typeof(claims->'exp')is distinct from'number'or coalesce(claims->>'exp','')!~'^[0-9]{1,16}$'then return null;end if;
 if(claims->>'exp')::numeric<=extract(epoch from clock_timestamp())then return null;end if;
 sid:=claims->>'session_id';if coalesce(sid,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 -- Block inserts/corrections as well as row updates while joining score order.
 -- Coarse locking is explicit; runtime/performance acceptance is still required.
 lock table app.canonical_games,app.card_scorelines,app.score_submissions,app.score_confirmations,
 app.independent_card_corrections,app.independent_card_correction_projections,app.independent_card_correction_state_events,
 app.device_failure_recoveries,app.device_failure_recovery_evidence,app.device_failure_recovery_state_events,app.device_failure_recovery_projections,
 app.operational_game_forfeits,app.event_game_standings_eligibility_versions,app.event_schedule_publications,
 app.tournament_setup_activations,app.tournament_setup_event_versions,app.tournament_roster_entries,app.profiles,app.ruleset_versions in share mode nowait;
 recorded:=app.get_satellite_recorded_reconciliation_v1(p_tournament_id,p_event_id);
 if recorded->>'status'is distinct from'source_available'then return recorded;end if;
 -- The established reader checks event type, active standard-singles format,
 -- digital scoring, approved rules and authoritative resolved effective scores.
 standings:=public.get_preliminary_event_standings(p_tournament_id,p_event_id);
 -- Null for a non-primary official or a closed/missing current fund review;
 -- never reinterpret that as zero additional income.
 fund_review:=app.satellite_fund_source_v1(p_tournament_id,p_event_id);
 body:=jsonb_build_object('kind','satellite-completion-evidence-v1','actorId',actor,'tournamentId',p_tournament_id,'eventId',p_event_id,
 'snapshotConsistency','locked_source_snapshot','recordedSource',recorded,'standings',standings,'fundReview',fund_review);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('satellite-completion-evidence-v1',body)::text,'UTF8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function app.satellite_completion_evidence_enabled_v1()owner to postgres;
alter function public.get_satellite_completion_evidence_v1(uuid,uuid)owner to postgres;
revoke all on function app.satellite_completion_evidence_enabled_v1(),public.get_satellite_completion_evidence_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
