-- Rollback-only hosted proof for migration 0141. Use in an isolated test
-- transaction after the qualification-finalization fixture is available.
begin;

select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  q uuid; director uuid; tournament uuid; event uuid; p1 uuid; p2 uuid; hnq uuid;
  playoff jsonb; placements jsonb; saved jsonb; replay jsonb; rejected jsonb; workspace jsonb;
  playoff_version integer; settlement_version integer; op uuid:='a1410000-0000-4000-8000-000000000001';
begin
  select id,tournament_id,event_id,finalized_by_profile_id into q,tournament,event,director
    from app.qualification_result_versions order by finalized_at desc limit 1;
  select participant_id into p1 from app.qualification_result_rows
    where result_version_id=q and qualification_status='qualified' order by ranking_ordinal limit 1;
  select participant_id into p2 from app.qualification_result_rows
    where result_version_id=q and qualification_status='qualified' order by ranking_ordinal offset 1 limit 1;
  select participant_id into hnq from app.qualification_result_rows
    where result_version_id=q and qualification_status='high_non_qualifier' limit 1;
  if q is null or p1 is null or p2 is null or hnq is null then raise exception 'qualification fixture required'; end if;

  select coalesce(max(version),0) into playoff_version from app.standard_singles_playoff_result_versions where event_id=event;
  playoff:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,playoff_version,
    jsonb_build_array(jsonb_build_object('participantId',p1,'placement',1),jsonb_build_object('participantId',p2,'placement',2)),
    'b1410000-0000-4000-8000-000000000001');
  if playoff->>'status'<>'playoff_placements_recorded' then raise exception 'playoff fixture failed: %',playoff; end if;
  placements:=jsonb_build_array(
    jsonb_build_object('participantId',p1,'placement',1,'prizeAmountMinor',10000),
    jsonb_build_object('participantId',p2,'placement',2,'prizeAmountMinor',5000));
  select coalesce(max(version),0) into settlement_version from app.standard_singles_settlement_drafts where event_id=event;

  saved:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,settlement_version,placements,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('participantId',p1,'mrpPoints',0,
      'evidenceNote','Director transcription from dated ACC worksheet')),op);
  replay:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,settlement_version,placements,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('participantId',p1,'mrpPoints',0,
      'evidenceNote','Director transcription from dated ACC worksheet')),op);
  if saved<>replay or saved->>'status'<>'settlement_draft_saved' or saved->>'mrpClaimCount'<>'1'
    then raise exception 'v3 save/exact replay failed: % / %',saved,replay; end if;
  if not exists(select 1 from app.standard_singles_settlement_mrp_claims claim
      where claim.settlement_draft_id=(saved->>'settlementDraftId')::uuid and claim.participant_id=p1
        and claim.mrp_points=0 and claim.evidence_note='Director transcription from dated ACC worksheet')
    then raise exception 'explicit zero MRP claim was not preserved'; end if;
  if (select count(*) from app.standard_singles_settlement_mrp_claims claim
      where claim.settlement_draft_id=(saved->>'settlementDraftId')::uuid)<>1
    then raise exception 'missing MRP claims were not distinct from explicit zero'; end if;

  workspace:=public.get_standard_singles_settlement_workspace_v3(director,tournament,event);
  if workspace->>'currentVersion'<>saved->>'version'
    or workspace->'draft'->>'qualificationResultVersionId'<>q::text
    or jsonb_array_length(workspace->'draft'->'mrpClaims')<>1
    or workspace->'draft'->'mrpClaims'->0->>'mrpPoints'<>'0'
    or workspace->'capabilities'->>'mrpTranscription'<>'true'
    or workspace->'capabilities'->>'mrpCalculation'<>'false'
    then raise exception 'v3 workspace failed: %',workspace; end if;
  if public.get_standard_singles_settlement_reconciliation_v3(director,tournament,event,op)->'result'<>saved
    then raise exception 'v3 reconciliation did not return exact receipt'; end if;

  rejected:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,(saved->>'version')::integer,placements,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('participantId',hnq,'mrpPoints',1,
      'evidenceNote','Deliberately invalid non-qualifier fixture')),
    'a1410000-0000-4000-8000-000000000002');
  if rejected->>'code'<>'mrp_claim_scope_unavailable' then raise exception 'non-qualifier MRP accepted: %',rejected; end if;
  replay:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,(saved->>'version')::integer,placements,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('participantId',hnq,'mrpPoints',1,
      'evidenceNote','Deliberately invalid non-qualifier fixture')),
    'a1410000-0000-4000-8000-000000000002');
  if rejected<>replay then raise exception 'rejected v3 request did not replay exactly'; end if;
  replay:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,(saved->>'version')::integer,placements,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('participantId',p1,'mrpPoints',1,
      'evidenceNote','Changed request')),
    'a1410000-0000-4000-8000-000000000002');
  if replay->>'code'<>'idempotency_conflict' then raise exception 'changed v3 retry did not conflict'; end if;
  if not exists(select 1 from app.audit_events audit where audit.tournament_id=tournament
      and audit.action='settlement_working_copy_v3_idempotency_conflict')
    then raise exception 'changed retry conflict was not audited'; end if;

  rejected:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,(saved->>'version')::integer,placements,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('participantId',p1,'mrpPoints',1,'evidenceNote','')),
    'a1410000-0000-4000-8000-000000000003');
  if rejected->>'code'<>'invalid_mrp_claims' then raise exception 'missing MRP evidence accepted: %',rejected; end if;
  begin
    update app.standard_singles_settlement_mrp_claims set mrp_points=2
      where settlement_draft_id=(saved->>'settlementDraftId')::uuid and participant_id=p1;
    raise exception 'immutable MRP claim updated';
  exception when sqlstate 'P0001' then
    if sqlerrm='immutable MRP claim updated' then raise; end if;
  end;
end $$;

do $$ begin
  if has_table_privilege('authenticated','app.standard_singles_settlement_mrp_claims','SELECT')
    or has_function_privilege('authenticated','public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)','EXECUTE')
    then raise exception 'authenticated v3 settlement surface exposed'; end if;
end $$;

rollback;
