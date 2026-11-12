-- LOCAL additive compatibility repair. Original scores, raw numeric ranks and
-- immutable qualification/playoff history are never changed.
begin;
create function app.qualification_resolution_snapshot_current_v1(p_result_id uuid)
returns boolean language plpgsql stable security definer set search_path=''as $$
declare q app.qualification_result_versions%rowtype;groups jsonb;digest text;begin
 select *into q from app.qualification_result_versions where id=p_result_id;
 if not found or exists(select 1 from app.qualification_result_versions newer where newer.event_id=q.event_id and newer.version>q.version)then return false;end if;
 if not exists(select 1 from app.events e join app.ruleset_versions r on r.id=e.ruleset_version_id and r.tournament_id=e.tournament_id where e.id=q.event_id and e.tournament_id=q.tournament_id and e.format='standard_singles'and e.operational_state='active'and e.ruleset_version_id=q.ruleset_version_id and r.approved_at is not null and nullif(trim(r.source_reference),'')is not null)then return false;end if;
 -- Finalization-only phase requirements (open/draft publication) do not apply
 -- to reading an already finalized ranking. Score/dispute/correction guards do.
 if exists(select 1 from jsonb_array_elements(app.qualification_tie_blockers_v1(q.tournament_id,q.event_id))x where x#>>'{}'not in('tournament_unavailable','event_unavailable'))then return false;end if;
 groups:=app.qualification_tie_groups_v1(q.tournament_id,q.event_id);
 if exists(select 1 from jsonb_array_elements(groups)g where g->'resolution'='null'::jsonb
  or not exists(select 1 from app.qualification_tie_resolutions_v1 r where r.id=(g->'resolution'->>'id')::uuid and r.tournament_id=q.tournament_id and r.event_id=q.event_id and r.source_fingerprint=app.qualification_tie_source_v1(q.tournament_id,q.event_id)and r.recorded_at<=q.finalized_at))then return false;end if;
 select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked)order by ordinal)::text,'utf8'),'sha256'),'hex')into digest from app.qualification_resolved_rankings_v1(q.tournament_id,q.event_id)ranked;
 if digest is distinct from q.standings_digest or(select count(*)from app.qualification_result_rows where result_version_id=q.id)<>q.participant_count then return false;end if;
 if exists(select 1 from(select*from app.qualification_result_rows where result_version_id=q.id)saved full join app.qualification_resolved_rankings_v1(q.tournament_id,q.event_id)current_row on current_row.id=saved.participant_id
  where(saved.participant_id is null or current_row.id is null or saved.ranking_ordinal is distinct from current_row.ordinal or saved.numeric_rank is distinct from current_row.numeric_rank or saved.tied or current_row.tied
   or saved.verified_games is distinct from current_row.verified_games or saved.game_points is distinct from current_row.game_points or saved.games_won is distinct from current_row.games_won or saved.plus_points is distinct from current_row.plus_points or saved.minus_points is distinct from current_row.minus_points or saved.net_spread_points is distinct from current_row.plus_points-current_row.minus_points
   or saved.qualification_status is distinct from case when current_row.ordinal<=q.qualifier_count then'qualified'when current_row.ordinal=q.qualifier_count+1 then'high_non_qualifier'else'not_qualified'end))then return false;end if;
 return true;
end$$;
revoke all on function app.qualification_resolution_snapshot_current_v1(uuid)from public,anon,authenticated,service_role;

do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.derive_four_player_playoff_v3(uuid,jsonb)'::regprocedure);
 p:=replace(d,' select array_agg(participant_id order by ranking_ordinal),array_agg(game_points order by ranking_ordinal)',
 ' if exists(select 1 from app.qualification_result_rows where result_version_id=p_qualification_id and numeric_rank<>ranking_ordinal)and not app.qualification_resolution_snapshot_current_v1(p_qualification_id)then return null;end if;
 select array_agg(participant_id order by ranking_ordinal),array_agg(game_points order by ranking_ordinal)');
 if p=d then raise exception 'Reviewed v3 playoff full-snapshot anchor changed';end if;d:=p;
 p:=replace(d,'and not tied and numeric_rank=ranking_ordinal and verified_games=12',
 'and not tied and (numeric_rank=ranking_ordinal or app.qualification_resolution_snapshot_current_v1(p_qualification_id)) and verified_games=12');
 if p=d then raise exception 'Reviewed v3 playoff numeric-rank anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.canonical_settlement_mrp_v5(uuid,uuid,jsonb)'::regprocedure);
 p:=replace(d,'n:=q.qualifier_count;',
 'n:=q.qualifier_count;
 if exists(select 1 from app.qualification_result_rows where result_version_id=q.id and numeric_rank<>ranking_ordinal)and not(p_source->>''kind''=''playoff_outcome_v3'' and app.qualification_resolution_snapshot_current_v1(q.id))then return blocked;end if;');
 if p=d then raise exception 'Reviewed canonical MRP full-snapshot anchor changed';end if;d:=p;
 p:=replace(d,'r.tied or r.numeric_rank<>r.ranking_ordinal or',
 'r.tied or (r.numeric_rank<>r.ranking_ordinal and not(p_source->>''kind''=''playoff_outcome_v3'' and app.qualification_resolution_snapshot_current_v1(q.id))) or');
 if p=d then raise exception 'Reviewed canonical MRP numeric-rank anchor changed';end if;execute p;
 -- The public wrapper already holds the qualification lock before this core.
 -- Refresh a NEW accepted timestamp after validation for audit precision only.
 -- This is defensive, not a reproduced public race defect; replay/history stay.
 d:=pg_get_functiondef('app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(uuid,uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'v_response := jsonb_build_object(''status'',''qualification_finalized''',
 'v_finalized_at := clock_timestamp();
    v_response := jsonb_build_object(''status'',''qualification_finalized''');
 if p=d then raise exception 'Reviewed qualification acceptance timestamp anchor changed';end if;execute p;
end$$;
commit;
