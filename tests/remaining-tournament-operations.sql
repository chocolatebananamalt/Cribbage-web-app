-- Rollback-only hosted boundary fixture for migrations 0169-0172. It proves
-- every new operation is installed, service-only, fail-closed for an
-- unauthorized actor, and that Satellite validation enforces the key result
-- invariants without retaining synthetic data.

begin;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  actor uuid := 'a1690000-0000-4000-8000-000000000001';
  tournament uuid := 'b1690000-0000-4000-8000-000000000001';
  event_id uuid := 'c1690000-0000-4000-8000-000000000001';
  result jsonb;
  operation_kind text;
begin
  foreach operation_kind in array array[
    'omitted_player_before_play','late_player_before_game_two',
    'odd_field_first_sitout_makeup','early_departure_substitute',
    'odd_field_extra_games','mixed_rotation_repair','reinstatement_future_games'
  ] loop
    result := public.preview_event_schedule_amendment_v1(actor,tournament,event_id,operation_kind,'ACC fixture','Fixture reason','[]'::jsonb,0);
    if result->>'code' <> 'not_director' then raise exception 'schedule case did not fail closed: % %',operation_kind,result; end if;
  end loop;

  result := public.configure_event_side_pool_policy_v1(actor,tournament,event_id,
    'd1690000-0000-4000-8000-000000000001',5,
    '[{"placement":1,"amountMinor":1000}]'::jsonb,'Fixture reason',
    'e1690000-0000-4000-8000-000000000001');
  if result->>'code' <> 'not_director' then raise exception 'Side Pool policy did not fail closed: %',result; end if;

end $$;

reset role;
do $$
begin
  if app.validate_satellite_result_document_v1(
    '[{"placement":1,"entrantId":"sample","displayName":"Sample Player","prizeMinor":1000,"qPoolMinor":0,"sidePoolMinor":0,"crossCheckEvidence":[{"type":"scorecard","ref":"receipt"}]}]'::jsonb,
    '[]'::jsonb,true) <> 'valid' then raise exception 'valid Satellite document rejected'; end if;
  if app.validate_satellite_result_document_v1(
    '[{"placement":1,"entrantId":"sample","displayName":"Sample Player","prizeMinor":1000,"qPoolMinor":0,"sidePoolMinor":0,"crossCheckEvidence":[]}]'::jsonb,
    '[]'::jsonb,true) <> 'invalid_placement' then raise exception 'Satellite evidence requirement failed'; end if;
  if app.validate_satellite_result_document_v1(
    '[{"placement":1,"entrantId":"sample","displayName":"A","prizeMinor":0,"qPoolMinor":0,"sidePoolMinor":0,"crossCheckEvidence":[{"type":"card","ref":"1"}]},{"placement":1,"entrantId":"other","displayName":"B","prizeMinor":0,"qPoolMinor":0,"sidePoolMinor":0,"crossCheckEvidence":[{"type":"card","ref":"2"}]}]'::jsonb,
    '[]'::jsonb,true) <> 'duplicate_placement' then raise exception 'Satellite placement uniqueness failed'; end if;
  if has_function_privilege('authenticated','public.confirm_event_schedule_amendment_v1(uuid,uuid,uuid,uuid,text,text,text,jsonb,integer,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.set_event_side_pool_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.save_satellite_results_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,integer,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.confirm_event_schedule_amendment_v1(uuid,uuid,uuid,uuid,text,text,text,jsonb,integer,uuid)','EXECUTE') then
    raise exception 'remaining operations grants are invalid';
  end if;
end $$;

set constraints all immediate;
rollback;
