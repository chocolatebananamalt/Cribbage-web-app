-- Read-only, default-revoked Director projection. No enrollment or consent writes.
begin;
create function public.get_native_mixed_pilot_bootstrap_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare authorized jsonb;v_scope_id uuid;v_decl_id uuid;ready jsonb;funding jsonb;consents integer;
begin
 authorized:=public.execute_native_mixed_pilot_director_v1(p_actor_id,p_session_id,p_tournament_id,p_event_id,'source','{}');if authorized is null then return null;end if;
 if app.native_mixed_attendance_enabled_v1()is distinct from true or app.native_mixed_funding_enabled_v1()is distinct from true then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();perform app.lock_native_mixed_funding_sources_v1();
 select id into v_scope_id from app.native_mixed_attendance_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id;
 select id into v_decl_id from app.native_mixed_paper_declarations_v1 where scope_id=v_scope_id and tournament_id=p_tournament_id and event_id=p_event_id;
 select count(*)into consents from(select distinct on(roster_entry_id)decision from app.native_mixed_digital_consent_decisions_v1 c where c.scope_id=v_scope_id and c.tournament_id=p_tournament_id and c.event_id=p_event_id order by roster_entry_id,version desc)c where decision='granted';
 ready:=app.native_mixed_simulation_lifecycle_v1(p_actor_id,p_tournament_id,p_event_id);funding:=app.native_mixed_funding_seal_source_v1(p_tournament_id,p_event_id);
 return jsonb_build_object('kind','native-mixed-bootstrap-status-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'eventId',p_event_id,
  'observedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'readOnly',true,'simulationStarted',exists(select 1 from app.native_mixed_simulation_starts_v1 where tournament_id=p_tournament_id and event_id=p_event_id),'currentReadinessVerified',coalesce(ready->>'status'='source_available',false),'humanPresenceVerified',false,'actualMoneyReceived',false,
  'records',jsonb_build_object('admissionIntent',exists(select 1 from app.native_mixed_admission_intents_v1 where tournament_id=p_tournament_id and event_id=p_event_id),
  'simulatedFundingVerified',coalesce(funding->>'status'='source_available',false),'attendanceScope',v_scope_id is not null,'grantedConsentCount',consents,
  'paperDeclaration',v_decl_id is not null,'paperReview',exists(select 1 from app.native_mixed_paper_reviews_v1 where declaration_id=v_decl_id and reviewer_id<>preparer_id),
  'attendanceSeal',exists(select 1 from app.native_mixed_attendance_seals_v1 s where s.scope_id=v_scope_id and s.tournament_id=p_tournament_id and s.event_id=p_event_id),
  'registrationClosed',exists(select 1 from app.tournaments where id=p_tournament_id and registration_status='closed')));
exception when lock_not_available then return null;end$$;
alter function public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
