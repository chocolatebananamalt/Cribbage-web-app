-- Private, disabled, read-only preparation. Not a completeness review or award.
begin;
create function app.native_recorded_fund_review_source_enabled_v1()
returns boolean language sql stable set search_path='' as $$select false$$;

create function app.get_native_recorded_fund_review_source_v1(tid uuid,eid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();recipient jsonb;proposal app.operational_event_finance_revisions_v1%rowtype;
 record_row app.native_unrestricted_income_records_v1%rowtype;
 snapshot app.event_sanctioning_fee_snapshots%rowtype;latest_review app.native_recorded_fund_reviews_v1%rowtype;
 income_lines jsonb:='[]';income_records jsonb:='[]';income_latest jsonb:='{}';
 line_item jsonb;income_item jsonb;source_row jsonb;part jsonb;coverage jsonb;
 candidates jsonb:='[]';capture jsonb;income_digest text;head_version integer:=0;
 review_version integer:=0;active_income numeric:=0;regular_total numeric:=0;
 benefit_total numeric:=0;operating_total numeric:=0;fund_total numeric;allocated numeric;i integer;
begin
 if actor is null or tid is null or eid is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then
  return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then
  return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director')order by role for key share nowait;if not found then return null;end if;
 if app.native_recorded_fund_review_source_enabled_v1()is distinct from true then
  return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 -- The existing reader owns the complete native playoff and Finance source locks.
 recipient:=app.get_native_playoff_finance_recipient_source_v1(tid,eid);
 if recipient->>'status'='retry_exact'then return recipient;end if;
 if recipient->>'status'is distinct from'source_available'then
  return jsonb_build_object('status','blocked','code',coalesce(recipient->>'code','recipient_source_unavailable'));end if;
 lock table app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,
  app.native_recorded_fund_reviews_v1,app.native_playoff_final_award_sets_v1,
  app.event_sanctioning_fee_snapshots,app.event_settlement_finals_v2,app.event_settlement_drafts_v5,
  app.roster_payment_events,app.tournament_expense_events in share mode nowait;
 if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then
  return jsonb_build_object('status','blocked','code','final_awards_already_recorded');end if;
 select*into proposal from app.operational_event_finance_revisions_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 if proposal.id is null or proposal.id::text is distinct from recipient#>>'{proposal,revisionId}'then
  return jsonb_build_object('status','blocked','code','proposal_changed');end if;
 for i in jsonb_array_length(proposal.editor#>'{basis,history}')..jsonb_array_length(proposal.editor->'history')-1 loop
  line_item:=proposal.editor->'history'->i;
  if line_item#>>'{line,category}'is distinct from'unrestricted_income'then
   return jsonb_build_object('status','blocked','code','unrecorded_finance_edit');end if;
  income_lines:=income_lines||jsonb_build_array(line_item);
 end loop;
 select coalesce(max(version),0)into head_version from app.native_unrestricted_income_records_v1
  where tournament_id=tid and event_id=eid;
 if head_version<>jsonb_array_length(income_lines)then
  return jsonb_build_object('status','blocked','code','income_history_incomplete');end if;
 for record_row in select*from app.native_unrestricted_income_records_v1
  where tournament_id=tid and event_id=eid order by version loop
  line_item:=income_lines->(record_row.version-1);
  if line_item#>>'{line,lineId}'is distinct from record_row.income_id::text
   or line_item#>>'{line,recordId}'is distinct from record_row.record_id::text
   or line_item#>'{line,priorRecordId}'is distinct from coalesce(to_jsonb(record_row.prior_record_id),'null'::jsonb)
   or(line_item#>>'{line,amountMinor}')::numeric is distinct from record_row.amount_minor::numeric
   or(line_item#>>'{line,voided}')::boolean is distinct from record_row.voided
   or line_item->>'label'is distinct from record_row.label
   or line_item#>>'{line,reason}'is distinct from record_row.reason then
   return jsonb_build_object('status','blocked','code','income_history_changed');end if;
  income_records:=income_records||jsonb_build_array(jsonb_build_object(
   'incomeId',record_row.income_id,'recordId',record_row.record_id,'priorRecordId',record_row.prior_record_id,
   'physicalEvidenceId',record_row.physical_evidence_id,'amountMinor',record_row.amount_minor,
   'voided',record_row.voided,'label',record_row.label,'evidenceReference',record_row.evidence_reference,
   'reason',record_row.reason,'recordedBy',record_row.recorded_by,'recordedAt',record_row.recorded_at));
  income_latest:=jsonb_set(income_latest,array[record_row.income_id::text],
   jsonb_build_object('voided',record_row.voided,'amountMinor',record_row.amount_minor),true);
 end loop;
 if jsonb_array_length(income_records)<>head_version then
  return jsonb_build_object('status','blocked','code','income_history_incomplete');end if;
 for income_item in select value from jsonb_each(income_latest)loop
  if not(income_item->>'voided')::boolean then active_income:=active_income+(income_item->>'amountMinor')::numeric;end if;
 end loop;
 if exists(select 1 from app.native_unrestricted_income_records_v1 ir
   join app.roster_payment_events p on p.tournament_id=ir.tournament_id and p.id=ir.physical_evidence_id
   where ir.tournament_id=tid)
  or exists(select 1 from app.native_unrestricted_income_records_v1 ir
   join app.tournament_expense_events x on x.tournament_id=ir.tournament_id and x.id=ir.physical_evidence_id
   where ir.tournament_id=tid)then
  return jsonb_build_object('status','blocked','code','physical_evidence_conflict');end if;
 income_digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-unrestricted-income-head-v1',tid,eid,income_records)::text,'utf8'),'sha256'),'hex');
 select*into snapshot from app.event_sanctioning_fee_snapshots where tournament_id=tid and event_id=eid;
 if snapshot.id is null then return jsonb_build_object('status','blocked','code','sanctioning_snapshot_missing');end if;
 if snapshot.total_cents=0 then
  coverage:=app.native_sanctioning_coverage_v1(tid,eid,recipient,null);
  if coverage->>'status'is distinct from'available'then
   return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
 end if;
 for source_row in select value from jsonb_array_elements(recipient#>'{nativeFinanceSource,raw,allocation,eventSources}')order by value->>'sourceId'loop
  if source_row->>'state'is distinct from'active'or source_row->>'physicalEvidenceId'is distinct from source_row->>'sourceId'then
   return jsonb_build_object('status','blocked','code','native_finance_source_changed');end if;
  allocated:=0;
  for part in select value from jsonb_array_elements(source_row->'allocations')loop
   if part->>'classificationReviewed'is distinct from'true'or part->'poolId'is distinct from'null'::jsonb
    or part->>'eventId'is distinct from eid::text then
    return jsonb_build_object('status','blocked','code','native_finance_source_changed');end if;
   if part->>'bucket'='regular_entry'and source_row->>'kind'='entry_receipt'then regular_total:=regular_total+(part->>'amountMinor')::numeric;
   elsif part->>'bucket'='player_benefit'and source_row->>'kind'='expense'then benefit_total:=benefit_total+(part->>'amountMinor')::numeric;allocated:=allocated+(part->>'amountMinor')::numeric;
   elsif part->>'bucket'='operating_expense'and source_row->>'kind'='expense'then operating_total:=operating_total+(part->>'amountMinor')::numeric;allocated:=allocated+(part->>'amountMinor')::numeric;
   else return jsonb_build_object('status','blocked','code','optional_pool_or_income_source_unsupported');end if;
  end loop;
  if source_row->>'kind'='expense'and snapshot.total_cents>0 then
   coverage:=app.native_sanctioning_coverage_v1(tid,eid,recipient,(source_row->>'sourceId')::uuid);
   if coverage->>'status'='retry_exact'then return coverage;end if;
   if coverage->>'status'='available'then candidates:=candidates||jsonb_build_array(coverage-'status');end if;
  end if;
 end loop;
 if snapshot.total_cents>0 and jsonb_array_length(candidates)=0 then
  return jsonb_build_object('status','blocked','code','sanctioning_coverage_unverified');end if;
 fund_total:=regular_total-benefit_total-operating_total+active_income;
 if least(regular_total,benefit_total,operating_total,active_income,fund_total)<0
  or greatest(regular_total,benefit_total,operating_total,active_income,fund_total)>9007199254740991 then
  return jsonb_build_object('status','blocked','code','fund_out_of_range');end if;
 select*into latest_review from app.native_recorded_fund_reviews_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 review_version:=coalesce(latest_review.version,0);
 if review_version>=2147483647 then return jsonb_build_object('status','blocked','code','review_version_exhausted');end if;
 capture:=jsonb_build_object('kind','native-recorded-fund-review-source-v1','status','review_source_available',
  'actorId',actor,'tournamentId',tid,'eventId',eid,'recipientSource',recipient,
  'proposalRevisionId',proposal.id,'nativeAllocationRevisionId',recipient#>'{nativeFinanceSource,raw,allocation,revisionId}',
  'expectedReviewVersion',review_version,'latestReview',case when latest_review.id is null then'null'::jsonb else jsonb_build_object(
   'reviewId',latest_review.id,'version',latest_review.version,'proposalRevisionId',latest_review.proposal_revision_id,
   'nativeAllocationRevisionId',latest_review.native_allocation_revision_id,'incomeHeadVersion',latest_review.income_head_version,
   'incomeHeadDigest',latest_review.income_head_digest,'reviewStatus',latest_review.review_status,
   'sanctioningExpenseEventId',latest_review.sanctioning_expense_event_id,
   'recipientSourceDigest',latest_review.source_capture->'recipientSourceDigest','sanctioningSnapshotId',latest_review.sanctioning_fee_snapshot_id,
   'sanctioningAllocatedMinor',latest_review.sanctioning_allocated_minor,'sourceDigest',latest_review.source_digest)end,
  'income',jsonb_build_object('headVersion',head_version,'headDigest',income_digest,
   'records',income_records,'activeMinor',active_income::bigint,'suggestedStatus',case when active_income=0 then'reviewed_zero'else'recorded_complete'end),
  'sanctioning',jsonb_build_object('snapshotId',snapshot.id,'eventPlayStartId',snapshot.event_play_start_id,
   'rateMinor',snapshot.rate_cents,'eligibleParticipantCount',snapshot.eligible_participant_count,'totalMinor',snapshot.total_cents,
   'candidates',candidates),
  'totals',jsonb_build_object('regularEntryMinor',regular_total::bigint,'benefitExpenseMinor',benefit_total::bigint,
   'operatingExpenseMinor',operating_total::bigint,'unrestrictedIncomeMinor',active_income::bigint,'recordedFundMinor',fund_total::bigint),
  'proposalOnly',true,'recordedFundComplete',false,'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 return capture||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(
  jsonb_build_array('native-recorded-fund-review-source-v1',capture)::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('status','blocked','code','source_malformed');
end$$;
create function public.get_native_recorded_fund_review_source_provider_v1(tid uuid,eid uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
begin
 if app.operational_provider_transport_enabled_v1()is distinct from true
  or app.native_recorded_fund_review_source_enabled_v1()is distinct from true then return null;end if;
 if app.require_operational_provider_official_v1(tid)is null then return null;end if;
 return app.get_native_recorded_fund_review_source_v1(tid,eid);
end$$;
alter function app.native_recorded_fund_review_source_enabled_v1()owner to postgres;
alter function app.get_native_recorded_fund_review_source_v1(uuid,uuid)owner to postgres;
alter function public.get_native_recorded_fund_review_source_provider_v1(uuid,uuid)owner to postgres;
revoke all on function app.native_recorded_fund_review_source_enabled_v1()from public,anon,authenticated,service_role;
revoke all on function app.get_native_recorded_fund_review_source_v1(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_native_recorded_fund_review_source_provider_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_native_recorded_fund_review_source_provider_v1(uuid,uuid)to authenticated;
commit;
