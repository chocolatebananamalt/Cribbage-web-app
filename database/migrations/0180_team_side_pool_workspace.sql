-- Include team entries in the operational Side Pool workspace and totals.

alter function public.get_event_side_pool_workspace_v1(uuid,uuid) rename to get_event_side_pool_workspace_base_v1;
create or replace function public.get_event_side_pool_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; events_json jsonb:='[]'::jsonb; event_json jsonb; pools_json jsonb; pool_json jsonb; event_id_value uuid;
begin
  base:=public.get_event_side_pool_workspace_base_v1(p_actor_id,p_tournament_id);
  if base is null then return null; end if;
  for event_json in select value from jsonb_array_elements(coalesce(base->'events','[]'::jsonb)) loop
    event_id_value:=(event_json->>'eventId')::uuid;
    pools_json:='[]'::jsonb;
    for pool_json in select value from jsonb_array_elements(coalesce(event_json->'pools','[]'::jsonb)) loop
      pool_json:=jsonb_set(jsonb_set(
        pool_json,'{collectedMinor}',to_jsonb(
          coalesce((pool_json->>'collectedMinor')::integer,0)+coalesce((select sum(latest.amount_received_minor) from (select distinct on(version.team_entry_id) version.* from app.event_side_pool_team_election_versions version where version.pool_id=(pool_json->>'poolId')::uuid order by version.team_entry_id,version.version desc) latest where latest.elected),0)
        ),true),'{paidMinor}',to_jsonb(
          coalesce((pool_json->>'paidMinor')::integer,0)+coalesce((select sum(latest.amount_minor) from (select distinct on(version.payout_id) version.* from app.event_side_pool_team_payout_versions version where version.pool_id=(pool_json->>'poolId')::uuid order by version.payout_id,version.version desc) latest where not latest.voided),0)
        ),true);
      pools_json:=pools_json||jsonb_build_array(pool_json);
    end loop;
    event_json:=jsonb_set(jsonb_set(event_json,'{pools}',pools_json,true),'{teamBeneficiaries}',coalesce((
      select jsonb_agg(jsonb_build_object(
        'teamEntryId',entry.id,'displayName',team.display_name,
        'elections',coalesce((select jsonb_agg(jsonb_build_object('poolId',latest.pool_id,'electionId',latest.election_id,'version',latest.version,'elected',latest.elected,'amountDueMinor',latest.amount_due_minor,'amountReceivedMinor',latest.amount_received_minor,'amountRemainingMinor',latest.amount_due_minor-latest.amount_received_minor,'paymentMethod',latest.payment_method,'paymentReference',latest.payment_reference) order by latest.pool_id) from (select distinct on(version.pool_id) version.* from app.event_side_pool_team_election_versions version where version.team_entry_id=entry.id order by version.pool_id,version.version desc) latest),'[]'::jsonb),
        'payouts',coalesce((select jsonb_agg(jsonb_build_object('poolId',latest.pool_id,'payoutId',latest.payout_id,'version',latest.version,'placement',latest.placement,'amountMinor',latest.amount_minor,'voided',latest.voided) order by latest.placement) from (select distinct on(version.payout_id) version.* from app.event_side_pool_team_payout_versions version where version.team_entry_id=entry.id order by version.payout_id,version.version desc) latest),'[]'::jsonb)
      ) order by team.display_name) from app.event_team_entries entry join app.event_teams team on team.id=entry.team_id where entry.event_id=event_id_value and entry.tournament_id=p_tournament_id
    ),'[]'::jsonb),true);
    events_json:=events_json||jsonb_build_array(event_json);
  end loop;
  return jsonb_set(base,'{events}',events_json,true);
end $$;
revoke all on function public.get_event_side_pool_workspace_base_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_event_side_pool_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_side_pool_workspace_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
