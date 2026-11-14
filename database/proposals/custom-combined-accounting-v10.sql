-- LOCAL CANDIDATE. Depends on 0292, Custom pool draft V3, Custom Q V5 and
-- Custom Side V4 candidates. No new tables, public grants or disbursement.
-- Legacy-only sources/replays remain unchanged. Existing V9 transactional
-- writers consume the new source only for explicitly versioned custom pools.
begin;

create function app.custom_side_mode_scope_v10(tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;blocks jsonb:='[]'::jsonb;n integer;r record;
begin
 select count(*)into n from app.tournament_setup_side_pool_materializations m
 join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
 where m.tournament_id=tid and m.event_id=eid and s.custom_ratio_denominator_v3 is not null;
 if n=0 then return null;end if;
 rows:='[]'::jsonb;
 for r in select m.pool_id,s.id as setup_side_id,s.setup_revision_id,s.setup_event_version_id,s.slot,s.custom_ratio_denominator_v3 as ratio,
  e.client_row_id,i.id as intent_id,i.ratio_denominator,i.amount_method,i.original_intent,b.id as batch_id,b.request_hash,
  p.id as policy_id,p.method,p.ratio as policy_ratio,p.definition_version_id,p.operation_receipt_id
 from app.tournament_setup_side_pool_materializations m
 join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
 join app.tournament_setup_event_versions e on e.id=s.setup_event_version_id and e.tournament_id=s.tournament_id and e.setup_revision_id=s.setup_revision_id
 left join app.setup_custom_payout_intents_v2 i on i.tournament_id=s.tournament_id and i.setup_revision_id=s.setup_revision_id and i.setup_event_version_id=s.setup_event_version_id and i.scope='side'and i.pool_slot=s.slot
 left join app.setup_custom_payout_batches_v2 b on b.id=i.batch_id and b.tournament_id=i.tournament_id and b.setup_revision_id=i.setup_revision_id
 left join app.side_pool_graduated_policies_v2 p on p.pool_id=m.pool_id and p.tournament_id=m.tournament_id and p.event_id=m.event_id
 where m.tournament_id=tid and m.event_id=eid and s.custom_ratio_denominator_v3 is not null order by m.pool_id
 loop
  if r.intent_id is null or r.batch_id is null or r.ratio_denominator is distinct from r.ratio
   or r.amount_method is distinct from'graduated-custom-ratio-largest-remainder-5usd-v3'then blocks:=blocks||jsonb_build_array('custom_side_intent_required');end if;
  if r.policy_id is null then blocks:=blocks||jsonb_build_array('custom_side_policy_required');
  elsif r.method is distinct from'side-custom-graduated-policy-v4'or r.policy_ratio is distinct from r.ratio then blocks:=blocks||jsonb_build_array('custom_side_policy_mismatch');end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('poolId',r.pool_id,'setupSidePoolVersionId',r.setup_side_id,'setupRevisionId',r.setup_revision_id,
   'setupEventVersionId',r.setup_event_version_id,'eventClientRowId',r.client_row_id,'slot',r.slot,'ratio',r.ratio,
   'intentId',r.intent_id,'amountMethod',r.amount_method,'intent',r.original_intent,'batchId',r.batch_id,'requestHash',r.request_hash,
   'policyId',r.policy_id,'policyMethod',r.method,'policyRatio',r.policy_ratio,'definitionVersionId',r.definition_version_id,'policyReceiptId',r.operation_receipt_id));
 end loop;
 if jsonb_array_length(rows)<>n then blocks:=blocks||jsonb_build_array('custom_side_binding_ambiguous');end if;
 return jsonb_build_object('kind','custom-side-no-refund-scope-v10','tournamentId',tid,'eventId',eid,'sidePools',rows,'blockers',blocks);
end$$;
revoke all on function app.custom_side_mode_scope_v10(uuid,uuid)from public,anon,authenticated,service_role;

-- Pure projection only, never caller authorization. Authoritative source and
-- scope are assembled by the private readers, not accepted from an HTTP body.
create function app.project_combined_q_no_refunds_v10(base jsonb,scope_value jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare blocks jsonb;manifest jsonb;
begin
 if jsonb_typeof(base)is distinct from'object'or jsonb_typeof(base->'manifest')is distinct from'object'
  or jsonb_typeof(scope_value)is distinct from'object'or scope_value->>'kind'is distinct from'custom-side-no-refund-scope-v10'
  or jsonb_typeof(scope_value->'blockers')is distinct from'array'then return null;end if;
 blocks:=base->'blockers';if jsonb_typeof(blocks)is distinct from'array'then blocks:='["source_blocked"]'::jsonb;end if;
 blocks:=blocks||(scope_value->'blockers');
 if jsonb_typeof(base->'obligations')='array'then
  if exists(select 1 from jsonb_array_elements(base->'obligations')o where o->>'kind'='refund')then blocks:=blocks||jsonb_build_array('q_no_eligible_recipients');end if;
  if exists(select 1 from jsonb_array_elements(base->'obligations')o where o->>'kind'is null or o->>'kind'not in('award','refund'))then blocks:=blocks||jsonb_build_array('source_blocked');end if;
 elsif jsonb_array_length(blocks)=0 then blocks:=blocks||jsonb_build_array('source_blocked');end if;
 manifest:=(base->'manifest')||jsonb_build_object('combinedPoolSourceVersion','custom-pool-source-v10','refundPolicy','no-pool-refunds-v1','customSideScope',scope_value);
 return jsonb_build_object('eventId',base->'eventId','manifest',manifest,'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),
  'obligations',case when jsonb_array_length(blocks)=0 then base->'obligations'else'null'::jsonb end,'blockers',blocks);
end$$;
revoke all on function app.project_combined_q_no_refunds_v10(jsonb,jsonb)from public,anon,authenticated,service_role;

do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.q_obligation_sources_v2(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.q_obligation_sources_v2(','FUNCTION app.q_obligation_sources_pre_combined_custom_v10(');
 if p=d then raise exception'combined Q source clone anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.prize_accounting_source_v9(uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.prize_accounting_source_v9(','FUNCTION app.prize_accounting_source_pre_custom_v10(');
 if p=d then raise exception'combined accounting source clone anchor changed';end if;execute p;
end$$;
revoke all on function app.q_obligation_sources_pre_combined_custom_v10(uuid,uuid),app.prize_accounting_source_pre_custom_v10(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create or replace function app.q_obligation_sources_v2(actor uuid,tid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare base jsonb;scope_value jsonb;eid uuid;
begin
 base:=app.q_obligation_sources_pre_combined_custom_v10(actor,tid);if base is null then return null;end if;
 eid:=(base->>'eventId')::uuid;if eid is null then return base;end if;
 scope_value:=app.custom_side_mode_scope_v10(tid,eid);
 if scope_value is null then return base;end if;
 return app.project_combined_q_no_refunds_v10(base,scope_value);
end$$;
revoke all on function app.q_obligation_sources_v2(uuid,uuid)from public,anon,authenticated,service_role;

create or replace function app.prize_accounting_source_v9(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare base jsonb;scope_value jsonb;blocks jsonb;manifest jsonb;current_mode boolean;review_row jsonb;award_row jsonb;
begin
 scope_value:=app.custom_side_mode_scope_v10(tid,eid);
 current_mode:=scope_value is not null or exists(select 1 from app.q_operating_policies_v2 where tournament_id=tid and event_id=eid and method='q-custom-graduated-policy-v5');
 if not current_mode then return app.prize_accounting_source_pre_custom_v10(actor,tid,eid);end if;
 -- Explicitly opt into the original V9 calculation only in the new guarded
 -- custom path. The standalone Side candidate keeps its finalization block.
 base:=app.prize_accounting_source_pre_custom_side_v4(actor,tid,eid);if base is null then return null;end if;
 blocks:=base->'blockers';if jsonb_typeof(blocks)is distinct from'array'then blocks:='["source_blocked"]'::jsonb;end if;
 if scope_value is not null then blocks:=blocks||(scope_value->'blockers');end if;
 if base->'qReview'is not null and base->'qReview'<>'null'::jsonb then
  if jsonb_typeof(base#>'{qReview,obligations}')is distinct from'array'then blocks:=blocks||jsonb_build_array('q_review_required');
  elsif exists(select 1 from jsonb_array_elements(base#>'{qReview,obligations}')o where o->>'kind'='refund')then blocks:=blocks||jsonb_build_array('q_no_eligible_recipients');
  elsif exists(select 1 from jsonb_array_elements(base#>'{qReview,obligations}')o where o->>'kind'is distinct from'award')then blocks:=blocks||jsonb_build_array('source_blocked');end if;
 end if;
 if jsonb_typeof(base->'sideReviews')is distinct from'array'then blocks:=blocks||jsonb_build_array('side_review_required');
 else
  for review_row in select value from jsonb_array_elements(base->'sideReviews')loop
   if jsonb_typeof(review_row->'obligations')is distinct from'array'then blocks:=blocks||jsonb_build_array('side_review_required');continue;end if;
   for award_row in select value from jsonb_array_elements(review_row->'obligations')loop
    if award_row->>'status'is distinct from'unpaid'or(award_row?'kind'and award_row->>'kind'is distinct from'award')
     or jsonb_typeof(award_row->'amountMinor')is distinct from'number'or coalesce(award_row->>'amountMinor','')!~'^[1-9][0-9]*$'
    then blocks:=blocks||jsonb_build_array('side_source_blocked');
    elsif mod((award_row->>'amountMinor')::numeric,500)<>0 then blocks:=blocks||jsonb_build_array('side_source_blocked');end if;
   end loop;
  end loop;
 end if;
 manifest:=(base->'manifest')||jsonb_build_object('combinedPoolSourceVersion','custom-pool-accounting-v10','refundPolicy','no-pool-refunds-v1','customSideScope',scope_value,'blocks',blocks);
 return jsonb_set(jsonb_set(jsonb_set(base,'{manifest}',manifest),'{sourceDigest}',to_jsonb(encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'))),'{blockers}',blocks);
end$$;
revoke all on function app.prize_accounting_source_v9(uuid,uuid,uuid)from public,anon,authenticated,service_role;

do $$declare signature text;begin foreach signature in array array[
 'app.custom_side_mode_scope_v10(uuid,uuid)',
 'app.project_combined_q_no_refunds_v10(jsonb,jsonb)',
 'app.q_obligation_sources_pre_combined_custom_v10(uuid,uuid)',
 'app.prize_accounting_source_pre_custom_v10(uuid,uuid,uuid)',
 'app.q_obligation_sources_v2(uuid,uuid)',
 'app.prize_accounting_source_v9(uuid,uuid,uuid)'
 ]loop execute format('alter function %s owner to postgres',signature);end loop;end$$;
commit;
