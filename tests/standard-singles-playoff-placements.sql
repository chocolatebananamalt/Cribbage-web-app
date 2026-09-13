-- Rollback-only hosted proof for migration 0139. Use only in an isolated test
-- transaction after the existing qualification/settlement fixture is loaded.
begin;

select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  q uuid; director uuid; tournament uuid; event uuid; p1 uuid; p2 uuid;
  first_result jsonb; replay jsonb; revised jsonb; rejected jsonb; workspace jsonb;
begin
  select id,tournament_id,event_id,finalized_by_profile_id into q,tournament,event,director
    from app.qualification_result_versions order by finalized_at desc limit 1;
  select participant_id into p1 from app.qualification_result_rows where result_version_id=q and qualification_status='qualified' order by ranking_ordinal limit 1;
  select participant_id into p2 from app.qualification_result_rows where result_version_id=q and qualification_status='qualified' order by ranking_ordinal offset 1 limit 1;
  if q is null or p1 is null or p2 is null then raise exception 'qualification fixture required'; end if;

  first_result:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,0,
    jsonb_build_array(jsonb_build_object('participantId',p1,'placement',1),jsonb_build_object('participantId',p2,'placement',2)),
    'a1390000-0000-4000-8000-000000000001');
  replay:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,0,
    jsonb_build_array(jsonb_build_object('participantId',p1,'placement',1),jsonb_build_object('participantId',p2,'placement',2)),
    'a1390000-0000-4000-8000-000000000001');
  if first_result<>replay or first_result->>'status'<>'playoff_placements_recorded' then raise exception 'playoff save/replay failed'; end if;

  rejected:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,0,
    jsonb_build_array(jsonb_build_object('participantId',p2,'placement',1),jsonb_build_object('participantId',p1,'placement',2)),
    'a1390000-0000-4000-8000-000000000002');
  if rejected->>'code'<>'stale_version' then raise exception 'stale version accepted'; end if;
  replay:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,0,
    jsonb_build_array(jsonb_build_object('participantId',p2,'placement',1),jsonb_build_object('participantId',p1,'placement',2)),
    'a1390000-0000-4000-8000-000000000002');
  if rejected<>replay then raise exception 'rejected playoff save did not replay exactly'; end if;
  replay:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,0,
    jsonb_build_array(jsonb_build_object('participantId',p1,'placement',1),jsonb_build_object('participantId',p2,'placement',2)),
    'a1390000-0000-4000-8000-000000000002');
  if replay->>'code'<>'idempotency_conflict' then raise exception 'changed rejected retry did not conflict'; end if;
  rejected:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,1,
    jsonb_build_array(jsonb_build_object('participantId',p1,'placement',1),jsonb_build_object('participantId',p1,'placement',2)),
    'a1390000-0000-4000-8000-000000000003');
  if rejected->>'code'<>'invalid_placements' then raise exception 'duplicate placement accepted'; end if;

  revised:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,1,
    jsonb_build_array(jsonb_build_object('participantId',p2,'placement',1),jsonb_build_object('participantId',p1,'placement',2)),
    'a1390000-0000-4000-8000-000000000004');
  if revised->>'version'<>'2' or revised->>'supersedesPlayoffResultVersionId'<>first_result->>'playoffResultVersionId' then raise exception 'version chain failed'; end if;
  workspace:=public.get_standard_singles_playoff_placement_workspace_v1(director,tournament,event);
  if workspace->>'currentVersion'<>'2' or jsonb_array_length(workspace->'playoffResult'->'placements')<>2 or workspace->'capabilities'->>'mrpCalculation'<>'false' then raise exception 'workspace failed'; end if;
  if (select count(*) from app.audit_events audit where audit.tournament_id=tournament and audit.entity_type='standard_singles_playoff_result_version' and audit.action='standard_singles_playoff_placements_recorded')<>2
    or (select count(*) from app.audit_events audit where audit.tournament_id=tournament and audit.entity_type='standard_singles_playoff_result_version' and audit.action='standard_singles_playoff_placements_rejected')<>2
    or exists(select 1 from app.audit_events audit left join app.operation_receipts receipt on receipt.id=audit.operation_receipt_id and receipt.tournament_id=audit.tournament_id where audit.tournament_id=tournament and audit.entity_type='standard_singles_playoff_result_version' and receipt.id is null)
  then raise exception 'receipt-bound playoff audit trail incomplete'; end if;
end $$;

do $$ begin
  if has_function_privilege('authenticated','public.record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') then raise exception 'authenticated playoff execute exposed'; end if;
end $$;

rollback;
