-- LOCAL ONLY. Read-only, event-scoped selector inputs; never implies payment,
-- consent, fixture enrollment, payout authority, or a completed financial run.
begin;
create function public.get_simulated_finance_selector_workspace_v1(actor uuid, tid uuid, eid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare finance jsonb; final_state jsonb; event_name text; setup_id uuid; base_fee integer; pools jsonb; participants jsonb; sources jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','') <> 'service_role'
  or actor is null or tid is null or eid is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')) then return null; end if;
 finance:=public.get_multi_event_finance_workspace_v1(actor,tid);
 if finance is null then return null; end if;
 if finance->>'status'='not_enabled' then return jsonb_build_object('status','blocked','code','owner_enrollment_required'); end if;
 if finance->>'status' is distinct from 'available' then return jsonb_build_object('status','blocked','code',coalesce(finance->>'code','finance_unavailable')); end if;
 if finance->>'evidenceKind' is distinct from 'simulation' then return jsonb_build_object('status','blocked','code','synthetic_mode_required'); end if;
 -- 0287 can arrive after this migration. Missing or malformed closure status
 -- is never treated as an open financial workspace.
 if pg_catalog.to_regprocedure('app.get_multi_event_joint_final_candidate_v1(uuid,uuid)') is null then return jsonb_build_object('status','blocked','code','joint_final_status_unavailable'); end if;
 execute 'select app.get_multi_event_joint_final_candidate_v1($1,$2)' into final_state using actor,tid;
 if final_state is null or final_state->>'tournamentId' is distinct from tid::text or final_state->'moneyMoved' is distinct from 'false'::jsonb
  or not ((final_state->>'status'='not_finalized' and final_state->'financialClosed'='false'::jsonb)
   or (final_state->>'status'='synthetic_joint_unpaid_finalized' and final_state->'financialClosed'='true'::jsonb and final_state->'humanReviewClaimed'='false'::jsonb)) then
  return jsonb_build_object('status','blocked','code','joint_final_status_unavailable'); end if;
 select e.name,a.setup_event_version_id,v.entry_fee_cents into event_name,setup_id,base_fee
 from app.events e join app.tournament_setup_activations a on a.tournament_id=e.tournament_id and a.event_id=e.id
 join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=e.tournament_id
 where e.id=eid and e.tournament_id=tid and e.operational_state='active';
 if setup_id is null then return jsonb_build_object('status','blocked','code','event_unavailable'); end if;
 if (select count(*) from app.event_participants where tournament_id=tid and event_id=eid)>256 then
  return jsonb_build_object('status','blocked','code','participant_limit_exceeded'); end if;
 if exists(select 1 from app.event_participants p left join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
  where p.tournament_id=tid and p.event_id=eid and p.status in('registered','checked_in') and r.id is null) then
  return jsonb_build_object('status','blocked','code','participant_roster_unavailable'); end if;
 if exists(select 1 from app.tournament_setup_side_pool_versions s where s.tournament_id=tid and s.setup_event_version_id=setup_id and
  (select count(*) from app.tournament_setup_side_pool_materializations m join app.event_side_pool_definition_versions d on d.pool_id=m.pool_id and d.event_id=m.event_id and d.tournament_id=m.tournament_id
   where m.tournament_id=tid and m.event_id=eid and m.setup_side_pool_version_id=s.id and d.active
    and d.id=(select latest.id from app.event_side_pool_definition_versions latest where latest.pool_id=d.pool_id order by latest.version desc limit 1))<>1) then
  return jsonb_build_object('status','blocked','code','side_materialization_unavailable'); end if;
 select coalesce(jsonb_agg(x.obj order by x.kind,x.slot),'[]'::jsonb) into pools from (
  select 'q'::text kind,q.slot,jsonb_build_object('kind','q','slot',q.slot,'name','Q Pool '||q.slot::text,'definitionId',q.id,'type',q.pool_type_code,'feeMinor',q.entry_fee_cents,
   'policyId',p.id,'policyMethod',p.method,'policyRatio',p.ratio) obj
  from app.tournament_setup_q_pool_versions q left join app.multi_event_pool_disclosures_v1 p on p.tournament_id=tid and p.event_id=eid and p.pool_kind='q' and p.pool_definition_id=q.id
  where q.tournament_id=tid and q.setup_event_version_id=setup_id
  union all
  select 'side'::text,s.slot,jsonb_build_object('kind','side','slot',s.slot,'name',s.pool_type_code,'definitionId',d.id,'type',s.payout_type,'feeMinor',s.entry_fee_cents,
   'policyId',p.id,'policyMethod',p.method,'policyRatio',p.ratio) obj
  from app.tournament_setup_side_pool_versions s join app.tournament_setup_side_pool_materializations m on m.tournament_id=tid and m.event_id=eid and m.setup_side_pool_version_id=s.id
  join app.event_side_pool_definition_versions d on d.tournament_id=tid and d.event_id=eid and d.pool_id=m.pool_id and d.active and d.id=(select latest.id from app.event_side_pool_definition_versions latest where latest.pool_id=d.pool_id order by latest.version desc limit 1)
  left join app.multi_event_pool_disclosures_v1 p on p.tournament_id=tid and p.event_id=eid and p.pool_kind='side' and p.pool_definition_id=d.id
  where s.tournament_id=tid and s.setup_event_version_id=setup_id
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,'name',r.claimed_display_name,'status',p.status,
  'receiptRecorded',exists(select 1 from app.multi_event_pool_receipts_v1 pr cross join lateral jsonb_array_elements(pr.components) pc where pr.tournament_id=tid and pr.roster_entry_id=r.id and pc->>'eventId'=eid::text)
   or exists(select 1 from app.multi_event_finance_sources_v1 fs cross join lateral jsonb_array_elements(fs.allocations) fa where fs.tournament_id=tid and fs.roster_entry_id=r.id and fs.source_kind='receipt' and fa->>'eventId'=eid::text),
  'elections',coalesce((select jsonb_agg(jsonb_build_object('policyId',el.policy_id,'electionId',el.id,'version',el.version,'elected',el.elected) order by el.policy_id)
   from app.multi_event_pool_elections_v1 el where el.tournament_id=tid and el.event_id=eid and el.participant_id=p.id
   and el.version=(select max(prev.version) from app.multi_event_pool_elections_v1 prev where prev.policy_id=el.policy_id and prev.participant_id=p.id)),'[]'::jsonb)) order by lower(r.claimed_display_name),p.id),'[]'::jsonb)
 into participants from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 where p.tournament_id=tid and p.event_id=eid and p.status in('registered','checked_in');
 sources:=public.get_multi_event_synthetic_event_sources_v1(actor,tid,eid);
 if sources is null then return jsonb_build_object('status','blocked','code','source_unavailable'); end if;
 return jsonb_build_object('status','available','tournamentId',tid,'eventId',eid,'eventName',event_name,'baseFeeMinor',base_fee,'pools',pools,'participants',participants,
  'sources',sources,'eventStarted',exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid),
  'anyReceiptRecorded',exists(select 1 from app.multi_event_pool_receipts_v1 pr cross join lateral jsonb_array_elements(pr.components) pc where pr.tournament_id=tid and pc->>'eventId'=eid::text)
   or exists(select 1 from app.multi_event_finance_sources_v1 fs cross join lateral jsonb_array_elements(fs.allocations) fa where fs.tournament_id=tid and fs.source_kind='receipt' and fa->>'eventId'=eid::text),
  'expenseReviewVersion',(select coalesce(max(version),0) from app.multi_event_expense_reviews_v1 where tournament_id=tid and event_id=eid),
  'sanctioningAssessmentMinor',app.settlement_assessment_v5(eid),'financialClosed',final_state->'financialClosed','writerRoleRequired','director','moneyMoved',false,'humanConsentClaimed',false,'accountingAvailable',false);
end $$;
revoke all on function public.get_simulated_finance_selector_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_simulated_finance_selector_workspace_v1(uuid,uuid,uuid) to service_role;
commit;
