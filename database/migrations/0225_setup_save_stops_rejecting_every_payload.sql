-- Setup could not be saved at all. Every "Save All Events Draft" press returned
-- status rejected, code invalid_setup_payload, no matter what the director typed.
--
-- 0211 wrapped the setup writer to add a required State/Territory. That wrapper
-- added TWO new keys to its accepted payload, 'stateTerritory' and
-- 'tournamentDirectorPublicName', but it strips only ONE of them before handing
-- the payload to the original writer, which it renamed to
-- save_tournament_setup_version_before_state_territory.
--
-- The original writer rejects any key it does not know, and it has never known
-- 'tournamentDirectorPublicName'. So the two validators disagree and no payload
-- can satisfy both:
--
--   key absent  -> the wrapper's ?& presence check fails  -> invalid_setup_payload
--   key present -> the inner writer sees an unknown key   -> invalid_setup_payload
--
-- Measured against production on 2026-09-19 with a throwaway tournament id.
-- Both variants returned {"status":"rejected","code":"invalid_setup_payload"}.
-- The last setup revision that saved is dated 2026-09-16, before 0211 landed.
--
-- The key does not belong in the legacy revision. The public director name is
-- persisted separately by configure_tournament_public_contact_from_setup_v1,
-- exactly as the State/Territory is persisted by the set_config side channel
-- below. So the fix is the one 0211 should have made: strip both adapter keys,
-- not one. No reader changes, no stored revision changes, nothing else moves.
create or replace function public.save_tournament_setup_version(
  p_tournament_id uuid,p_expected_version integer,p_payload jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state text; v_result jsonb;
begin
  if coalesce(jsonb_typeof(p_payload),'')<>'object'
    or jsonb_typeof(p_payload->'stateTerritory')<>'string'
    or not(p_payload ?& array['tournamentName','city','venue','stateTerritory','startsAt','endsAt','timezone','tournamentDirectorPublicName','tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress','mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference','officials','events'])
    or exists(select 1 from jsonb_object_keys(p_payload) key where key<>all(array['tournamentName','city','venue','stateTerritory','startsAt','endsAt','timezone','tournamentDirectorPublicName','tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress','mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference','officials','events'])) then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  v_state:=trim(p_payload->>'stateTerritory');
  if v_state<>all(array[
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
    'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri',
    'Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    'District of Columbia','Puerto Rico','U.S. Virgin Islands','American Samoa','Guam','Northern Mariana Islands'
  ]) then return jsonb_build_object('status','rejected','code','invalid_setup_payload'); end if;
  perform set_config('app.setup_state_territory',v_state,true);
  v_result:=public.save_tournament_setup_version_before_state_territory(
    p_tournament_id,p_expected_version,
    p_payload-'stateTerritory'-'tournamentDirectorPublicName',
    p_idempotency_key);
  return v_result;
end $$;
revoke all on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) to authenticated;
