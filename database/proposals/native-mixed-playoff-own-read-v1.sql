-- Private/default-off dependency: native-mixed-playoff-v1.sql.
-- Own digital-player projection only. No grants, routes or public bracket.
begin;
create function app.get_native_mixed_playoff_own_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;source jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;
 own_person jsonb;own_id uuid;mine jsonb;other_person jsonb;other_id uuid;
 m jsonb;p jsonb;g jsonb;e jsonb;item jsonb;entries jsonb;games jsonb;next_game jsonb;matches jsonb:='[]';
 slot_no integer;own_place jsonb;own_submitted boolean;finished boolean:=false;eliminated boolean:=false;open_match boolean:=false;answer jsonb;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 select value into own_person from jsonb_array_elements(source#>'{capture,roster}')x
 where x->>'mode'='digital'and x->>'profileId'=actor::text;
 if own_person is null then return null;end if;own_id:=(own_person->>'participantId')::uuid;
 mine:=jsonb_build_object('participantId',own_id,'tournamentIdNumber',own_person->'fixedTournamentId');
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
  app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 if c.id is null then answer:=jsonb_build_object('status','awaiting_playoff_preparation','own',mine);
 else
  if c.source_digest is distinct from source->>'sourceDigest'or c.source_capture is distinct from source->'capture'
   or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true
  then return jsonb_build_object('status','blocked','code','source_changed');end if;
  if not exists(select 1 from jsonb_array_elements(c.source_capture->'seeds')x where x->>'participantId'=own_id::text)
  then answer:=jsonb_build_object('status','not_in_simulated_playoffs','own',mine);
  else
   for slot_no in 1..4 loop
    m:=app.native_mixed_playoff_match_v1(c.id,slot_no);
    if m is null or not(m->'participants'?own_id::text)then continue;end if;
    p:=app.native_mixed_playoff_progress_v1(c.id,slot_no);if p is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    select value into other_person from jsonb_array_elements(c.source_capture->'roster')x
     where m->'participants'?(x->>'participantId')and x->>'participantId'<>own_id::text;
    if other_person is null then return jsonb_build_object('status','blocked','code','opponent_unavailable');end if;
    other_id:=(other_person->>'participantId')::uuid;
    games:='[]';
    for g in select value from jsonb_array_elements(p->'games')loop
     entries:='[]';
     select exists(select 1 from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=slot_no
      and game_number=(g->>'gameNumber')::integer and entry->>'type'='digital-submit'
      and entry->>'participantId'=own_id::text and actor_id=actor)into own_submitted;
     for e in select entry from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=slot_no
       and game_number=(g->>'gameNumber')::integer and own_submitted order by sequence loop
      -- Explicit projection: never return actor/session/profile, authority capture,
      -- request payload, roster contact/ACC fields, or unrelated game evidence.
      item:=jsonb_build_object('id',e->'id','type',e->'type');
      if e->>'type'='digital-submit'then item:=item||jsonb_build_object('participantId',e->'participantId','winnerParticipantId',e->'winnerParticipantId');
      elsif e->>'type'='digital-confirm'then item:=item||jsonb_build_object('participantId',e->'participantId','submissionId',e->'submissionId','winnerParticipantId',e->'winnerParticipantId','evidenceIds',e->'evidenceIds');
      elsif e->>'type'='paper-capture'then item:=item||jsonb_build_object('artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','claims',e->'claims');
      elsif e->>'type'='paper-review'then item:=item||jsonb_build_object('captureId',e->'captureId','artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','reenteredClaims',e->'reenteredClaims');
      else return jsonb_build_object('status','blocked','code','history_unavailable');end if;
      entries:=entries||jsonb_build_array(item);
     end loop;
     games:=games||jsonb_build_array(jsonb_build_object('gameNumber',g->'gameNumber','complete',case when own_submitted then g->'complete'else'false'::jsonb end,
      'winnerParticipantId',case when own_submitted then g->'winnerId'else'null'::jsonb end,
      'revision',g->'revision','historyDigest',g->'historyDigest','counterEvidenceAvailable',own_submitted,'entries',entries));
    end loop;
    if p->'complete'='true'::jsonb and p->>'winnerId'<>own_id::text then eliminated:=true;end if;
    if p->'complete'='false'::jsonb then open_match:=true;end if;
    next_game:=null;
    if p->'complete'='false'::jsonb then
     select value into g from jsonb_array_elements(p->'games')x where x->'gameNumber'=p->'nextGameNumber';
     next_game:=jsonb_build_object('gameNumber',p->'nextGameNumber','expectedRevision',coalesce(g->'revision','0'::jsonb),
      'expectedHistoryDigest',coalesce(g->'historyDigest',to_jsonb(app.native_mixed_simulation_hash_v1(jsonb_build_array(
       'native-mixed-playoff-game-history-v1',c.id,slot_no,(p->>'nextGameNumber')::integer,m->>'matchDigest','[]'::jsonb)))));
    end if;
    matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'matchDigest',m->'matchDigest','format',m->'format',
     'own',mine,'opponent',jsonb_build_object('participantId',other_id,'tournamentIdNumber',other_person->'fixedTournamentId',
      'mode',other_person->'mode',
      'displayName',(select claimed_display_name from app.tournament_roster_entries where id=(other_person->>'rosterEntryId')::uuid and tournament_id=tid)),
     'complete',p->'complete','winnerParticipantId',p->'winnerId','nextGame',next_game,'games',games,
     'ownWins',case when m#>>'{participants,0}'=own_id::text then p->'winsA'else p->'winsB'end,
     'opponentWins',case when m#>>'{participants,0}'=own_id::text then p->'winsB'else p->'winsA'end));
   end loop;
   if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then
    if app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    finished:=true;
    select jsonb_build_object('firstPlace',x->'firstPlace','lastPlace',x->'lastPlace')into own_place
     from app.native_mixed_playoff_completions_v1 completion_row cross join lateral jsonb_array_elements(completion_row.source_capture->'finishingGroups')x
     where completion_row.context_id=c.id and x->'participantIds'?own_id::text;
    if own_place is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
   end if;
   answer:=jsonb_build_object('status','simulated_playoff_own_available','contextId',c.id,'sourceDigest',source->'sourceDigest',
    'own',mine,'matches',matches,'complete',finished,'eliminated',eliminated,'awaitingOpponent',not finished and not eliminated and not open_match,'ownFinishingGroup',own_place);
  end if;
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 return answer||jsonb_build_object('tournamentId',tid,'eventId',eid,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;
alter function app.get_native_mixed_playoff_own_v1(uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_playoff_own_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
