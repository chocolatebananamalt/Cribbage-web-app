-- LOCAL UNEXECUTED sporting-only read source. No writes, grants or enablement.
-- Requires existing verified <=64 chart/series source proposal. No new placement.
begin;
create function app.native_playoff_mrp_source_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.native_playoff_mrp_actor_v1(tid uuid)returns uuid language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid:=auth.uid();j jsonb:=auth.jwt();begin
 if actor is null or j->>'sub'is distinct from actor::text or coalesce(j->>'role','')<>'authenticated'or coalesce(j->>'exp','')!~'^[0-9]{1,16}$'or(j->>'exp')::numeric<=extract(epoch from clock_timestamp())or coalesce(j->>'session_id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=(j->>'session_id')::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')for share nowait;if not found then return null;end if;return actor;
end$$;
create function public.get_native_playoff_mrp_source_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;qualification app.qualification_result_versions%rowtype;gate_source jsonb;event_kind text;
 generation app.playoff_series_generations_v1%rowtype;result_row app.playoff_series_results_v1%rowtype;
 match_source jsonb;current_result jsonb;players jsonb;matches jsonb:='[]'::jsonb;games jsonb;actions jsonb;match_value jsonb;action_history_digest text;source_digest text;
 native_playoff_start_id uuid;slot_no integer;slot_count integer;qualified_count integer;valid_result boolean;capture_value jsonb;
begin
 if app.native_playoff_mrp_source_enabled_v1()is distinct from true or p_tournament_id is null or p_event_id is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 actor:=app.native_playoff_mrp_actor_v1(p_tournament_id);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||p_event_id::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;if not found then return null;end if;
 lock table app.qualification_result_versions,app.qualification_result_rows,app.initial_seating_publications,app.initial_seating_assignments,
 app.roster_account_links,app.event_participants,app.tournament_roster_entries,
 app.event_settings_playoff_reviews_v1,app.event_settings_playoff_starts_v1,
 app.playoff_series_match_operations_v1,app.playoff_series_matches_v1,app.playoff_series_generations_v1,app.playoff_series_results_v1,
 app.playoff_series_game_operations_v1,app.playoff_series_game_operation_outcomes_v1,app.playoff_series_game_operation_conflicts_v1,
 app.playoff_series_games_v1,app.playoff_series_game_actions_v1,app.playoff_series_game_submissions_v1,
 app.playoff_series_game_confirmations_v1,app.playoff_series_verified_games_v1 in share mode nowait;
 select*into qualification from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 if qualification.id is null or qualification.qualifier_count<4 or qualification.qualifier_count>64 or(qualification.qualifier_count>5 and app.playoff_series_large_fields_enabled_v2()is distinct from true)or app.qualification_resolution_snapshot_current_v1(qualification.id)is distinct from true then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 slot_count:=qualification.qualifier_count-1;
 gate_source:=app.event_settings_playoff_source_v1(p_tournament_id,p_event_id);
 if gate_source->>'status'is distinct from'source_available'or gate_source->>'qualificationId'is distinct from qualification.id::text then return jsonb_build_object('status','blocked','code','playoff_gate_source_changed');end if;
 event_kind:=gate_source#>>'{source,settingsBinding,context,eventKind}';
 if coalesce(event_kind,'')not in('main','consolation')then return jsonb_build_object('status','blocked','code','unsupported_event_kind');end if;
 select count(*)::integer,coalesce(jsonb_agg(jsonb_build_object(
  'participantId',row.participant_id,'profileId',participant.profile_id,
  'displayName',row.display_name_snapshot,'tournamentPlayerId',seating.verification_id,
  'seed',row.ranking_ordinal
 )order by row.ranking_ordinal),'[]'::jsonb)
 into qualified_count,players
 from app.qualification_result_rows row
 join app.event_participants participant on participant.id=row.participant_id
  and participant.tournament_id=row.tournament_id and participant.event_id=row.event_id
 join app.initial_seating_assignments seating on seating.tournament_id=participant.tournament_id
  and seating.roster_entry_id=participant.roster_entry_id
 where row.result_version_id=qualification.id and row.qualification_status='qualified'
  and participant.profile_id is not null and participant.status='checked_in';
 if qualified_count<>qualification.qualifier_count
  or jsonb_array_length(players)<>qualification.qualifier_count
  or(select count(distinct value->>'participantId')from jsonb_array_elements(players))<>qualification.qualifier_count
  or(select count(distinct value->>'profileId')from jsonb_array_elements(players))<>qualification.qualifier_count
  or(select count(distinct value->>'tournamentPlayerId')from jsonb_array_elements(players))<>qualification.qualifier_count
 then return jsonb_build_object('status','blocked','code','qualified_player_identity_unavailable');end if;

 for slot_no in 1..slot_count loop
  match_source:=app.playoff_series_match_source_v1(
   p_tournament_id,p_event_id,qualification.id,slot_no
  );
  if match_source->>'status'='retry_exact'then return match_source;end if;
  if match_source->>'status'is distinct from'source_available'
   or match_source->'currentGenerationId'='null'::jsonb then
   return jsonb_build_object('status','blocked','code','playoff_series_incomplete','slot',slot_no);
  end if;
  current_result:=app.playoff_series_current_result_v1(
   p_tournament_id,p_event_id,qualification.id,slot_no
  );
  if current_result is null then
   return jsonb_build_object('status','blocked','code','playoff_series_incomplete','slot',slot_no);
  end if;
  select*into generation from app.playoff_series_generations_v1
   where id=(match_source->>'currentGenerationId')::uuid
    and tournament_id=p_tournament_id and event_id=p_event_id
    and qualification_id=qualification.id and slot=slot_no;
  select*into result_row from app.playoff_series_results_v1
   where id=(current_result->>'resultId')::uuid and generation_id=generation.id
    and tournament_id=p_tournament_id and event_id=p_event_id;
  if generation.id is null or result_row.id is null
   or generation.version<>(match_source->>'currentGenerationVersion')::integer
   or generation.source_digest is distinct from match_source->>'sourceDigest'
   or generation.source_capture is distinct from match_source->'source'
   or generation.settings_binding_id::text is distinct from match_source->>'settingsBindingId'
   or generation.context_review_id::text is distinct from match_source->>'reviewId'
   or generation.playoff_start_id::text is distinct from match_source->>'playoffStartId'
   or result_row.match_id is distinct from generation.match_id
   or result_row.source_digest is distinct from generation.source_digest
   or current_result->>'matchId'is distinct from generation.match_id::text
   or current_result->>'winnerId'is distinct from result_row.winner_participant_id::text
   or current_result->>'loserId'is distinct from result_row.loser_participant_id::text then
   return jsonb_build_object('status','blocked','code','playoff_series_source_changed','slot',slot_no);
  end if;
  if native_playoff_start_id is null then native_playoff_start_id:=generation.playoff_start_id;
  elsif native_playoff_start_id is distinct from generation.playoff_start_id then
   return jsonb_build_object('status','blocked','code','playoff_series_source_changed','slot',slot_no);
  end if;
  valid_result:=app.playoff_series_completed_result_valid_v1(result_row.id);
  if valid_result is distinct from true then
   return jsonb_build_object('status','blocked','code','playoff_game_evidence_changed','slot',slot_no);
  end if;

  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
   'operation',to_jsonb(operation_row),'action',to_jsonb(action_row),'submission',to_jsonb(submission_row),
   'confirmation',to_jsonb(confirmation_row)
  )order by game_row.game_number,action_row.game_version,action_row.id),'[]'::jsonb)::text,'utf8'),'sha256'),'hex')
  into action_history_digest
  from app.playoff_series_game_actions_v1 action_row
  join app.playoff_series_games_v1 game_row on game_row.id=action_row.game_id
   and game_row.generation_id=action_row.generation_id
  join app.playoff_series_game_operations_v1 operation_row on operation_row.actor_id=action_row.actor_id
   and operation_row.operation_id=action_row.operation_id
  left join app.playoff_series_game_submissions_v1 submission_row on submission_row.action_id=action_row.id
  left join app.playoff_series_game_confirmations_v1 confirmation_row on confirmation_row.action_id=action_row.id
  where action_row.generation_id=generation.id;

  select coalesce(jsonb_agg(jsonb_build_object(
   'actionId',action_row.id,'operationId',action_row.operation_id,'actorId',action_row.actor_id,
   'gameId',action_row.game_id,'gameVersion',action_row.game_version,'actionType',action_row.action_type,
   'priorSubmissionId',case when action_row.action_type in('submit','amend')
    then coalesce(operation_row.request_payload->'priorSubmissionId','null'::jsonb)else'null'::jsonb end,
   'submission',case when submission_row.id is null then null else jsonb_build_object(
    'submissionId',submission_row.id,'participantId',submission_row.participant_id,
    'winnerParticipantId',submission_row.winner_participant_id)end,
   'confirmation',case when confirmation_row.id is null then null else jsonb_build_object(
    'confirmationId',confirmation_row.id,'submissionId',confirmation_row.submission_id)end
  )order by game_row.game_number,action_row.game_version,action_row.id),'[]'::jsonb)into actions
  from app.playoff_series_game_actions_v1 action_row
  join app.playoff_series_games_v1 game_row on game_row.id=action_row.game_id
   and game_row.generation_id=action_row.generation_id
  join app.playoff_series_game_operations_v1 operation_row on operation_row.actor_id=action_row.actor_id
   and operation_row.operation_id=action_row.operation_id
  left join app.playoff_series_game_submissions_v1 submission_row on submission_row.action_id=action_row.id
  left join app.playoff_series_game_confirmations_v1 confirmation_row on confirmation_row.action_id=action_row.id
  where action_row.generation_id=generation.id;

  select coalesce(jsonb_agg(jsonb_build_object(
   'gameId',verified.game_id,'gameNumber',verified.game_number,
   'gameVersion',verified_action.game_version,'verifiedGameId',verified.id,
   'verifiedByActionId',verified.verified_by_action_id,
   'winnerParticipantId',verified.winner_participant_id,
   'loserParticipantId',verified.loser_participant_id,'sourceDigest',verified.source_digest,
   'submissions',jsonb_build_array(
    jsonb_build_object('submissionId',side_a_submission.id,'actionId',side_a_action.id,
     'actorId',side_a_submission.actor_profile_id,'winnerParticipantId',side_a_submission.winner_participant_id,
     'gameVersion',side_a_action.game_version),
    jsonb_build_object('submissionId',side_b_submission.id,'actionId',side_b_action.id,
     'actorId',side_b_submission.actor_profile_id,'winnerParticipantId',side_b_submission.winner_participant_id,
     'gameVersion',side_b_action.game_version)
   ),
   'confirmations',jsonb_build_array(
    jsonb_build_object('confirmationId',side_a_confirmation.id,'actionId',side_a_confirmation_action.id,
     'actorId',side_a_confirmation.actor_profile_id,'submissionId',side_a_confirmation.submission_id,
     'gameVersion',side_a_confirmation_action.game_version),
    jsonb_build_object('confirmationId',side_b_confirmation.id,'actionId',side_b_confirmation_action.id,
     'actorId',side_b_confirmation.actor_profile_id,'submissionId',side_b_confirmation.submission_id,
     'gameVersion',side_b_confirmation_action.game_version)
   )
  )order by verified.game_number),'[]'::jsonb)into games
  from app.playoff_series_verified_games_v1 verified
  join app.playoff_series_game_actions_v1 verified_action on verified_action.id=verified.verified_by_action_id
  join app.playoff_series_game_submissions_v1 side_a_submission on side_a_submission.id=verified.side_a_submission_id
  join app.playoff_series_game_actions_v1 side_a_action on side_a_action.id=side_a_submission.action_id
  join app.playoff_series_game_submissions_v1 side_b_submission on side_b_submission.id=verified.side_b_submission_id
  join app.playoff_series_game_actions_v1 side_b_action on side_b_action.id=side_b_submission.action_id
  join app.playoff_series_game_confirmations_v1 side_a_confirmation on side_a_confirmation.id=verified.side_a_confirmation_id
  join app.playoff_series_game_actions_v1 side_a_confirmation_action on side_a_confirmation_action.id=side_a_confirmation.action_id
  join app.playoff_series_game_confirmations_v1 side_b_confirmation on side_b_confirmation.id=verified.side_b_confirmation_id
  join app.playoff_series_game_actions_v1 side_b_confirmation_action on side_b_confirmation_action.id=side_b_confirmation.action_id
  where verified.generation_id=generation.id;
  if jsonb_array_length(games)<>result_row.game_count or jsonb_array_length(actions)>10000
   or action_history_digest is null or action_history_digest!~'^[a-f0-9]{64}$'then
   return jsonb_build_object('status','blocked','code','playoff_game_evidence_changed','slot',slot_no);
  end if;

  match_value:=jsonb_build_object(
   'slot',slot_no,'round',generation.round_name,'matchId',generation.match_id,
   'generationId',generation.id,'generationVersion',generation.version,
   'sourceDigest',generation.source_digest,'sourceCapture',generation.source_capture,
   'actionHistoryDigest',action_history_digest,'actions',actions,
   'participants',match_source->'participants','profiles',match_source->'profiles',
   'parentResultPins',match_source->'parentResultPins',
   'winsRequired',generation.wins_required,'maximumGames',generation.maximum_games,
   'result',jsonb_build_object(
    'resultId',result_row.id,'version',result_row.version,
    'winnerId',result_row.winner_participant_id,'loserId',result_row.loser_participant_id,
    'winsA',result_row.wins_a,'winsB',result_row.wins_b,
    'gameCount',result_row.game_count,'sourceDigest',result_row.source_digest,
    'gamesDigest',result_row.games_digest,
    'completedByProfileId',result_row.completed_by_profile_id,'operationId',result_row.operation_id
   ),'games',games
  );
  matches:=matches||jsonb_build_array(match_value);
 end loop;

 if jsonb_array_length(matches)<>slot_count
  or(select count(*)from app.playoff_series_matches_v1
     where tournament_id=p_tournament_id and event_id=p_event_id
      and qualification_id=qualification.id)<>slot_count
  or(select count(*)from app.playoff_series_results_v1 result
     join app.playoff_series_generations_v1 generation_row on generation_row.id=result.generation_id
     where generation_row.tournament_id=p_tournament_id and generation_row.event_id=p_event_id
      and generation_row.qualification_id=qualification.id)<>slot_count then
  return jsonb_build_object('status','blocked','code','playoff_series_set_changed');
 end if;

 capture_value:=jsonb_build_object('kind','native-playoff-sporting-source-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',p_tournament_id,'eventId',p_event_id,
  'qualification',jsonb_build_object('resultVersionId',qualification.id,'version',qualification.version,'participantCount',qualification.participant_count,'qualifierCount',qualification.qualifier_count),
  'eventKind',event_kind,
  'binding',jsonb_build_object('bindingId',gate_source->'settingsBindingId','settingsSnapshotId',gate_source#>'{source,settingsBinding,settings_snapshot_id}','reviewId',gate_source->'reviewId','activationId',gate_source#>'{source,activation,id}'),
  'draft',gate_source#>'{source,settingsBinding,draft}',
  'playoff',jsonb_build_object('qualificationResultVersionId',qualification.id,'qualificationVersion',qualification.version,'entrantCount',qualification.participant_count,'qualifierCount',qualification.qualifier_count,'eventKind',event_kind,
   'settingsSnapshotId',gate_source#>'{source,settingsBinding,settings_snapshot_id}','settingsBindingId',gate_source->'settingsBindingId','playoffStartId',native_playoff_start_id,'gateDigest',gate_source->'sourceDigest','players',players,'matches',matches),
  'readOnly',true,'actualMrpAwarded',false,'accSubmissionPerformed',false,'sourceConsistency','locked_database_capture');
 if app.native_playoff_mrp_source_enabled_v1()is distinct from true or app.native_playoff_mrp_actor_v1(p_tournament_id)is distinct from actor then return null;end if;
 source_digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-playoff-sporting-source-v1',capture_value)::text,'utf8'),'sha256'),'hex');
 return capture_value||jsonb_build_object('status','source_available','sourceDigest',source_digest);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return null;
end$$;
alter function app.native_playoff_mrp_source_enabled_v1()owner to postgres;
alter function app.native_playoff_mrp_actor_v1(uuid)owner to postgres;
alter function public.get_native_playoff_mrp_source_v1(uuid,uuid)owner to postgres;
revoke all on function app.native_playoff_mrp_source_enabled_v1(),app.native_playoff_mrp_actor_v1(uuid),public.get_native_playoff_mrp_source_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
