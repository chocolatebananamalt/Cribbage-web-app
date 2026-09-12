-- Rollback-only hosted lifecycle proof for migration 0145. The fixture creates
-- a fresh playoff and settlement working copy from the latest finalized
-- Standard Singles qualification in the test project, then rolls back.
begin;

select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  q uuid; tournament uuid; event uuid; director uuid; p1 uuid; p2 uuid; outsider uuid; game uuid;
  seed_roster uuid; seed_payment_version integer;
  source_payment app.roster_payment_events%rowtype;
  source_expense app.tournament_expense_events%rowtype;
  playoff jsonb; draft jsonb; workspace jsonb; accepted jsonb; replay jsonb; rejected jsonb;
  placements jsonb; claims jsonb; partial_claims jsonb; playoff_version integer; draft_version integer;
  payment_count integer; payment_total bigint; expense_count integer; expense_total bigint;
  original_tournament_status text; director_role text;
  dispute uuid := 'a1450000-0000-4000-8000-000000000010';
  dispute_open_receipt uuid := 'a1450000-0000-4000-8000-000000000011';
  dispute_close_receipt uuid := 'a1450000-0000-4000-8000-000000000012';
  replacement_void_receipt uuid := 'a1450000-0000-4000-8000-000000000013';
  replacement_received_receipt uuid := 'a1450000-0000-4000-8000-000000000014';
  replacement_void_event uuid := 'a1450000-0000-4000-8000-000000000015';
  replacement_received_event uuid := 'a1450000-0000-4000-8000-000000000016';
  seed_payment_receipt uuid := 'a1450000-0000-4000-8000-000000000017';
  seed_payment_event uuid := 'a1450000-0000-4000-8000-000000000018';
  seed_expense_receipt uuid := 'a1450000-0000-4000-8000-000000000030';
  seed_expense_id uuid := 'a1450000-0000-4000-8000-000000000031';
  seed_expense_event uuid := 'a1450000-0000-4000-8000-000000000032';
  replacement_expense_void_receipt uuid := 'a1450000-0000-4000-8000-000000000033';
  replacement_expense_void_event uuid := 'a1450000-0000-4000-8000-000000000034';
  replacement_expense_record_receipt uuid := 'a1450000-0000-4000-8000-000000000035';
  replacement_expense_id uuid := 'a1450000-0000-4000-8000-000000000036';
  replacement_expense_record_event uuid := 'a1450000-0000-4000-8000-000000000037';
  accepted_op uuid := 'a1450000-0000-4000-8000-000000000001';
begin
  select result.id,result.tournament_id,result.event_id,result.finalized_by_profile_id
    into q,tournament,event,director
  from app.qualification_result_versions result
  join app.tournaments t on t.id=result.tournament_id and t.status in('open','pending_finalization')
  order by result.finalized_at desc limit 1;
  select participant_id into p1 from app.qualification_result_rows
    where result_version_id=q and qualification_status='qualified' order by ranking_ordinal limit 1;
  select participant_id into p2 from app.qualification_result_rows
    where result_version_id=q and qualification_status='qualified' order by ranking_ordinal offset 1 limit 1;
  if q is null or p1 is null or p2 is null then raise exception 'finalized qualification with two qualifiers required'; end if;
  select status into original_tournament_status from app.tournaments where id=tournament;
  select role_row.role into director_role from app.tournament_roles role_row
    where role_row.tournament_id=tournament and role_row.profile_id=director
      and role_row.role in('director','co_director')
    order by case role_row.role when 'director' then 0 else 1 end limit 1;
  if director_role is null then raise exception 'current director or co-director role required'; end if;

  select coalesce(max(version),0) into playoff_version from app.standard_singles_playoff_result_versions where event_id=event;
  playoff:=public.record_standard_singles_playoff_placements_v1(director,tournament,event,q,playoff_version,
    jsonb_build_array(jsonb_build_object('participantId',p1,'placement',1),jsonb_build_object('participantId',p2,'placement',2)),
    'a1450000-0000-4000-8000-000000000020');
  if playoff->>'status'<>'playoff_placements_recorded' then raise exception 'playoff prerequisite failed: %',playoff; end if;

  placements:=jsonb_build_array(
    jsonb_build_object('participantId',p1,'placement',1,'prizeAmountMinor',0),
    jsonb_build_object('participantId',p2,'placement',2,'prizeAmountMinor',0));
  select coalesce(jsonb_agg(jsonb_build_object('participantId',row.participant_id,'mrpPoints',0,
      'evidenceNote','Fixture transcription: reviewed official source reports zero')), '[]'::jsonb)
    into claims from app.qualification_result_rows row
    where row.result_version_id=q and row.qualification_status='qualified';
  select coalesce(jsonb_agg(value), '[]'::jsonb) into partial_claims
    from (select value from jsonb_array_elements(claims) with ordinality claim(value,ordinality)
      where ordinality<jsonb_array_length(claims)) trimmed;

  if not exists(with latest as(select distinct on(roster_entry_id) * from app.roster_payment_events
      where tournament_id=tournament order by roster_entry_id,version desc)
    select 1 from latest where event_type='received') then
    select roster.id,coalesce(max(payment.version),0) into seed_roster,seed_payment_version
      from app.tournament_roster_entries roster
      left join app.roster_payment_events payment on payment.roster_entry_id=roster.id
      where roster.tournament_id=tournament
      group by roster.id having coalesce(max(payment.version),0)%2=0 order by roster.id limit 1;
    if seed_roster is null then raise exception 'roster entry required for payment source fixture'; end if;
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(seed_payment_receipt,tournament,director,'fixture_seed_payment',seed_roster,repeat('e',64),
        seed_payment_receipt,'accepted','{}',clock_timestamp());
    insert into app.roster_payment_events(id,tournament_id,roster_entry_id,version,event_type,amount_minor,currency_code,
        payment_method,payment_received_at,receipt_note,actor_profile_id,operation_receipt_id)
      values(seed_payment_event,tournament,seed_roster,seed_payment_version+1,'received',100,'USD','cash',
        clock_timestamp(),'Fixture payment source',director,seed_payment_receipt);
  end if;
  if not exists(with latest as(select distinct on(expense_id) * from app.tournament_expense_events
      where tournament_id=tournament order by expense_id,version desc)
    select 1 from latest where event_type='recorded') then
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(seed_expense_receipt,tournament,director,'fixture_seed_expense',seed_expense_id,repeat('1',64),
        seed_expense_receipt,'accepted','{}',clock_timestamp());
    insert into app.tournament_expense_events(id,tournament_id,expense_id,version,event_type,description,amount_minor,currency_code,
        actor_profile_id,actor_role,operation_receipt_id)
      values(seed_expense_event,tournament,seed_expense_id,1,'recorded','Fixture expense source',100,'USD',
        director,director_role,seed_expense_receipt);
  end if;
  select coalesce(max(version),0) into draft_version from app.standard_singles_settlement_drafts where event_id=event;
  draft:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,draft_version,placements,'[]'::jsonb,claims,
    'a1450000-0000-4000-8000-000000000021');
  if draft->>'status'<>'settlement_draft_saved' then raise exception 'settlement prerequisite failed: %',draft; end if;

  workspace:=public.get_standard_singles_settlement_finalization_workspace_v1(director,tournament,event);
  payment_count:=(workspace->'draft'->>'paymentReceiptCount')::integer;
  payment_total:=(workspace->'draft'->>'paymentReceiptTotalMinor')::bigint;
  expense_count:=(workspace->'draft'->>'expenseCount')::integer;
  expense_total:=(workspace->'draft'->>'expenseTotalMinor')::bigint;
  accepted:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    0,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Fixture director worksheet dated 2026-10-03',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    accepted_op);
  if accepted->>'status'<>'settlement_finalized_manual' or accepted->>'accSubmitted'<>'false'
    or accepted->>'reconciled'<>'true' then raise exception 'manual settlement finalization failed: %',accepted; end if;
  replay:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    0,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Fixture director worksheet dated 2026-10-03',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    accepted_op);
  if replay<>accepted then raise exception 'exact finalization replay failed: % / %',accepted,replay; end if;
  replay:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    0,1,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Changed retry',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    accepted_op);
  if replay->>'code'<>'idempotency_conflict' then raise exception 'changed finalization retry did not conflict: %',replay; end if;

  rejected:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,1,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Non-conserving fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000002');
  if rejected->>'code'<>'non_conserving_ledger' then raise exception 'non-conserving ledger accepted: %',rejected; end if;
  replay:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,1,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Non-conserving fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000002');
  if replay<>rejected then raise exception 'rejected finalization did not replay exactly'; end if;

  update app.tournaments set status='finalized' where id=tournament;
  replay:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    0,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Fixture director worksheet dated 2026-10-03',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    accepted_op);
  if replay<>accepted then raise exception 'closed-tournament accepted replay lost stored response: %',replay; end if;
  replay:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,1,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Non-conserving fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000002');
  if replay<>rejected then raise exception 'closed-tournament rejected replay lost stored response: %',replay; end if;
  update app.tournaments set status=original_tournament_status where id=tournament;

  rejected:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,0,0,0,0,0,0,payment_count+1,payment_total,expense_count,expense_total,
    'Changed ledger snapshot fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000003');
  if rejected->>'code'<>'ledger_snapshot_changed' then raise exception 'ledger snapshot change accepted: %',rejected; end if;

  select game_row.id into game from app.canonical_games game_row where game_row.tournament_id=tournament and game_row.event_id=event limit 1;
  if game is not null then
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(dispute_open_receipt,tournament,director,'fixture_open_dispute',dispute,repeat('a',64),dispute_open_receipt,'accepted','{}',clock_timestamp());
    insert into app.event_disputes(id,tournament_id,event_id,canonical_game_id,opened_by_profile_id,summary,open_operation_receipt_id)
      values(dispute,tournament,event,game,director,'Fixture unresolved dispute',dispute_open_receipt);
    insert into app.event_dispute_state_events(dispute_id,tournament_id,event_id,canonical_game_id,transition_sequence,state,actor_profile_id,actor_role,operation_receipt_id)
      values(dispute,tournament,event,game,1,'open',director,'director',dispute_open_receipt);
    rejected:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
      (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
      1,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,'Open dispute fixture',
      '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
      'a1450000-0000-4000-8000-000000000004');
    if rejected->>'code'<>'event_dispute_unresolved' then raise exception 'unresolved event dispute accepted: %',rejected; end if;
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(dispute_close_receipt,tournament,director,'fixture_resolve_dispute',dispute,repeat('b',64),dispute_close_receipt,'accepted','{}',clock_timestamp());
    insert into app.event_dispute_state_events(dispute_id,tournament_id,event_id,canonical_game_id,transition_sequence,state,actor_profile_id,actor_role,resolution_note,operation_receipt_id)
      values(dispute,tournament,event,game,2,'resolved',director,'director','Fixture resolved after rejection proof',dispute_close_receipt);
  end if;

  -- Preserve count and total while replacing one active immutable payment
  -- event ID. A count/amount-only comparison would incorrectly accept this.
  select payment.* into source_payment
    from app.standard_singles_settlement_payment_sources source
    join app.roster_payment_events payment on payment.id=source.payment_event_id
      and payment.roster_entry_id=source.roster_entry_id and payment.tournament_id=source.tournament_id
    where source.settlement_draft_id=(draft->>'settlementDraftId')::uuid
    order by payment.id limit 1;
  if source_payment.id is null then raise exception 'active payment source required for equal-value replacement fixture'; end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(replacement_void_receipt,tournament,director,'fixture_void_payment',source_payment.roster_entry_id,
      repeat('c',64),replacement_void_receipt,'accepted','{}',clock_timestamp());
  insert into app.roster_payment_events(id,tournament_id,roster_entry_id,version,event_type,amount_minor,currency_code,
      payment_method,payment_received_at,payment_voided_at,void_reason,voids_payment_event_id,actor_profile_id,operation_receipt_id)
    values(replacement_void_event,tournament,source_payment.roster_entry_id,source_payment.version+1,'voided',
      source_payment.amount_minor,'USD',source_payment.payment_method,source_payment.payment_received_at,clock_timestamp(),
      'Fixture equal-value replacement',source_payment.id,director,replacement_void_receipt);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(replacement_received_receipt,tournament,director,'fixture_replace_payment',source_payment.roster_entry_id,
      repeat('d',64),replacement_received_receipt,'accepted','{}',clock_timestamp());
  insert into app.roster_payment_events(id,tournament_id,roster_entry_id,version,event_type,amount_minor,currency_code,
      payment_method,payment_received_at,receipt_note,actor_profile_id,operation_receipt_id)
    values(replacement_received_event,tournament,source_payment.roster_entry_id,source_payment.version+2,'received',
      source_payment.amount_minor,'USD',source_payment.payment_method,source_payment.payment_received_at,
      'Fixture replacement with unchanged value',director,replacement_received_receipt);
  rejected:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,'Equal-value replacement fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000007');
  if rejected->>'code'<>'ledger_snapshot_changed' then raise exception 'equal-value payment event replacement accepted: %',rejected; end if;

  -- Re-snapshot the now-current payment sources before exercising the expense
  -- substitution, so that rejection can only be caused by the expense IDs.
  draft:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,(draft->>'version')::integer,placements,'[]'::jsonb,claims,
    'a1450000-0000-4000-8000-000000000023');
  if draft->>'status'<>'settlement_draft_saved' then raise exception 'expense replacement draft prerequisite failed: %',draft; end if;

  -- Mirror the payment proof for expenses: void one snapshotted expense and
  -- record a different expense for the same amount. Count and total remain
  -- unchanged, so only exact immutable source-ID binding catches the swap.
  select expense.* into source_expense
    from app.standard_singles_settlement_expense_sources source
    join app.tournament_expense_events expense on expense.id=source.expense_event_id
      and expense.expense_id=source.expense_id and expense.tournament_id=source.tournament_id
    where source.settlement_draft_id=(draft->>'settlementDraftId')::uuid
    order by expense.id limit 1;
  if source_expense.id is null then raise exception 'active expense source required for equal-value replacement fixture'; end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(replacement_expense_void_receipt,tournament,director,'fixture_void_expense',source_expense.expense_id,
      repeat('2',64),replacement_expense_void_receipt,'accepted','{}',clock_timestamp());
  insert into app.tournament_expense_events(id,tournament_id,expense_id,version,event_type,description,amount_minor,currency_code,
      actor_profile_id,actor_role,void_reason,voids_expense_event_id,operation_receipt_id)
    values(replacement_expense_void_event,tournament,source_expense.expense_id,2,'voided',source_expense.description,
      source_expense.amount_minor,'USD',director,director_role,'Fixture equal-value replacement',source_expense.id,
      replacement_expense_void_receipt);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(replacement_expense_record_receipt,tournament,director,'fixture_replace_expense',replacement_expense_id,
      repeat('3',64),replacement_expense_record_receipt,'accepted','{}',clock_timestamp());
  insert into app.tournament_expense_events(id,tournament_id,expense_id,version,event_type,description,amount_minor,currency_code,
      actor_profile_id,actor_role,operation_receipt_id)
    values(replacement_expense_record_event,tournament,replacement_expense_id,1,'recorded',source_expense.description,
      source_expense.amount_minor,'USD',director,director_role,replacement_expense_record_receipt);
  rejected:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,'Equal-value expense replacement fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000008');
  if rejected->>'code'<>'ledger_snapshot_changed' then raise exception 'equal-value expense event replacement accepted: %',rejected; end if;

  draft:=public.save_standard_singles_settlement_draft_v3(director,tournament,event,q,
    (playoff->>'playoffResultVersionId')::uuid,(draft->>'version')::integer,placements,'[]'::jsonb,partial_claims,
    'a1450000-0000-4000-8000-000000000022');
  if draft->>'status'<>'settlement_draft_saved' then raise exception 'incomplete MRP draft prerequisite failed: %',draft; end if;
  rejected:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
    1,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,'Incomplete MRP fixture',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    'a1450000-0000-4000-8000-000000000005');
  if rejected->>'code'<>'mrp_claims_incomplete' then raise exception 'incomplete MRP claims accepted: %',rejected; end if;

  select profile.id into outsider from app.profiles profile where not exists(select 1 from app.tournament_roles role_row
    where role_row.tournament_id=tournament and role_row.profile_id=profile.id and role_row.role in('director','co_director')) limit 1;
  if outsider is not null then
    rejected:=public.finalize_standard_singles_settlement_manual_v1(outsider,tournament,event,
      (draft->>'settlementDraftId')::uuid,(draft->>'version')::integer,q,(playoff->>'playoffResultVersionId')::uuid,
      1,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,'Unauthorized fixture',
      '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
      'a1450000-0000-4000-8000-000000000006');
    if rejected->>'code'<>'not_director' then raise exception 'unauthorized finalization accepted: %',rejected; end if;
  end if;

  -- An exact stored receipt is not an authorization token. Revoking the
  -- actor's current tournament authority must prevent even an exact replay.
  delete from app.tournament_roles role_row where role_row.tournament_id=tournament
    and role_row.profile_id=director and role_row.role in('director','co_director');
  replay:=public.finalize_standard_singles_settlement_manual_v1(director,tournament,event,
    (accepted->>'settlementDraftId')::uuid,(accepted->>'settlementDraftVersion')::integer,q,
    (playoff->>'playoffResultVersionId')::uuid,0,0,0,0,0,0,0,payment_count,payment_total,expense_count,expense_total,
    'Fixture director worksheet dated 2026-10-03',
    '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb,
    accepted_op);
  if replay->>'code'<>'not_director' then raise exception 'revoked director exact replay bypassed current authority: %',replay; end if;

  if not exists(select 1 from app.audit_events audit where audit.tournament_id=tournament
      and audit.action='standard_singles_settlement_manually_finalized')
    then raise exception 'finalization acceptance was not audited'; end if;
  if not exists(select 1 from app.audit_events audit where audit.tournament_id=tournament
      and audit.action='standard_singles_settlement_manual_finalization_rejected')
    then raise exception 'finalization rejection was not audited'; end if;
  begin
    update app.standard_singles_settlement_final_versions set retained_balance_minor=1
      where id=(accepted->>'finalizationId')::uuid;
    raise exception 'immutable finalization updated';
  exception when sqlstate 'P0001' then
    if sqlerrm='immutable finalization updated' then raise; end if;
  end;
end $$;

do $$ begin
  if has_table_privilege('authenticated','app.standard_singles_settlement_final_versions','SELECT')
    or has_function_privilege('authenticated','public.finalize_standard_singles_settlement_manual_v1(uuid,uuid,uuid,uuid,integer,uuid,uuid,integer,bigint,bigint,bigint,bigint,bigint,bigint,integer,bigint,integer,bigint,text,jsonb,uuid)','EXECUTE')
    then raise exception 'authenticated settlement finalization surface exposed'; end if;
end $$;

rollback;
