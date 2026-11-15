-- UNEXECUTED private native source reader. No write/grant/bank-receipt proof.
-- Related sources use ONE statement snapshot, not a commit reservation.
-- Allocation commits require a separate complete locking protocol.
begin;
create function app.native_ledger_has_mixed_scope_v1(tid uuid)returns boolean
language plpgsql security definer set search_path=''as $$
declare n text;r regclass;enrolled boolean;
begin
 foreach n in array array['app.synthetic_mixed_fixtures_v1','app.synthetic_mixed_finance_scopes_v1']loop
  r:=to_regclass(n);if r is null then continue;end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid=r and attname='tournament_id'and atttypid='uuid'::regtype and not attisdropped)then return null;end if;
  execute format('select exists(select 1 from %s where tournament_id=$1)',r)into enrolled using tid;
  if enrolled then return true;end if;
 end loop;
 return false;
exception when undefined_table or undefined_column then return null;
end$$;
create function app.get_native_event_ledger_sources_v1(p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();capture jsonb;facts jsonb;h text;mixed_before boolean;mixed_after boolean;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 mixed_before:=app.native_ledger_has_mixed_scope_v1(p_tournament_id);
 if mixed_before is distinct from false then return jsonb_build_object('status','blocked','code','mixed_or_unknown_synthetic_domain');end if;
 -- Native heads, eligibility, events, optional evidence and histories all share
 -- this ONE SQL statement's MVCC snapshot. Not all related writers lock the
 -- tournament, so this is explicitly not a commit-current allocation source.
 with active_events as materialized(select*from app.events where tournament_id=p_tournament_id and operational_state='active'),
 activation as materialized(select b.*,v.entry_fee_cents from app.tournament_setup_activations b join active_events e on e.id=b.event_id and e.tournament_id=b.tournament_id join app.tournament_setup_event_versions v on v.id=b.setup_event_version_id and v.tournament_id=b.tournament_id where b.tournament_id=p_tournament_id),
 pools as materialized(
  select q.id pool_id,b.event_id,'q'kind from app.tournament_setup_q_pool_versions q join activation b on b.setup_event_version_id=q.setup_event_version_id and b.tournament_id=q.tournament_id where q.tournament_id=p_tournament_id
  union all select s.id,s.event_id,'side'from app.event_side_pools s join active_events e on e.id=s.event_id and e.tournament_id=s.tournament_id where s.tournament_id=p_tournament_id),
 receipts as materialized(select distinct on(roster_entry_id)*from app.roster_payment_events where tournament_id=p_tournament_id order by roster_entry_id,version desc),
 expenses as materialized(select distinct on(expense_id)*from app.tournament_expense_events where tournament_id=p_tournament_id order by expense_id,version desc),
 history as materialized(select*from(
  select 'roster_receipt'kind,id,roster_entry_id owner_id,version,event_type state from app.roster_payment_events where tournament_id=p_tournament_id
  union all select 'expense',id,expense_id,version,event_type from app.tournament_expense_events where tournament_id=p_tournament_id)x order by kind,id limit 20001)
 select jsonb_build_object(
  'syntheticDomain',exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=p_tournament_id)or exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id),
  'eventCount',(select count(*)from active_events),'bindingCount',(select count(*)from activation),'historyCount',(select count(*)from history),
  'facts',jsonb_build_object(
   'eventIds',coalesce((select jsonb_agg(id order by id)from active_events),'[]'),
   'activationBindings',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_id,'activationId',id,'setupRevisionId',setup_revision_id,'setupEventVersionId',setup_event_version_id,'entryFeeMinor',entry_fee_cents)order by event_id)from activation),'[]'),
   'pools',coalesce((select jsonb_agg(jsonb_build_object('poolId',pool_id,'eventId',event_id,'kind',kind)order by pool_id)from pools),'[]'),
   'receiptEvents',coalesce((select jsonb_agg(jsonb_build_object('sourceId',r.id,'physicalEvidenceId',r.id,'rosterEntryId',r.roster_entry_id,'amountMinor',r.amount_minor,'currency','USD',
    'eligibleEventIds',coalesce((select jsonb_agg(p.event_id order by p.event_id)from app.event_participants p join active_events e on e.id=p.event_id and e.tournament_id=p.tournament_id where p.tournament_id=p_tournament_id and p.roster_entry_id=r.roster_entry_id and p.status in('registered','checked_in')),'[]'))order by r.id)from receipts r where r.event_type='received'),'[]'),
   'expenseEvents',coalesce((select jsonb_agg(jsonb_build_object('sourceId',id,'physicalEvidenceId',id,'expenseId',expense_id,'amountMinor',amount_minor,'currency','USD')order by id)from expenses where event_type='recorded'),'[]'),
   'historyIds',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'sourceId',id,'ownerId',owner_id,'version',version,'state',state)order by kind,id)from history),'[]'),
   'existingOptionalAllocationEvidence',exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=p_tournament_id)or exists(select 1 from app.q_pool_allocation_versions_v1 where tournament_id=p_tournament_id)or exists(select 1 from app.event_side_pool_election_versions where tournament_id=p_tournament_id)or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=p_tournament_id)
  ))into capture;
 mixed_after:=app.native_ledger_has_mixed_scope_v1(p_tournament_id);
 if mixed_after is distinct from false or(capture->>'syntheticDomain')::boolean then return jsonb_build_object('status','blocked','code','mixed_or_unknown_synthetic_domain');end if;
 if(capture->>'eventCount')::integer not between 1 and 32 or capture->'bindingCount'is distinct from capture->'eventCount'then return jsonb_build_object('status','blocked','code','event_activation_registry_unavailable');end if;
 if(capture->>'historyCount')::integer>20000 then return jsonb_build_object('status','blocked','code','technical_resource_bound');end if;
 facts:=capture->'facts';
 if(select count(*)<>count(distinct value->>'poolId')from jsonb_array_elements(facts->'pools'))then return jsonb_build_object('status','blocked','code','pool_identity_ambiguous');end if;
 if(select count(*)<>count(distinct value->>'sourceId')from jsonb_array_elements(facts->'historyIds'))then return jsonb_build_object('status','blocked','code','source_identity_ambiguous');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-event-ledger-sources-v1',p_tournament_id,facts)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','sources_available','kind','native-event-ledger-sources-v1','actorId',a,'tournamentId',p_tournament_id,'sourceDigest',h,'facts',facts,
  'snapshotConsistency','statement_snapshot','allocationCapability',false,'additionalIncomeSourceAvailable',false,'bankReceiptVerified',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.native_ledger_has_mixed_scope_v1(uuid)owner to postgres;
alter function app.get_native_event_ledger_sources_v1(uuid)owner to postgres;
revoke all on function app.native_ledger_has_mixed_scope_v1(uuid),app.get_native_event_ledger_sources_v1(uuid)from public,anon,authenticated,service_role;
commit;
