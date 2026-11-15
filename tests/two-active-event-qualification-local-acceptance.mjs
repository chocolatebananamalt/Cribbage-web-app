// Disposable local PostgreSQL proof. Registration foundations are direct
// synthetic fixtures; payment obligations/receipts, event enrollment,
// day attendance, official Start, allocation, schedule publication, digital
// score submission/confirmation, qualification/currentness and proposal
// writes use supported DB functions.
// No payout, provider or real money exists.
import assert from 'node:assert/strict';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
import {newEventPlayoffParametersDraftV1} from '../src/lib/playoffs/event-playoff-parameters-v1.ts';
import {createEventFinanceEditorV1,reduceEventFinanceEditorV1} from '../src/lib/finance/event-finance-workspace-v1.ts';

const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const id = (group, value) => `${group}0000-0000-4000-8000-${String(value).padStart(12, '0')}`;

function roundRobinMatches(gameCount) {
  const matches = [];
  let ring = Array.from({length: 18}, (_, index) => index + 1);
  for (let round = 1; round <= gameCount; round++) {
    for (let board = 0; board < 9; board++) {
      const a = ring[board], b = ring[17 - board];
      matches.push({
        gameNumber: round,
        sideAVerificationId: `A-${a}`,
        sideBVerificationId: `A-${b}`,
        sideATableSeat: round === 1 ? `A-${a}` : `A-${board * 2 + 1}`,
        sideBTableSeat: round === 1 ? `A-${b}` : `A-${board * 2 + 2}`,
      });
    }
    ring = [ring[0], ring[17], ...ring.slice(1, 17)];
  }
  return matches;
}

export function prepareTwoActiveCurrentQualificationSetup({read, actorId, tournamentId, nextOperationId}) {
  const owner = sql => read(sql, actorId, 'ownerAuthenticated');
  const base = owner(`select app.get_custom_q_setup_base_v2('${tournamentId}');`).base;
  const {revisionId,version,createdAt,...payload} = structuredClone(qSetupPrizeWorkspace(actorId).current);
  void revisionId; void version; void createdAt;
  const event = payload.events[0];
  delete event.sourceStatus;
  event.gameCount = 12;
  event.qPools = [];
  event.sidePools = [];
  const consolation={...structuredClone(event),clientRowId:'20000000-0000-4000-8000-000000000003',eventKind:'consolation',displayName:'Synthetic Active Consolation B',startsAt:'2027-02-03T13:00',gameCount:9,entryFeeCents:1000};
  payload.events.push(consolation);
  const envelope = {
    kind:'event-settings-setup-v3',
    setup:{kind:'setup-custom-payouts-v2',base,request:{expectedVersion:base.setupVersion,idempotencyKey:nextOperationId(),payload},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[consolation.clientRowId]}],customPayouts:[]},
    eventSettings:payload.events.map(e=>({eventClientRowId:e.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(e.eventKind)})),
  };
  const saved = owner(`select app.save_event_settings_draft_v3('${tournamentId}',${literal(envelope)});`);
  assert.equal(saved.status, 'event_settings_draft_saved',JSON.stringify(saved));
  const setupEventVersionId = owner(`select to_jsonb(id)from app.tournament_setup_event_versions where tournament_id='${tournamentId}'and setup_revision_id='${saved.linked.result.revisionId}'and event_kind='main'order by client_row_id limit 1;`);
  const savedGameCount = owner(`select to_jsonb(game_count)from app.tournament_setup_event_versions where id='${setupEventVersionId}';`);
  assert.equal(savedGameCount, 12);
  return {passed:true,scope:'private owner-authenticated candidate only',provider:false,activation:false,money:false,settingsSnapshotId:saved.settingsSnapshotId,setupEventVersionId};
}

export async function verifyTwoActiveMainCurrentQualification({q, read, actorId, outsiderId, tournamentId, nextOperationId, writeEvidence = () => {}}) {
  const owner = (sql, who = actorId) => read(sql, who, 'ownerAuthenticated');
  const service = sql => owner(`set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actorId}';set request.jwt.claims='{"role":"service_role","sub":"${actorId}"}';${sql}`);
  const enabled = sql => owner(`set app.fixture_operational_finance_proposals='approved-local-only';${sql}`);
  const binding = owner(`select jsonb_build_object(
    'eventId',b.event_id,'activationId',b.activation_id,'setupEventVersionId',b.setup_event_version_id,
    'gameCount',v.game_count,'entryFeeMinor',v.entry_fee_cents
  ) from app.event_settings_operational_bindings_v1 b
  join app.tournament_setup_event_versions v on v.id=b.setup_event_version_id
  where b.tournament_id='${tournamentId}'and v.event_kind='main';`);
  assert.deepEqual({gameCount: binding.gameCount, entryFeeMinor: binding.entryFeeMinor}, {gameCount: 12, entryFeeMinor: 3000});
  const eventId = binding.eventId;
  assert.equal(owner(`select to_jsonb(count(*))from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`), 0);
  assert.equal(owner(`select to_jsonb(count(*))from app.qualification_result_versions where tournament_id='${tournamentId}'and event_id='${eventId}';`), 0);

  // One participant/roster/payment comes from the reviewed setup + Finance
  // fixture. Add seventeen fictional people before schedule publication.
  const linkId = owner(`select to_jsonb(id)from app.tournament_registration_links where tournament_id='${tournamentId}'order by created_at limit 1;`);
  const existing = owner(`select jsonb_build_object('participantId',p.id,'rosterId',p.roster_entry_id)
    from app.event_participants p where p.tournament_id='${tournamentId}'and p.event_id='${eventId}';`);
  assert.ok(existing.participantId); assert.ok(existing.rosterId);
  q(`update app.profiles set display_name='Synthetic Qualifier 01' where id='${outsiderId}';
    update app.event_participants set status='checked_in',table_seat='A-1' where id='${existing.participantId}';
    insert into app.tournament_roles(tournament_id,profile_id,role)values('${tournamentId}','${outsiderId}','player')on conflict do nothing;`);

  const newProfiles = Array.from({length: 17}, (_, offset) => ({index: offset + 2, profileId: id('a294', offset + 2)}));
  q(`insert into auth.users(id,email)values ${newProfiles.map(({index, profileId}) => `('${profileId}','synthetic-q-${String(index).padStart(2, '0')}@test.invalid')`).join(',')};
    update app.profiles p set display_name=v.display_name from(values ${newProfiles.map(({index, profileId}) => `('${profileId}'::uuid,'Synthetic Qualifier ${String(index).padStart(2, '0')}')`).join(',')})v(id,display_name)where p.id=v.id;
    insert into app.tournament_roles(tournament_id,profile_id,role)values ${newProfiles.map(({profileId}) => `('${tournamentId}','${profileId}','player')`).join(',')};`);

  for (const {index, profileId} of newProfiles) {
    const receiptId = id('b294', index), claimId = id('c294', index), decisionId = id('d294', index);
    const rosterId = id('e294', index), participantId = id('f294', index);
    const name = `Synthetic Qualifier ${String(index).padStart(2, '0')}`;
    const email = `synthetic-q-${String(index).padStart(2, '0')}@test.invalid`;
    q(`insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values('${receiptId}','${tournamentId}','${actorId}','current_q_fixture_roster','${rosterId}',repeat('${index % 10}',64),'${id('1294', index)}','accepted','{}',clock_timestamp());
      insert into app.registration_claims(id,tournament_id,registration_link_id,display_name,normalized_name,email,normalized_email,intended_payment_method,status,client_operation_id,request_fingerprint)
      values('${claimId}','${tournamentId}','${linkId}','${name}','${name.toLowerCase()}','${email}','${email}','cash','accepted','${id('2294', index)}',repeat('${(index + 1) % 10}',64));
      insert into app.registration_claim_decisions(id,tournament_id,claim_id,decision,actor_profile_id,operation_receipt_id)
      values('${decisionId}','${tournamentId}','${claimId}','approved_for_roster','${actorId}','${receiptId}');
      insert into app.tournament_roster_entries(id,tournament_id,source_claim_id,approval_decision_id,claimed_display_name,claimed_normalized_name,claimed_email,claimed_normalized_email,creator_profile_id,operation_receipt_id)
      values('${rosterId}','${tournamentId}','${claimId}','${decisionId}','${name}','${name.toLowerCase()}','${email}','${email}','${actorId}','${receiptId}');
      insert into app.event_participants(id,tournament_id,event_id,profile_id,status,roster_entry_id,table_seat)
      values('${participantId}','${tournamentId}','${eventId}','${profileId}','checked_in','${rosterId}','A-${index}');`);
    const payment = owner(`select public.record_manual_roster_payment('${tournamentId}','${rosterId}',0,${binding.entryFeeMinor},'USD','cash',clock_timestamp()-interval '1 second','Synthetic local current-qualification receipt','${id('3294', index)}');`);
    assert.equal(payment.status, 'payment_recorded');
  }
  assert.equal(owner(`select to_jsonb(count(*))from app.event_participants where tournament_id='${tournamentId}'and event_id='${eventId}'and status='checked_in';`), 18);

  // Establish the current per-roster event fee through the supported obligation
  // writer. A receipt plus participant status is not, by itself, event-day paid
  // enrollment evidence for desk check-in.
  const paidRosterIds = owner(`select jsonb_agg(p.roster_entry_id order by p.table_seat)
    from app.event_participants p where p.tournament_id='${tournamentId}'and p.event_id='${eventId}';`);
  assert.equal(paidRosterIds.length, 18);
  const obligationResponses = [];
  for (const rosterId of paidRosterIds) {
    const currentVersion = owner(`select to_jsonb(coalesce(max(version),0))from app.roster_payment_obligation_versions where tournament_id='${tournamentId}'and roster_entry_id='${rosterId}';`);
    const operationId = nextOperationId();
    const response = owner(`select public.set_roster_payment_obligation_v1(
      '${tournamentId}','${rosterId}',${currentVersion},${binding.entryFeeMinor},
      'Synthetic local configured Main entry fee','${operationId}'
    );`);
    assert.equal(response.status, 'payment_obligation_saved', JSON.stringify(response));
    assert.deepEqual(owner(`select public.set_roster_payment_obligation_v1(
      '${tournamentId}','${rosterId}',${currentVersion},${binding.entryFeeMinor},
      'Synthetic local configured Main entry fee','${operationId}'
    );`), response);
    obligationResponses.push(response);
  }
  assert.equal(owner(`select to_jsonb(count(*))from app.event_participants p where p.tournament_id='${tournamentId}'and p.event_id='${eventId}'and app.event_qr_player_is_paid_and_enrolled(p.tournament_id,p.event_id,p.roster_entry_id);`),18);

  const ledgerSource = owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`);
  assert.equal(ledgerSource.status, 'sources_available');
  assert.equal(ledgerSource.facts.receiptEvents.length, 18);
  assert.equal(ledgerSource.facts.expenseEvents.length, 1);
  const allocations = [
    ...ledgerSource.facts.receiptEvents.map(row => ({sourceId: row.sourceId, allocations: [{eventId, bucket:'regular_entry', poolId:null, amountMinor:row.amountMinor, classificationReviewed:true}]})),
    ...ledgerSource.facts.expenseEvents.map(row => ({sourceId: row.sourceId, allocations: [{eventId, bucket:'operating_expense', poolId:null, amountMinor:row.amountMinor, classificationReviewed:true}]})),
  ];
  const allocationHead = owner(`select to_jsonb(id)from app.native_ledger_allocation_revisions_v1 where tournament_id='${tournamentId}'order by version desc limit 1;`);
  const allocationRequest = {kind:'native-ledger-allocation-v1',operationId:nextOperationId(),expectedRevisionId:allocationHead,sourceDigest:ledgerSource.sourceDigest,allocations,reason:'Synthetic 18-player current-qualification allocation',reviewed:true};
  let allocationSaved = owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(allocationRequest)});`);
  assert.equal(allocationSaved.status, 'accepted');
  assert.deepEqual(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(allocationRequest)});`), {...allocationSaved,replayed:true,historicalReceipt:true,fundAvailable:false});

  // The reviewed schedule publisher writes canonical games only after the
  // supported attendance, registration-close and seating lifecycle has
  // established immutable roster/seat capacity. Participant status/tableSeat
  // alone is deliberately insufficient evidence for that trigger.
  const rosterSeats = owner(`select jsonb_agg(jsonb_build_object(
    'rosterEntryId',ep.roster_entry_id,'profileId',ep.profile_id,'tableSeat',ep.table_seat
  )order by split_part(ep.table_seat,'-',2)::integer)
  from app.event_participants ep
  where ep.tournament_id='${tournamentId}'and ep.event_id='${eventId}';`);
  assert.equal(rosterSeats.length, 18);
  assert.deepEqual(owner(`select jsonb_build_object('status',status,'registrationStatus',registration_status)from app.tournaments where id='${tournamentId}';`), {status:'open',registrationStatus:'open'});
  assert.equal(owner(`select to_jsonb(count(*))from app.roster_account_links where tournament_id='${tournamentId}';`),0);
  const rosterLinkRequests = rosterSeats.map(seat => ({
    ...seat,activationId:nextOperationId(),issueOperationId:nextOperationId(),redeemOperationId:nextOperationId(),decisionOperationId:nextOperationId(),
  }));
  // Fictional local identities traverse the supported service-only activation,
  // redemption and witnessed-decision lifecycle. The fixed digest is test data,
  // never a provider credential or evidence of an independent human witness.
  q(`do $supported_links$declare item jsonb;issued jsonb;redeemed jsonb;approved jsonb;begin
    perform set_config('request.jwt.claim.role','service_role',true);
    perform set_config('request.jwt.claim.sub','${actorId}',true);
    perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub','${actorId}')::text,true);
    for item in select value from jsonb_array_elements(${literal(rosterLinkRequests)})loop
      issued:=public.issue_roster_account_activation_v1('${actorId}','${tournamentId}',(item->>'rosterEntryId')::uuid,(item->>'activationId')::uuid,decode(repeat('11',32),'hex'),decode(repeat('22',32),'hex'),clock_timestamp()+interval '30 minutes',(item->>'issueOperationId')::uuid);
      if issued->>'status'is distinct from'issued'then raise exception 'Synthetic activation issue failed: %',jsonb_build_object('item',item,'response',issued);end if;
      redeemed:=public.redeem_roster_account_activation_v1((item->>'profileId')::uuid,(item->>'activationId')::uuid,decode(repeat('22',32),'hex'),(item->>'redeemOperationId')::uuid);
      if redeemed->>'status'is distinct from'pending'then raise exception 'Synthetic activation redemption failed: %',jsonb_build_object('item',item,'response',redeemed);end if;
      approved:=public.decide_roster_account_activation_v1('${actorId}','${tournamentId}',(redeemed->>'requestId')::uuid,'approve',redeemed->>'confirmationPhrase',(item->>'decisionOperationId')::uuid);
      if approved->>'status'is distinct from'approved'then raise exception 'Synthetic activation decision failed: %',jsonb_build_object('item',item,'response',approved);end if;
    end loop;
  end $supported_links$;`,actorId,'ownerAuthenticated');
  assert.deepEqual(owner(`select jsonb_build_object(
    'links',(select count(*)from app.roster_account_links where tournament_id='${tournamentId}'),
    'matchingParticipants',(select count(*)from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id and l.profile_id=ep.profile_id where ep.tournament_id='${tournamentId}'and ep.event_id='${eventId}')
  );`),{links:18,matchingParticipants:18});
  for (const seat of rosterSeats) {
    const checkIn = owner(`select public.record_roster_check_in_event_v2(
      '${tournamentId}','${seat.rosterEntryId}','checked_in',
      'Synthetic local current-qualification attendance','${nextOperationId()}'
    );`);
    assert.equal(checkIn.status, 'check_in_recorded', JSON.stringify(checkIn));
  }
  const enrollmentOperation = nextOperationId();
  const rosterEntryIds = rosterSeats.map(row => row.rosterEntryId);
  const enrollment = service(`select public.enroll_roster_entries_in_event_v3(
    '${actorId}','${tournamentId}','${eventId}',${literal(rosterEntryIds)},'${enrollmentOperation}'
  );`);
  assert.deepEqual({status:enrollment.status,requestedCount:enrollment.requestedCount,createdCount:enrollment.createdCount,existingCount:enrollment.existingCount},
    {status:'event_participants_enrolled',requestedCount:18,createdCount:0,existingCount:18},JSON.stringify(enrollment));
  assert.deepEqual(service(`select public.enroll_roster_entries_in_event_v3(
    '${actorId}','${tournamentId}','${eventId}',${literal(rosterEntryIds)},'${enrollmentOperation}'
  );`), enrollment);
  const closeOperation = nextOperationId();
  const registrationClose = service(`select public.close_tournament_registration_v2(
    '${actorId}','${tournamentId}','${closeOperation}'
  );`);
  assert.equal(registrationClose.status, 'registration_closed', JSON.stringify(registrationClose));
  assert.deepEqual(service(`select public.close_tournament_registration_v2(
    '${actorId}','${tournamentId}','${closeOperation}'
  );`), registrationClose);
  const seatingOperation = nextOperationId();
  const seatingAssignments = rosterSeats.map(({rosterEntryId,tableSeat}) => ({rosterEntryId,tableSeat}));
  assert.ok(seatingAssignments.every(row => Object.keys(row).sort().join(',') === 'rosterEntryId,tableSeat'));
  const seatingPreconditions = owner(`select jsonb_build_object(
    'assignmentCount',${seatingAssignments.length},
    'checkedInRosterCount',(select count(*)from app.tournament_roster_entries r where r.tournament_id='${tournamentId}'and coalesce((select c.check_in_state from app.roster_check_in_events c where c.tournament_id=r.tournament_id and c.roster_entry_id=r.id order by c.version desc limit 1),'')='checked_in'),
    'distinctRosterIds',(select count(distinct value->>'rosterEntryId')from jsonb_array_elements(${literal(seatingAssignments)})),
    'distinctTableSeats',(select count(distinct value->>'tableSeat')from jsonb_array_elements(${literal(seatingAssignments)}))
  );`);
  const seating = owner(`select public.publish_initial_seating_v2(
    '${tournamentId}',1::smallint,18::smallint,${literal(seatingAssignments)},'${seatingOperation}'
  );`);
  writeEvidence('seating-lifecycle-attempt.json', {obligationResponses,enrollment,seatingPreconditions,seating});
  assert.equal(seating.status, 'initial_seating_published', JSON.stringify(seating));
  assert.deepEqual(owner(`select public.publish_initial_seating_v2(
    '${tournamentId}',1::smallint,18::smallint,${literal(seatingAssignments)},'${seatingOperation}'
  );`), seating);

  // Supported publication creates the canonical 12x9 schedule.
  const matches = roundRobinMatches(binding.gameCount);
  assert.equal(matches.length, 108);
  assert.equal(new Set(matches.map(row => [row.sideAVerificationId,row.sideBVerificationId].sort().join(':'))).size, 108);
  assert.ok(matches.filter(row => row.gameNumber === 1).every(row => row.sideAVerificationId === row.sideATableSeat && row.sideBVerificationId === row.sideBTableSeat));
  const appearances = new Map();
  for (let round = 1; round <= binding.gameCount; round++) {
    const rows = matches.filter(row => row.gameNumber === round);
    const ids = rows.flatMap(row => [row.sideAVerificationId,row.sideBVerificationId]);
    const seats = rows.flatMap(row => [row.sideATableSeat,row.sideBTableSeat]);
    assert.equal(rows.length, 9); assert.equal(new Set(ids).size, 18); assert.equal(new Set(seats).size, 18);
    for (const verificationId of ids) appearances.set(verificationId,(appearances.get(verificationId) ?? 0) + 1);
  }
  assert.equal(appearances.size, 18);
  assert.ok([...appearances.values()].every(count => count === binding.gameCount));
  const schedulePreconditions = owner(`select jsonb_build_object(
    'tournamentStatus',(select status from app.tournaments where id='${tournamentId}'),
    'registrationStatus',(select registration_status from app.tournaments where id='${tournamentId}'),
    'eventFormat',(select format from app.events where id='${eventId}'),
    'scoringMethod',(select scoring_method from app.events where id='${eventId}'),
    'rulesetApproved',(select rv.approved_at is not null from app.events e join app.ruleset_versions rv on rv.id=e.ruleset_version_id where e.id='${eventId}'),
    'participantCount',(select count(*)from app.event_participants where event_id='${eventId}'),
    'checkedInParticipantCount',(select count(*)from app.event_participants where event_id='${eventId}'and status='checked_in'),
    'checkedInRosterCount',(select count(*)from app.tournament_roster_entries r where r.tournament_id='${tournamentId}'and coalesce((select c.check_in_state from app.roster_check_in_events c where c.tournament_id=r.tournament_id and c.roster_entry_id=r.id order by c.version desc limit 1),'')='checked_in'),
    'seatingPublicationCount',(select count(*)from app.initial_seating_publications where tournament_id='${tournamentId}'),
    'seatingAssignmentCount',(select count(*)from app.initial_seating_assignments where tournament_id='${tournamentId}'),
    'tableCount',(select table_count from app.initial_seating_publications where tournament_id='${tournamentId}'),
    'seatsPerTable',(select seats_per_table from app.initial_seating_publications where tournament_id='${tournamentId}'),
    'schedulePublicationCount',(select count(*)from app.event_schedule_publications where event_id='${eventId}'),
    'canonicalGameCount',(select count(*)from app.canonical_games where event_id='${eventId}')
  );`);
  assert.deepEqual(schedulePreconditions, {
    tournamentStatus:'open',registrationStatus:'closed',eventFormat:'standard_singles',scoringMethod:'digital',rulesetApproved:true,
    participantCount:18,checkedInParticipantCount:18,checkedInRosterCount:18,seatingPublicationCount:1,seatingAssignmentCount:18,
    tableCount:1,seatsPerTable:18,schedulePublicationCount:0,canonicalGameCount:0,
  });
  const publicationOperation = nextOperationId();
  const publication = service(`select public.publish_director_reviewed_event_schedule_v1('${actorId}','${tournamentId}','${eventId}',${literal(matches)},true,'${publicationOperation}');`);
  writeEvidence('schedule-publication-attempt.json', {publication,schedulePreconditions});
  assert.equal(publication.status, 'event_schedule_published', JSON.stringify({publication,schedulePreconditions},null,2));
  assert.deepEqual({gameCount:publication.gameCount,participantCount:publication.participantCount,matchCount:publication.matchCount},{gameCount:12,participantCount:18,matchCount:108});
  assert.deepEqual(service(`select public.publish_director_reviewed_event_schedule_v1('${actorId}','${tournamentId}','${eventId}',${literal(matches)},true,'${publicationOperation}');`), publication);

  // Day attendance is distinct from roster check-in and event enrollment. Use
  // the supported event window + desk flow, close it, then perform the official
  // Start with the exact current roster snapshot before accepting score writes.
  const openOperation = nextOperationId();
  const opened = service(`select public.open_event_check_in_window_v1('${actorId}','${tournamentId}','${eventId}','${openOperation}');`);
  const deskResponses = rosterSeats.map(row => {
    const operationId = nextOperationId();
    return service(`select public.desk_check_in_event_v1('${actorId}','${tournamentId}','${eventId}','${row.rosterEntryId}','${operationId}');`);
  });
  const closeWindowOperation = nextOperationId();
  const closed = service(`select public.close_event_check_in_window_v1('${actorId}','${tournamentId}','${eventId}','${closeWindowOperation}');`);
  const participantSnapshotDigest = owner(`select to_jsonb(app.event_participant_snapshot_digest_v1('${eventId}'));`);
  const startPreconditions = owner(`select jsonb_build_object(
    'windowState',(select state from app.event_check_in_windows where event_id='${eventId}'),
    'unresolvedAttendance',app.event_attendance_unresolved_count_v1('${eventId}'),
    'pendingDeskRequests',(select count(*)from app.event_check_in_requests where event_id='${eventId}'and request_state='pending_desk'),
    'readyToStart',app.event_attendance_ready_to_start_v1('${eventId}'),
    'paidAndEnrolledCount',(select count(*)from app.event_participants p where p.event_id='${eventId}'and app.event_qr_player_is_paid_and_enrolled(p.tournament_id,p.event_id,p.roster_entry_id)),
    'participantSnapshotDigest',app.event_participant_snapshot_digest_v1('${eventId}'),
    'participantCount',(select count(*)from app.event_participants where event_id='${eventId}'),
    'roundCount',(select count(*)from app.rounds where event_id='${eventId}'),
    'scheduledMatchCount',(select count(*)from app.event_schedule_games where event_id='${eventId}')
  );`);
  const startOperation = nextOperationId();
  const started = service(`select public.start_event_play_v1(
    '${actorId}','${tournamentId}','${eventId}','${publication.publicationId}',
    '${participantSnapshotDigest}',18,12,true,'${startOperation}'
  );`);
  writeEvidence('event-play-start-attempt.json', {opened,deskResponses,closed,startPreconditions,started});
  assert.equal(opened.status,'event_check_in_opened',JSON.stringify(opened));
  assert.equal(deskResponses.length,18);
  assert.ok(deskResponses.every(response => response.status==='checked_in'),JSON.stringify(deskResponses));
  assert.equal(closed.status,'event_check_in_closed',JSON.stringify(closed));
  assert.deepEqual(startPreconditions,{windowState:'closed',unresolvedAttendance:0,pendingDeskRequests:0,readyToStart:true,
    paidAndEnrolledCount:18,participantSnapshotDigest,participantCount:18,roundCount:12,scheduledMatchCount:108});
  assert.equal(started.status,'event_started',JSON.stringify(started));
  assert.deepEqual({participantCount:started.participantCount,gameCount:started.gameCount,scheduleMatchCount:started.scheduleMatchCount,playState:started.playState},
    {participantCount:18,gameCount:12,scheduleMatchCount:108,playState:'in_progress'});
  assert.deepEqual(service(`select public.start_event_play_v1(
    '${actorId}','${tournamentId}','${eventId}','${publication.publicationId}',
    '${participantSnapshotDigest}',18,12,true,'${startOperation}'
  );`), started);
  assert.deepEqual(owner(`select jsonb_build_object(
    'starts',(select count(*)from app.event_play_starts where event_id='${eventId}'),
    'sanctioningSnapshots',(select count(*)from app.event_sanctioning_fee_snapshots where event_id='${eventId}'),
    'playState',app.event_play_state_v1('${eventId}')
  );`),{starts:1,sanctioningSnapshots:1,playState:'in_progress'});

  // The Start-time sanctioning assessment is recorded through the supported
  // expense RPC, then included once in a fresh complete native allocation.
  // This is fictional local bookkeeping evidence, not a payment or remittance.
  const assessment=owner(`select jsonb_build_object(
    'snapshotId',id,'eventPlayStartId',event_play_start_id,'rateMinor',rate_cents,
    'eligibleParticipantCount',eligible_participant_count,'totalMinor',total_cents
   )from app.event_sanctioning_fee_snapshots where tournament_id='${tournamentId}'and event_id='${eventId}';`);
  assert.deepEqual({eventPlayStartId:assessment.eventPlayStartId,rateMinor:assessment.rateMinor,
    eligibleParticipantCount:assessment.eligibleParticipantCount,totalMinor:assessment.totalMinor},
   {eventPlayStartId:started.startId,rateMinor:300,eligibleParticipantCount:18,totalMinor:5400});
  const sanctionExpenseOperation=nextOperationId();
  const sanctionExpense=owner(`select public.record_tournament_expense(
    '${tournamentId}',5400,'USD','TEST ONLY synthetic sanction assessment expense','${sanctionExpenseOperation}'
  );`);
  assert.equal(sanctionExpense.status,'expense_recorded',JSON.stringify(sanctionExpense));
  assert.equal(sanctionExpense.amountMinor,5400);
  assert.deepEqual(owner(`select public.record_tournament_expense(
    '${tournamentId}',5400,'USD','TEST ONLY synthetic sanction assessment expense','${sanctionExpenseOperation}'
  );`),sanctionExpense);
  const sanctionLedgerSource=owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`);
  assert.equal(sanctionLedgerSource.status,'sources_available');
  assert.equal(sanctionLedgerSource.facts.receiptEvents.length,18);
  assert.equal(sanctionLedgerSource.facts.expenseEvents.length,2);
  const sanctionAllocations=[
    ...sanctionLedgerSource.facts.receiptEvents.map(row=>({sourceId:row.sourceId,allocations:[{eventId,bucket:'regular_entry',poolId:null,amountMinor:row.amountMinor,classificationReviewed:true}]})),
    ...sanctionLedgerSource.facts.expenseEvents.map(row=>({sourceId:row.sourceId,allocations:[{eventId,bucket:'operating_expense',poolId:null,amountMinor:row.amountMinor,classificationReviewed:true}]})),
  ];
  const sanctionAllocationRequest={kind:'native-ledger-allocation-v1',operationId:nextOperationId(),
   expectedRevisionId:allocationSaved.revisionId,sourceDigest:sanctionLedgerSource.sourceDigest,
   allocations:sanctionAllocations,reason:'Synthetic allocation including Start-time sanction assessment expense',reviewed:true};
  allocationSaved=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(sanctionAllocationRequest)});`);
  assert.equal(allocationSaved.status,'accepted',JSON.stringify(allocationSaved));
  assert.deepEqual(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(sanctionAllocationRequest)});`),
   {...allocationSaved,replayed:true,historicalReceipt:true,fundAvailable:false});
  writeEvidence('sanctioning-expense-allocation.json',{assessment,sanctionExpense,allocationSaved});

  // Exercise the real two-player digital protocol for every fictional game.
  // One batched local transaction avoids 432 Docker process round trips while
  // retaining authenticated actor identity, progression and all DB guards.
  const games = owner(`select jsonb_agg(jsonb_build_object(
    'gameId',g.id,'roundNumber',r.round_number,'importRowNumber',sg.import_row_number,
    'sideAProfileId',pa.profile_id,'sideBProfileId',pb.profile_id,
    'sideASeatNumber',split_part(pa.table_seat,'-',2)::integer,
    'sideBSeatNumber',split_part(pb.table_seat,'-',2)::integer
  )order by r.round_number,sg.import_row_number)
  from app.canonical_games g
  join app.rounds r on r.id=g.round_id
  join app.event_schedule_games sg on sg.canonical_game_id=g.id
  join app.event_participants pa on pa.id=g.side_a_participant_id
  join app.event_participants pb on pb.id=g.side_b_participant_id
  where g.tournament_id='${tournamentId}'and g.event_id='${eventId}';`);
  assert.equal(games.length,108);
  const scoreCommands = [];
  for (const game of games) {
    const winnerSide = game.sideASeatNumber < game.sideBSeatNumber ? 'a' : 'b';
    const margin = 1 + Math.min(game.sideASeatNumber,game.sideBSeatNumber) + 5 * Math.max(game.sideASeatNumber,game.sideBSeatNumber);
    assert.ok(margin >= 1 && margin <= 121);
    const sideASubmissionId = nextOperationId(), sideBSubmissionId = nextOperationId();
    scoreCommands.push(
      {action:'submit',actorId:game.sideAProfileId,gameId:game.gameId,submissionId:sideASubmissionId,slot:1,winnerSide,margin,operationId:nextOperationId(),expectedStatus:'submitted'},
      {action:'submit',actorId:game.sideBProfileId,gameId:game.gameId,submissionId:sideBSubmissionId,slot:2,winnerSide,margin,operationId:nextOperationId(),expectedStatus:'confirmation_pending'},
      {action:'confirm',actorId:game.sideAProfileId,gameId:game.gameId,submissionId:sideASubmissionId,operationId:nextOperationId(),expectedStatus:'confirmation_pending'},
      {action:'confirm',actorId:game.sideBProfileId,gameId:game.gameId,submissionId:sideBSubmissionId,operationId:nextOperationId(),expectedStatus:'verified'},
    );
  }
  assert.equal(scoreCommands.length,432);
  q(`begin;set role authenticated;
    do $supported_scores$declare command jsonb;response jsonb;begin
      for command in select value from jsonb_array_elements(${literal(scoreCommands)})loop
        perform set_config('request.jwt.claim.role','authenticated',true);
        perform set_config('request.jwt.claim.sub',command->>'actorId',true);
        perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',command->>'actorId')::text,true);
        if command->>'action'='submit'then
          response:=public.submit_game_score((command->>'gameId')::uuid,(command->>'submissionId')::uuid,(command->>'slot')::smallint,command->>'winnerSide',(command->>'margin')::integer,(command->>'operationId')::uuid);
        else
          response:=public.confirm_game_score((command->>'gameId')::uuid,(command->>'submissionId')::uuid,(command->>'operationId')::uuid);
        end if;
        if response->>'status'is distinct from command->>'expectedStatus'then
          raise exception 'Synthetic supported score command failed: %',jsonb_build_object('command',command,'response',response);
        end if;
      end loop;
    end $supported_scores$;commit;`,actorId,'ownerAuthenticated');
  assert.deepEqual(owner(`select jsonb_build_object(
    'games',(select count(*)from app.canonical_games where event_id='${eventId}'),
    'verified',(select count(*)from app.canonical_games where event_id='${eventId}'and state='verified'),
    'scorelines',(select count(*)from app.card_scorelines where event_id='${eventId}'),
    'submissions',(select count(*)from app.score_submissions s join app.canonical_games g on g.id=s.canonical_game_id where g.event_id='${eventId}'),
    'confirmations',(select count(*)from app.score_confirmations c join app.canonical_games g on g.id=c.canonical_game_id where g.event_id='${eventId}')
  );`), {games:108,verified:108,scorelines:216,submissions:216,confirmations:216});

  const qualificationPreconditions = owner(`select jsonb_build_object(
    'tournamentStatus',(select status from app.tournaments where id='${tournamentId}'),
    'eventPublicationState',(select state from app.event_publication_states where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'eventFormat',(select format from app.events where id='${eventId}'),
    'scoringMethod',(select scoring_method from app.events where id='${eventId}'),
    'rulesetApproved',(select rv.approved_at is not null and nullif(trim(rv.source_reference),'')is not null from app.events e join app.ruleset_versions rv on rv.id=e.ruleset_version_id where e.id='${eventId}'),
    'activationCount',(select count(*)from app.tournament_setup_activations where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'scheduleCount',(select count(*)from app.event_schedule_publications where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'participantCount',(select count(*)from app.event_participants where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'checkedInParticipantCount',(select count(*)from app.event_participants where tournament_id='${tournamentId}'and event_id='${eventId}'and status='checked_in'),
    'canonicalGameCount',(select count(*)from app.canonical_games where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'verifiedGameCount',(select count(*)from app.canonical_games where tournament_id='${tournamentId}'and event_id='${eventId}'and state='verified'),
    'effectiveScorelineCount',(select count(*)from app.current_effective_scorelines('${tournamentId}','${eventId}')),
    'qualificationCount',(select count(*)from app.qualification_result_versions where tournament_id='${tournamentId}'and event_id='${eventId}'),
    'openDisputeCount',(select count(*)from app.event_disputes d where d.tournament_id='${tournamentId}'and d.event_id='${eventId}'and app.event_dispute_is_open(d.id))
  );`);
  assert.deepEqual(qualificationPreconditions, {
    tournamentStatus:'open',eventPublicationState:'draft',eventFormat:'standard_singles',scoringMethod:'digital',rulesetApproved:true,
    activationCount:1,scheduleCount:1,participantCount:18,checkedInParticipantCount:18,canonicalGameCount:108,verifiedGameCount:108,
    effectiveScorelineCount:216,qualificationCount:0,openDisputeCount:0,
  });
  const qualificationOperation = nextOperationId();
  const qualification = service(`select public.finalize_standard_singles_qualification_v1('${actorId}','${tournamentId}','${eventId}','${qualificationOperation}');`);
  writeEvidence('qualification-finalization-attempt.json', {qualification,qualificationPreconditions});
  assert.equal(qualification.status, 'qualification_finalized', JSON.stringify({qualification,qualificationPreconditions},null,2));
  assert.deepEqual({participantCount:qualification.participantCount,qualifierCount:qualification.qualifierCount,version:qualification.version},{participantCount:18,qualifierCount:5,version:1});
  assert.deepEqual(service(`select public.finalize_standard_singles_qualification_v1('${actorId}','${tournamentId}','${eventId}','${qualificationOperation}');`), qualification);
  assert.equal(owner(`select to_jsonb(app.qualification_resolution_snapshot_current_v1('${qualification.resultVersionId}'));`), true);
  const qualificationView = service(`select public.get_standard_singles_qualification_result_v1('${actorId}','${tournamentId}','${eventId}');`);
  assert.equal(qualificationView.resultVersionId, qualification.resultVersionId);
  assert.equal(qualificationView.qualifiers.length, 5);
  assert.equal(qualificationView.participantCount, 18);
  assert.equal(qualificationView.playoffResultsAvailable, false);
  const qRows = owner(`select jsonb_agg(jsonb_build_object('participantId',participant_id,'rank',ranking_ordinal,'displayName',display_name_snapshot)order by ranking_ordinal)from app.qualification_result_rows where result_version_id='${qualification.resultVersionId}'and ranking_ordinal<=5;`);
  assert.equal(qRows.length, 5);
  assert.notEqual(qRows[2].participantId, qRows[3].participantId);

  const source = owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);
  assert.equal(source.status, 'source_available');
  assert.deepEqual(source.raw.qualification, {resultVersionId:qualification.resultVersionId,version:1,participantCount:18,qualifierCount:5});
  assert.equal(source.basis.workspace.grossEntryMinor, 54000);
  assert.equal(source.basis.workspace.entryCount, 18);
  assert.equal(source.basis.workspace.paidEntryCount, 18);
  assert.equal(source.basis.workspace.qualifierCount, 5);
  assert.equal(source.proposalOnly, true); assert.equal(source.moneyMoved, false); assert.equal(source.payoutAuthorized, false);

  const workspace = source.basis.workspace;
  let editor = createEventFinanceEditorV1(workspace);
  assert.ok(editor);
  const editorIds = [id('4294',1)];
  const makeEditorId = () => {
    const next = editorIds.shift();
    assert.ok(next, 'Unexpected Finance editor identity request');
    return next;
  };
  editor = reduceEventFinanceEditorV1(editor,{type:'edit_band',firstPlace:3,lastPlace:4},workspace,makeEditorId);
  editor = reduceEventFinanceEditorV1(editor,{type:'band_field',field:'amount',value:'5.00'},workspace,makeEditorId);
  editor = reduceEventFinanceEditorV1(editor,{type:'band_field',field:'reason',value:'Synthetic equal 3-4 cohort estimate'},workspace,makeEditorId);
  editor = reduceEventFinanceEditorV1(editor,{type:'apply_band'},workspace,makeEditorId);
  assert.equal(editorIds.length, 0);
  const overrideHistory = [{recordId:id('4294',1),firstPlace:3,lastPlace:4,priorRecordId:null,perPersonMinor:500,voided:false,reason:'Synthetic equal 3-4 cohort estimate'}];
  assert.deepEqual(editor.overrideHistory,overrideHistory);
  assert.equal(editor.bandForm,null);
  assert.match(editor.message,/No payout was made/);
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(editor)},${literal(source.basis)},null));`), true);
  const request = {kind:'operational-event-finance-proposal-v1',operationId:nextOperationId(),expectedVersion:0,expectedSourceDigest:source.sourceDigest,expectedBasisDigest:source.basisDigest,editor,reason:'Synthetic current-qualified equal-band estimate only'};
  writeEvidence('current-qualified-proposal-request.json',{sourceDigest:source.sourceDigest,basisDigest:source.basisDigest,editor,request});
  assert.equal(owner(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(request)});`).code, 'feature_unavailable');
  assert.equal(owner(`select to_jsonb(count(*))from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`), 0);

  const originalGate = owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`);
  assert.match(originalGate, /select false/);
  let accepted;
  try {
    q(`create or replace function app.operational_event_finance_proposals_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_operational_finance_proposals',true)='approved-local-only',false)$$;alter function app.operational_event_finance_proposals_enabled_v1()owner to postgres;revoke all on function app.operational_event_finance_proposals_enabled_v1()from public,anon,authenticated,service_role;`);
    accepted = enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(request)});`);
    assert.equal(accepted.status, 'accepted'); assert.equal(accepted.version, 1);
    assert.equal(accepted.moneyMoved, false); assert.equal(accepted.finalizationAuthorized, false); assert.equal(accepted.payoutAuthorized, false);
    assert.deepEqual(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(request)});`), {...accepted,historicalReceipt:true,currentSourceVerified:false});
    const stored = owner(`select jsonb_build_object('qualificationResultVersionId',qualification_result_version_id,'sourceDigest',source_digest,'basisDigest',basis_digest,'editor',editor,'proposalOnly',proposal_only,'moneyMoved',money_moved,'payoutAuthorized',payout_authorized)from app.operational_event_finance_revisions_v1 where id='${accepted.revisionId}';`);
    assert.equal(stored.qualificationResultVersionId, qualification.resultVersionId);
    assert.equal(stored.sourceDigest, source.sourceDigest); assert.equal(stored.basisDigest, source.basisDigest);
    assert.deepEqual(stored.editor.overrideHistory, overrideHistory);
    assert.equal(stored.proposalOnly, true); assert.equal(stored.moneyMoved, false); assert.equal(stored.payoutAuthorized, false);
  } finally {
    q(originalGate);
    assert.equal(owner(`select to_jsonb(app.operational_event_finance_proposals_enabled_v1());`), false);
    assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`), originalGate);
  }

  const splitTie = structuredClone(editor); splitTie.overrideHistory[0].lastPlace = 3;
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(splitTie)},${literal(source.basis)},null));`), false);
  const beyondQualifiers = structuredClone(editor); beyondQualifiers.overrideHistory[0].firstPlace = 5; beyondQualifiers.overrideHistory[0].lastPlace = 8;
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(beyondQualifiers)},${literal(source.basis)},null));`), false);
  const ratioBasis = structuredClone(source.basis);
  ratioBasis.workspace.settings = {method:'custom_paid_ratio',ratio:6,factor:'1.5'};
  const ratioEditor = structuredClone(editor);
  ratioEditor.basis = ratioBasis.workspace;
  ratioEditor.overrideInput.settings = ratioBasis.workspace.settings;
  ratioEditor.overridePlan = JSON.stringify({basis:ratioBasis.workspace,history:ratioEditor.history});
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(ratioEditor)},${literal(ratioBasis)},null));`), false);

  return {
    configuredGameCount: binding.gameCount,
    participants: 18,
    publishedMatches: 108,
    supportedDigitalSubmissions: 216,
    supportedDigitalConfirmations: 216,
    supportedDigitalScorelines: 216,
    qualificationCurrent: true,
    qualificationResultVersionId: qualification.resultVersionId,
    qualificationVersion: 1,
    qualifierCount: 5,
    qualifierRows: qRows,
    sourceDigest: source.sourceDigest,
    basisDigest: source.basisDigest,
    allocationRevisionId: allocationSaved.revisionId,
    sanctioning: {snapshotId:assessment.snapshotId,expenseEventId:sanctionExpense.expenseEventId,
      allocatedExpenseMinor:5400,totalMinor:assessment.totalMinor},
    proposalRevisionId: accepted.revisionId,
    proposalVersion: accepted.version,
    storedEqualBand: {firstPlace:3,lastPlace:4,perPersonMinor:500},
    splitEqualBandBlocked: true,
    beyondQualifierBlocked: true,
    customRatioOverrideBlocked: true,
    playoffResultAvailable: false,
    recipientProviderProved: false,
    proposalOnly: true,
    moneyMoved: false,
    payoutAuthorized: false,
    hostedWrites: false,
  };
}
