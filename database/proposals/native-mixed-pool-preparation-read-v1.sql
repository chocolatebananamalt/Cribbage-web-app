-- PRIVATE SOURCE CANDIDATE. No install, access grant, policy or money movement.
begin;
create function app.native_mixed_pool_preparation_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.get_native_mixed_pool_preparation_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;funding jsonb;intent app.native_mixed_admission_intents_v1%rowtype;
 scope_row app.native_mixed_funding_scopes_v1%rowtype;candidate record;source jsonb;
 pools jsonb:='[]';paper jsonb;digital jsonb;response jsonb;assignments jsonb:='[]';v_context_id uuid;v_pre_start boolean;
 v_latest_prize jsonb;v_rounding_text text;v_rounding_unit integer;v_rounding_digest text;v_amount_supported boolean;
begin
 if app.native_mixed_pool_preparation_enabled_v1()is distinct from true
  or app.native_mixed_pool_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;
 if not found or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 lock table app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
  app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions,
  app.tournament_roster_entries,app.event_participants,app.roster_account_links,app.initial_seating_assignments,
  app.native_mixed_simulation_starts_v1,app.event_play_starts,
  app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1 in share mode nowait;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','current_funding_unavailable');end if;
 select*into scope_row from app.native_mixed_funding_scopes_v1 where id=(funding#>>'{scope,scopeId}')::uuid and tournament_id=tid and event_id=eid;
 select*into intent from app.native_mixed_admission_intents_v1 where id=scope_row.admission_intent_id and tournament_id=tid and event_id=eid;
 if intent.id is null then return null;end if;
 -- True only after a coherent locked absence check, not an inferred permission
 -- to start/write. Contention/missing dependencies fail the entire read closed.
 v_pre_start:=not exists(select 1 from app.native_mixed_simulation_starts_v1 ns where ns.tournament_id=tid and ns.event_id=eid)
  and not exists(select 1 from app.event_play_starts os where os.tournament_id=tid and os.event_id=eid);
 -- The current funding getter already compared this exact immutable base pin
 -- to the current admission source. Expose only its selected unit/digest, never
 -- the private plan/roster/activation captures. No guessed legacy default.
 v_latest_prize:=scope_row.source_capture#>'{baseSource,latestPrize}';
 if v_latest_prize is not null and(v_latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
  or coalesce(v_latest_prize->>'sourceDigest','')!~'^[a-f0-9]{64}$')then return null;end if;
 for candidate in
  select 'q'::text kind,q.id pool_id,q.slot,q.pool_type_code saved_label,q.entry_fee_cents fee from app.tournament_setup_q_pool_versions q
   where q.tournament_id=tid and q.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid
  union all
  select 'side',m.pool_id,s.slot,s.pool_type_code,s.entry_fee_cents from app.tournament_setup_side_pool_materializations m
   join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
   where m.tournament_id=tid and m.event_id=eid and s.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid
  order by kind,slot,pool_id
 loop
  source:=app.native_mixed_pool_setup_v1(tid,eid,candidate.kind,candidate.pool_id,funding);
  v_rounding_unit:=null;v_rounding_digest:=null;
  if v_latest_prize is not null then
   v_rounding_text:=v_latest_prize#>>array['plan','draft','rounding',case when candidate.kind='q'then'qPool'else'sidePool'end];
   if v_latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
    or v_rounding_text is null or v_rounding_text not in('1','5','10')
    or coalesce(v_latest_prize->>'sourceDigest','')!~'^[a-f0-9]{64}$'then return null;end if;
   v_rounding_unit:=v_rounding_text::integer*100;v_rounding_digest:=v_latest_prize->>'sourceDigest';
  end if;
  -- Mirror the writer's existing policy admission domain, not eventual amount
  -- feasibility (which also needs actual eligible counts and fund conservation).
  v_amount_supported:=source is not null and case
   when source->>'method'='side-sheet20-40-selected-step-v1'then candidate.fee in(1000,2000,5000,10000)
   when source->>'method'='q-v3-raw-selected-step-v1'then candidate.fee>=500 and candidate.fee%500=0
   when source->>'method'='q-equal-exact-selected-step-v1'then candidate.fee>0 and candidate.fee%100=0
   else false end;
  -- Unsupported methods/fees remain visible, without promising usable policy.
  pools:=pools||jsonb_build_array(jsonb_build_object('kind',candidate.kind,'poolId',candidate.pool_id,
   'slot',candidate.slot,'label',left(regexp_replace(trim(candidate.saved_label),'[[:cntrl:]]','','g'),160),
   'supported',v_amount_supported,'method',source->'method',
   'feeMinor',candidate.fee,'ratio',source->'ratio',
   'roundingStatus',case when v_latest_prize is null then'unknown_legacy'else'saved_latest'end,
   'roundingUnitMinor',v_rounding_unit,'roundingSourceDigest',v_rounding_digest));
 end loop;
 -- Only the reviewed native publication's exact sidecar can supply fixed IDs.
 -- No normal-auth call to the service-only schedule getter or JWT substitution.
 perform app.lock_native_mixed_simulation_sources_v1();
 select c.id into v_context_id from app.native_mixed_simulation_publication_contexts_v1 c where c.tournament_id=tid and c.event_id=eid;
 if v_context_id is not null then
  if app.native_mixed_simulation_publication_bound_v1(v_context_id)is distinct from true then return null;end if;
  select ss.assignments_capture into assignments from app.native_mixed_simulation_seating_sidecars_v1 ss where ss.context_id=v_context_id;
 end if;
 -- Before a proven publication, IDs are explicitly null/pending.
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,
  'displayName',r.claimed_display_name,'fixedTournamentId',a.value->'fixedId',
  'fixedIdStatus',case when v_context_id is null then 'pending'else 'published'end,'simulationOnly',true)order by r.id),'[]')into paper
 from jsonb_array_elements(funding->'entries')x
 join app.event_participants p on p.id=(x->>'participantId')::uuid and p.tournament_id=tid and p.event_id=eid and p.profile_id is null
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.id=(x->>'rosterEntryId')::uuid and r.tournament_id=tid and r.scorecard_type='paper'
 left join lateral(select value from jsonb_array_elements(assignments)j(value)
  where value->>'rosterEntryId'=r.id::text and value->>'participantId'=p.id::text)a on true
 where x->>'mode'='paper'and x->'profileId'='null'::jsonb;
 if jsonb_array_length(paper)<>12 or(v_context_id is not null and exists(
  select 1 from jsonb_array_elements(paper)x where x->>'fixedTournamentId'is null))then return null;end if;
 -- Six linked digital roster labels are Director-only display data. No profile,
 -- account-link, contact or ACC fields leave this projection. They do not give
 -- the Director authority to enter any real player's election.
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,
  'displayName',r.claimed_display_name,'fixedTournamentId',a.value->'fixedId',
  'fixedIdStatus',case when v_context_id is null then 'pending'else 'published'end)order by r.id),'[]')into digital
 from jsonb_array_elements(funding->'entries')x
 join app.event_participants p on p.id=(x->>'participantId')::uuid and p.tournament_id=tid and p.event_id=eid
  and p.profile_id::text=x->>'profileId'
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.id=(x->>'rosterEntryId')::uuid and r.tournament_id=tid and r.scorecard_type='digital'
 left join lateral(select value from jsonb_array_elements(assignments)j(value)
  where value->>'rosterEntryId'=r.id::text and value->>'participantId'=p.id::text)a on true
 where x->>'mode'='digital'and exists(select 1 from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id and l.profile_id=p.profile_id)
 ;
 if jsonb_array_length(digital)<>6 or(v_context_id is not null and exists(
  select 1 from jsonb_array_elements(digital)x where x->>'fixedTournamentId'is null))then return null;end if;
 response:=jsonb_build_object('kind','native-mixed-pool-preparation-v1','status','source_available',
  'actorId',actor,'tournamentId',tid,'eventId',eid,'fundingSourceDigest',funding->'sourceDigest',
  'journalDigest',app.native_mixed_pool_journal_digest_v1(tid,eid),'availablePools',pools,'fictionalPaperParticipants',paper,
  'digitalParticipants',digital,'preStart',v_pre_start,
  'simulationOnly',true,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryLiability',false);
 if app.native_mixed_pool_actor_v1()is distinct from actor
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;

create function public.get_native_mixed_pool_preparation_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language sql volatile security definer set search_path=''as $$
 select app.get_native_mixed_pool_preparation_v1(p_tournament_id,p_event_id)
$$;
do $acl$declare f regprocedure;begin foreach f in array array[
 'app.native_mixed_pool_preparation_enabled_v1()'::regprocedure,
 'app.get_native_mixed_pool_preparation_v1(uuid,uuid)'::regprocedure,
 'public.get_native_mixed_pool_preparation_v1(uuid,uuid)'::regprocedure]loop
 execute format('alter function %s owner to postgres',f);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$acl$;
commit;
