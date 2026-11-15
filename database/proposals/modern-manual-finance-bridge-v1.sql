-- PRIVATE / DEFAULT OFF. Detailed ordinary manual evidence, not a Results DTO.
begin;
create function app.modern_manual_finance_bridge_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.modern_manual_sporting_source_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare q app.qualification_result_versions%rowtype;g app.modern_manual_playoff_generations_v1%rowtype;r app.modern_manual_playoff_results_v1%rowtype;gate jsonb;s jsonb;current_result jsonb;players jsonb;games jsonb;matches jsonb:='[]';capture jsonb;h text;slot_no integer;start_id uuid;event_kind text;
begin
 if app.modern_manual_finance_bridge_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 lock table app.modern_manual_playoff_matches_v1,app.modern_manual_playoff_generations_v1,app.modern_manual_playoff_games_v1,app.modern_manual_playoff_evidence_v1,app.modern_manual_playoff_verified_v1,app.modern_manual_playoff_results_v1,app.tournament_roles,app.paper_official_identity_bindings in share mode nowait;
 gate:=app.selected_step_pool_playoff_source_v3(actor,tid,eid);if gate->>'status'is distinct from'source_available'then return coalesce(gate,jsonb_build_object('status','blocked','code','manual_current_gate_required'));end if;
 select*into q from app.qualification_result_versions where id=(gate->>'qualificationId')::uuid and tournament_id=tid and event_id=eid;
 if q.id is null or q.qualifier_count not in(4,5)or q.qualifier_count<>ceil(q.participant_count::numeric/4)::integer or app.qualification_resolution_snapshot_current_v1(q.id)is distinct from true then return jsonb_build_object('status','blocked','code','manual_qualification_changed');end if;
 if exists(select 1 from app.playoff_series_matches_v1 where tournament_id=tid and event_id=eid and qualification_id=q.id)then return jsonb_build_object('status','blocked','code','mixed_sporting_protocol_conflict');end if;
 select event_type::text into event_kind from app.events where id=eid and tournament_id=tid;if event_kind not in('main','consolation')then return null;end if;
 -- Recipient profiles must be real persisted event identities; never invent an
 -- account/profile to make a paper participant fit a financial foreign key.
 if exists(select 1 from app.qualification_result_rows qr join app.event_participants p on p.id=qr.participant_id where qr.result_version_id=q.id and qr.qualification_status='qualified'and p.profile_id is null)then return jsonb_build_object('status','blocked','code','manual_prize_recipient_identity_required');end if;
 select jsonb_agg(jsonb_build_object('participantId',p.id,'profileId',p.profile_id,'displayName',qr.display_name_snapshot,'tournamentPlayerId',a.verification_id,'seed',qr.ranking_ordinal)order by qr.ranking_ordinal)into players from app.qualification_result_rows qr join app.event_participants p on p.id=qr.participant_id and p.tournament_id=tid and p.event_id=eid and p.status='checked_in'join app.initial_seating_assignments a on a.tournament_id=tid and a.roster_entry_id=p.roster_entry_id where qr.result_version_id=q.id and qr.qualification_status='qualified';
 if jsonb_array_length(players)is distinct from q.qualifier_count or(select count(distinct x->>'participantId')from jsonb_array_elements(players)x)<>q.qualifier_count or(select count(distinct x->>'profileId')from jsonb_array_elements(players)x)<>q.qualifier_count or(select count(distinct x->>'tournamentPlayerId')from jsonb_array_elements(players)x)<>q.qualifier_count then return jsonb_build_object('status','blocked','code','manual_current_players_required');end if;
 for slot_no in 1..q.qualifier_count-1 loop
  select*into g from app.modern_manual_playoff_generations_v1 where tournament_id=tid and event_id=eid and qualification_id=q.id and slot=slot_no order by version desc limit 1;if g.id is null then return jsonb_build_object('status','blocked','code','manual_series_incomplete');end if;
  s:=app.modern_manual_playoff_source_v1(g.actor_id,tid,eid,q.id,slot_no);current_result:=app.modern_manual_playoff_current_result_v1(g.actor_id,tid,eid,q.id,slot_no);
  if s->>'status'is distinct from'source_available'or s->>'currentGenerationId'is distinct from g.id::text or s->>'sourceDigest'is distinct from g.source_digest or s->'source'is distinct from g.source_capture or g.source_capture->>'gateDigest'is distinct from gate->>'sourceDigest'or current_result is null then return jsonb_build_object('status','blocked','code','manual_current_verified_series_required');end if;
  if(select count(*)from app.modern_manual_playoff_evidence_v1 e where e.generation_id=g.id)>10000 then return jsonb_build_object('status','blocked','code','manual_evidence_resource_bound');end if;
  select*into r from app.modern_manual_playoff_results_v1 where id=(current_result->>'resultId')::uuid and generation_id=g.id;if r.id is null then return null;end if;
  if start_id is null then start_id:=(g.source_capture->>'playoffStartId')::uuid;elsif start_id::text is distinct from g.source_capture->>'playoffStartId'then return null;end if;
  select jsonb_agg(jsonb_build_object('gameId',gg.id,'gameNumber',gg.game_number,'sourceDigest',gg.source_digest,
   'evidence',(select jsonb_agg(jsonb_build_object('id',e.id,'actorId',e.actor_id,'operationId',e.operation_id,'revision',e.revision,'action',e.action,'request',e.request,'winnerId',e.winner_id,'targetId',e.target_id,'paperClaims',e.paper_claims,'reason',e.reason,'identityBindingId',e.identity_binding_id,
    'identityCurrent',case when e.action in('paper-capture','paper-review','adjudicate')then app.modern_manual_playoff_independent_v1(e.actor_id,g.id)=e.identity_binding_id else null end,
    'roles',(select coalesce(jsonb_agg(tr.role order by tr.role),'[]')from app.tournament_roles tr where tr.tournament_id=tid and tr.profile_id=e.actor_id))order by e.revision)from app.modern_manual_playoff_evidence_v1 e where e.game_id=gg.id and e.generation_id=g.id),
   'verification',jsonb_build_object('id',v.id,'evidenceId',v.verified_by_evidence_id,'winnerId',v.winner_id,'proof',v.proof))order by gg.game_number)into games
  from app.modern_manual_playoff_games_v1 gg join app.modern_manual_playoff_verified_v1 v on v.game_id=gg.id and v.generation_id=g.id where gg.generation_id=g.id;
  matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'round',g.round_name,'matchId',g.match_id,'generationId',g.id,'generationVersion',g.version,'sourceDigest',g.source_digest,'sourceCapture',g.source_capture,'participants',jsonb_build_array(g.side_a_participant_id,g.side_b_participant_id),'profiles',g.source_capture->'profiles','parentResultPins',g.source_capture->'parentResultPins','winsRequired',g.wins_required,'maximumGames',g.maximum_games,
   'result',jsonb_build_object('resultId',r.id,'version',1,'winnerId',r.winner_participant_id,'loserId',r.loser_participant_id,'winsA',r.wins_a,'winsB',r.wins_b,'gameCount',r.game_count,'sourceDigest',r.source_digest,'gamesDigest',r.games_digest),'games',games));
 end loop;
 capture:=jsonb_build_object('kind','modern-manual-sporting-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'qualification',jsonb_build_object('resultVersionId',q.id,'version',q.version,'participantCount',q.participant_count,'qualifierCount',q.qualifier_count),'eventKind',event_kind,
  'binding',jsonb_build_object('bindingId',gate->'settingsBindingId','settingsSnapshotId',gate#>'{source,settingsBinding,settings_snapshot_id}','reviewId',gate->'reviewId','activationId',gate#>'{source,activation,id}'),'draft',gate#>'{source,settingsBinding,draft}',
  'playoff',jsonb_build_object('proofKind','ordinary-manual-playoff-v1','qualificationResultVersionId',q.id,'qualificationVersion',q.version,'entrantCount',q.participant_count,'qualifierCount',q.qualifier_count,'eventKind',event_kind,'settingsSnapshotId',gate#>'{source,settingsBinding,settings_snapshot_id}','settingsBindingId',gate->'settingsBindingId','playoffStartId',start_id,'gateDigest',gate->'sourceDigest','players',players,'matches',matches),
  'sourceConsistency','locked_database_capture','readOnly',true,'moneyMoved',false,'payoutAuthorized',false);
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('modern-manual-sporting-source-v1',capture)::text,'utf8'),'sha256'),'hex');return capture||jsonb_build_object('status','source_available','sourceDigest',h);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.selected_step_fund_sporting_source_v3(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 -- Once the event uses the new journal, missing/stale manual proof never falls
 -- back to digital or historical qualification evidence.
 if exists(select 1 from app.modern_manual_playoff_matches_v1 where tournament_id=tid and event_id=eid)then return app.modern_manual_sporting_source_v1(actor,sid,tid,eid);end if;
 return app.selected_step_sporting_source_v3(actor,sid,tid,eid);
end$$;
do $collector$declare target regprocedure:='app.selected_step_final_review_source_v3(uuid,uuid,uuid,uuid,uuid)'::regprocedure;body text;old text:='sport:=app.selected_step_sporting_source_v3(actor,sid,tid,eid);';begin
 if not exists(select 1 from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted manual fund collector';end if;body:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'manual fund collector anchor changed';end if;
 execute replace(replace(body,old,'sport:=app.selected_step_fund_sporting_source_v3(actor,sid,tid,eid);'),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$collector$;
-- Fund review is now able to pin the genuine new sporting domain. Award
-- recording remains held until a separately reviewed manual-aware final writer.
do $awards$declare target regprocedure:='app.current_selected_step_award_source_v3(uuid,uuid,uuid,uuid)'::regprocedure;body text;old text:='c:=f->''capture'';w:=c->''prizeWorkspace'';n:=c->''sportingSource'';input:=w#>''{nativeSource,capture,input}'';head:=w->''head'';';begin
 if not exists(select 1 from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted manual award hold';end if;body:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if(length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception'manual award source anchor changed';end if;
 execute replace(replace(body,old,old||' if n->>''kind''=''modern-manual-sporting-source-v1''then return jsonb_build_object(''status'',''blocked'',''code'',''manual_final_award_adapter_required'');end if;'),'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$awards$;
do $$declare s text;begin foreach s in array array['app.modern_manual_finance_bridge_enabled_v1()','app.modern_manual_sporting_source_v1(uuid,uuid,uuid,uuid)','app.selected_step_fund_sporting_source_v3(uuid,uuid,uuid,uuid)']loop execute format('alter function %s owner to postgres',s);execute format('revoke all on function %s from public,anon,authenticated,service_role',s);end loop;end$$;
-- Existing qualification writers cannot silently replace a played manual field.
create function app.guard_modern_manual_qualification_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if exists(select 1 from app.modern_manual_playoff_games_v1 g join app.modern_manual_playoff_evidence_v1 e on e.game_id=g.id where g.tournament_id=new.tournament_id and g.event_id=new.event_id)then if tg_table_name='event_settings_playoff_starts_v1'then raise exception'modern_manual_play_requires_separate_restart_review';else raise exception'modern_manual_play_requires_separate_qualification_correction';end if;end if;return new;
end$$;
create trigger modern_manual_played_field before insert on app.qualification_result_versions for each row execute function app.guard_modern_manual_qualification_v1();
create trigger modern_manual_played_field before insert on app.qualification_result_rows for each row execute function app.guard_modern_manual_qualification_v1();
create trigger modern_manual_played_field before insert on app.event_settings_playoff_starts_v1 for each row execute function app.guard_modern_manual_qualification_v1();
alter function app.guard_modern_manual_qualification_v1()owner to postgres;
revoke all on function app.guard_modern_manual_qualification_v1()from public,anon,authenticated,service_role;
commit;

