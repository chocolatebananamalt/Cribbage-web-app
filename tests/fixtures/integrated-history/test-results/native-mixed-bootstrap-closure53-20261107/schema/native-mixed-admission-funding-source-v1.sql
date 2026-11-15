-- LOCAL UNEXECUTED integration of TWO default-off candidates only.
-- Install after native-mixed-admission-v1 and native-mixed-funding-v1.
-- No legacy financial function/table is replaced, written or adopted.
-- This removes the candidate admission helper's legacy prize-declaration
-- prerequisite. It does not solve paid attendance, Start, optional pools,
-- native V2 ownership, mixed playoff recipients or final awards.
begin;
create or replace function app.native_mixed_admission_finance_seal_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set TimeZone='UTC'as $$
declare funding jsonb;intent app.native_mixed_admission_intents_v1%rowtype;
 fixture app.synthetic_mixed_fixtures_v1%rowtype;capture jsonb;digest text;
begin
 if app.native_mixed_admission_enabled_v1()is distinct from true
  or app.native_mixed_funding_enabled_v1()is distinct from true
 then return jsonb_build_object('status','blocked','code','synthetic_finance_scope_changed');end if;
 -- The funding producer rechecks intent/native settings/identity pins and
 -- the complete operation/context/outcome/provenance chain under its locks.
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'
  or funding->>'kind'is distinct from'native-mixed-funding-source-v1'
  or coalesce(funding->>'sourceDigest','')!~'^[a-f0-9]{64}$'
  or funding->'optionalPoolSourceAvailable'is distinct from'false'::jsonb
  or funding->'assessmentSourceAvailable'is distinct from'false'::jsonb
  or funding->'paidCheckInAuthorized'is distinct from'false'::jsonb
  or funding->'ordinaryCheckInSource'is distinct from'false'::jsonb
  or funding->'actualMoneyReceived'is distinct from'false'::jsonb
  or funding->'bankReceiptVerified'is distinct from'false'::jsonb
  or funding->'moneyMoved'is distinct from'false'::jsonb
  or funding->'refundAuthorized'is distinct from'false'::jsonb
  or funding->'payoutAuthorized'is distinct from'false'::jsonb
  or funding->'finalizationAuthorized'is distinct from'false'::jsonb
 then return jsonb_build_object('status','blocked','code','synthetic_finance_scope_changed');end if;
 select*into intent from app.native_mixed_admission_intents_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 if intent.id is null
  or funding#>>'{scope,admissionIntentId}'is distinct from intent.id::text
  or funding#>>'{scope,admissionIntentVersion}'is distinct from intent.version::text
  or funding#>>'{scope,admissionSourceDigest}'is distinct from intent.source_digest
  or funding#>>'{scope,operationalBindingId}'is distinct from intent.operational_binding_id::text
  or app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true
 then return jsonb_build_object('status','blocked','code','synthetic_finance_scope_changed');end if;
 lock table app.synthetic_mixed_fixtures_v1,app.synthetic_mixed_games_v1,
  app.synthetic_mixed_enrollment_kinds_v2 in share mode nowait;
 -- Preserve the old candidate's current mixed scoring enrollment check;
 -- never replace it with fake ordinary player confirmations or profile IDs.
 begin perform app.assert_synthetic_mixed_current_v1(tid,eid);
 exception when raise_exception then
  return jsonb_build_object('status','blocked','code','synthetic_finance_scope_changed');end;
 select*into fixture from app.synthetic_mixed_fixtures_v1 where tournament_id=tid and event_id=eid;
 if fixture.event_id is null
  or not exists(select 1 from app.synthetic_mixed_enrollment_kinds_v2 k
   where k.tournament_id=tid and k.event_id=eid and k.protocol_kind='synthetic-mixed-18-v2'
    and k.participant_count=18 and k.digital_count=6 and k.paper_count=12 and k.match_count=108
    and k.source_sha256=fixture.source_sha256)
  or fixture.source_sha256 is distinct from encode(extensions.digest(fixture.source_snapshot::text,'sha256'),'hex')
  or(select count(*)from app.synthetic_mixed_games_v1 where tournament_id=tid and event_id=eid)<>108
  or exists(select 1 from app.canonical_games g where g.tournament_id=tid and g.event_id=eid
   and not exists(select 1 from app.synthetic_mixed_games_v1 m
    where m.tournament_id=tid and m.event_id=eid and m.game_id=g.id
     and m.side_a_participant_id=g.side_a_participant_id and m.side_b_participant_id=g.side_b_participant_id
     and m.base_game_version=g.version))
 then return jsonb_build_object('status','blocked','code','synthetic_finance_binding_required');end if;
 capture:=jsonb_build_object('kind','native-mixed-admission-funding-source-v1',
  'funding',funding,'scoringFixture',to_jsonb(fixture),
  'syntheticAllFlags',false,'sourceAvailableV2',false,'paidCheckInAuthorized',false,
  'ordinaryCheckInSource',false,'actualMoneyReceived',false,'bankReceiptVerified',false,
  'moneyMoved',false,'refundAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-mixed-admission-funding-source-v1',tid,eid,capture)::text,'utf8'),'sha256'),'hex');
 return capture||jsonb_build_object('status','source_available','sourceDigest',digest);
end$$;
alter function app.native_mixed_admission_finance_seal_source_v1(uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_admission_finance_seal_source_v1(uuid,uuid)
 from public,anon,authenticated,service_role;
commit;
