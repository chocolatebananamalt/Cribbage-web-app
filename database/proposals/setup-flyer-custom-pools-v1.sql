-- SOURCE ONLY: minimal read-only saved configuration, no payout authority/grants.
begin;
create function app.setup_flyer_custom_pools_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create function public.get_setup_flyer_custom_pools_v1(p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid:=auth.uid();w jsonb;rid uuid;payouts jsonb;sides jsonb;
begin
 if app.setup_flyer_custom_pools_enabled_v1()is distinct from true or actor is null then return null;end if;
 -- Existing source validates current Director/Co-director, current revision,
 -- immutable intent provenance and reciprocal Side numeric-field bindings.
 w:=app.get_custom_pool_setup_workspace_v3(p_tournament_id);
 if w->>'status'is distinct from'available'or w#>>'{base,tournamentId}'is distinct from p_tournament_id::text then return null;end if;
 rid:=(w#>>'{base,setupRevisionId}')::uuid;if rid is null then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('eventClientRowId',e.client_row_id,'scope',i.scope,'poolSlot',i.pool_slot,'ratioDenominator',i.ratio_denominator)order by e.ordinal,i.scope,i.pool_slot),'[]')into payouts
 from app.setup_custom_payout_intents_v2 i join app.tournament_setup_event_versions e on e.id=i.setup_event_version_id and e.tournament_id=i.tournament_id and e.setup_revision_id=i.setup_revision_id
 where i.tournament_id=p_tournament_id and i.setup_revision_id=rid;
 select coalesce(jsonb_agg(jsonb_build_object('eventClientRowId',s->'eventClientRowId','poolSlot',s->'slot','payoutType',s->'payoutType','customRatio',s->'customRatio')),'[]')into sides from jsonb_array_elements(w->'sidePayouts')s;
 return jsonb_build_object('kind','setup-flyer-custom-pools-v1','actorId',actor,'tournamentId',p_tournament_id,'setupRevisionId',rid,'setupVersion',w#>'{base,setupVersion}','sourceDigest',w#>'{base,sourceDigest}','payouts',payouts,'sideMethods',sides,'savedIntentOnly',true,'calculationAuthorized',false,'moneyMoved',false);
exception when lock_not_available then return null;end$$;
alter function app.setup_flyer_custom_pools_enabled_v1()owner to postgres;
alter function public.get_setup_flyer_custom_pools_v1(uuid)owner to postgres;
revoke all on function app.setup_flyer_custom_pools_enabled_v1(),public.get_setup_flyer_custom_pools_v1(uuid)from public,anon,authenticated,service_role;
commit;
