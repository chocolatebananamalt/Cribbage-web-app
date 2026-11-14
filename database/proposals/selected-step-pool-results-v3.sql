-- UNEXECUTED PRIVATE READ-ONLY CANDIDATE. Requires selected-step ownership/journal
-- V3. No writer replacements, current-source guard removal or grants.
begin;
create function app.selected_step_pool_results_enabled_v3()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
create function public.get_selected_step_pool_results_provider_v3(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $results$
declare f app.selected_step_pool_finals_v3%rowtype;h app.selected_step_pool_revisions_v3%rowtype;s jsonb;expected_count integer;
begin
 if app.selected_step_pool_results_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 lock table app.selected_step_pool_finals_v3,app.selected_step_pool_recipients_v3,app.selected_step_pool_revisions_v3 in share mode nowait;
 select*into f from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid;
 if f.id is null then return jsonb_build_object('status','held','code','pool_awards_not_recorded');end if;
 select*into h from app.selected_step_pool_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if h.id is distinct from f.proposal_revision_id or h.source_digest is distinct from f.source_digest or h.source_capture is distinct from f.source_capture then return jsonb_build_object('status','held','code','recorded_proposal_changed');end if;
 -- Rebuild all actual ownership, qualification, consent, policy, fixed identity
 -- and independently saved rounding evidence; history alone is not current proof.
 s:=app.get_selected_step_pool_source_v3(actor,tid,eid);
 if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'or s is distinct from f.source_capture or s->>'sourceDigest'is distinct from f.source_digest
  or s->'qMinor'is distinct from to_jsonb(f.q_minor)or s->'sideMinor'is distinct from to_jsonb(f.side_minor)or s->'totalMinor'is distinct from to_jsonb(f.total_minor)
 then return jsonb_build_object('status','held','code','current_pool_award_source_changed');end if;
 select count(*)into expected_count from jsonb_array_elements(s->'pools')p cross join lateral jsonb_array_elements(p->'recipients')r;
 if expected_count<>(select count(*)from app.selected_step_pool_recipients_v3 where final_id=f.id and tournament_id=tid and event_id=eid)
  or exists(select 1 from app.selected_step_pool_recipients_v3 x where x.final_id=f.id and x.tournament_id=tid and x.event_id=eid and not exists(
   select 1 from jsonb_array_elements(s->'pools')p cross join lateral jsonb_array_elements(p->'recipients')r
   where p->>'poolId'=x.pool_id::text and p->>'kind'=x.pool_kind and r->>'participantId'=x.participant_id::text and r->>'name'=x.display_name
    and r->>'tournamentPlayerId'=x.tournament_player_id and(r->>'amountMinor')::bigint=x.amount_minor and(p#>>'{policy,roundingUnitMinor}')::integer=x.rounding_unit_minor))
  or(select coalesce(sum(amount_minor),0)from app.selected_step_pool_recipients_v3 where final_id=f.id and tournament_id=tid and event_id=eid)<>f.total_minor
 then return jsonb_build_object('status','held','code','recorded_pool_recipients_changed');end if;
 return jsonb_build_object('kind','current-selected-step-pool-results-v3','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,
  'qualificationResultVersionId',s->'qualificationResultVersionId','finalId',f.id,'recordedAt',f.recorded_at,'sourceCapture',s,
  'snapshotConsistency','locked_source_snapshot','currentSourceVerified',true,'historicalOnly',false,'moneyMoved',false,'payoutAuthorized',false,'writeAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$results$;
alter function app.selected_step_pool_results_enabled_v3()owner to postgres;
alter function public.get_selected_step_pool_results_provider_v3(uuid,uuid,uuid)owner to postgres;
revoke all on function app.selected_step_pool_results_enabled_v3(),public.get_selected_step_pool_results_provider_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
