-- PRIVATE SOURCE CANDIDATE ONLY. No grants, writes, new liability or retry.
-- Existing pool records do not store original session IDs. This reader proves
-- the CURRENT own session; it does not claim the request used that same session.
begin;
create function app.native_mixed_pool_operation_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.get_native_mixed_pool_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql volatile security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;is_director boolean;v_action text;expected_kind text;rh text;response jsonb;
 operation_row app.native_mixed_pool_operations_v1%rowtype;record_row app.native_mixed_pool_records_v1%rowtype;
 receipt_row app.operation_receipts%rowtype;
begin
 if app.native_mixed_pool_operation_read_enabled_v1()is distinct from true
  or app.native_mixed_pool_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 -- Technical wire bound, not a pool/business limit. Apply before lock/hash work.
 if request is null or octet_length(convert_to(request::text,'UTF8'))>32768 then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,
  app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedJournalDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-pool-request-v1'
  or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'<>trim(request->>'reason')
  or length(request->>'reason')not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'then return null;end if;
 v_action:=request->>'action';if v_action is null or v_action not in('policy','elect','fund','seal','final')then return null;end if;
 perform 1 from app.tournament_roles tr where tr.tournament_id=tid and tr.profile_id=actor and tr.role='director'for share nowait;
 is_director:=found;if v_action<>'elect'and not is_director then return null;end if;
 lock table app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1,
  app.operation_receipts,app.audit_events,app.event_participants,app.tournament_roster_entries,
  app.roster_account_links in share mode nowait;
 select o.*into operation_row from app.native_mixed_pool_operations_v1 o where o.actor_id=actor and o.operation_id=op;
 -- Absence is not an assertion of non-execution or permission to write.
 if operation_row.operation_id is null then return null;end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-finance-v1',actor,op,tid,eid,request));
 if operation_row.tournament_id is distinct from tid or operation_row.event_id is distinct from eid
  or operation_row.request_payload is distinct from request or operation_row.request_hash is distinct from rh then return null;end if;
 select r.*into record_row from app.native_mixed_pool_records_v1 r where r.id=operation_row.record_id;
 select r.*into receipt_row from app.operation_receipts r where r.id=operation_row.receipt_id;
 expected_kind:=case v_action when'elect'then'election'when'fund'then'funding'else v_action end;
 if record_row.id is null or record_row.tournament_id is distinct from tid or record_row.event_id is distinct from eid
  or record_row.actor_id is distinct from actor or record_row.operation_id is distinct from op or record_row.kind is distinct from expected_kind
  or record_row.source_digest is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-record-v1',
   record_row.id,tid,eid,record_row.entity_key,record_row.version,record_row.prior_id,record_row.kind,actor,op,record_row.payload))
  or receipt_row.id is null or receipt_row.actor_profile_id is distinct from actor or receipt_row.client_operation_id is distinct from op
  or receipt_row.tournament_id is distinct from tid or receipt_row.target_id is distinct from record_row.id
  or receipt_row.operation_type is distinct from'native_mixed_pool_simulation_v1'or receipt_row.request_hash is distinct from rh
  or receipt_row.outcome is distinct from'accepted'or receipt_row.response_payload is distinct from operation_row.response_payload
  or not exists(select 1 from app.audit_events a where a.operation_receipt_id=receipt_row.id and a.tournament_id=tid
   and a.actor_profile_id=actor and a.entity_type='native_mixed_pool_simulation'and a.entity_id=record_row.id and a.action=v_action
   and a.after_state=jsonb_build_object('digest',record_row.source_digest,'simulationOnly',true,'moneyMoved',false))then return null;end if;
 -- The stored receipt must be exactly the writer's non-private response.
 response:=jsonb_build_object('status','accepted','kind','native-mixed-pool-receipt-v1','action',v_action,'recordId',record_row.id,
  'recordDigest',record_row.source_digest,'operationId',op,'tournamentId',tid,'eventId',eid,'simulationOnly',true,'current',true,
  'ordinaryLiability',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'refunds','[]'::jsonb);
 if response is distinct from operation_row.response_payload then return null;end if;
 if v_action='elect'then
  if record_row.payload->>'policyId'is distinct from request#>>'{data,policyId}'
   or record_row.payload->>'policyDigest'is distinct from request#>>'{data,policyDigest}'
   or record_row.payload#>>'{participant,participantId}'is distinct from request#>>'{data,participantId}'
   or record_row.payload->'elected'is distinct from request#>'{data,elected}'
   or record_row.payload->'acknowledged'is distinct from request#>'{data,acknowledged}'
   or record_row.payload->'consentReference'is distinct from request#>'{data,consentReference}'then return null;end if;
  if not is_director and(record_row.payload#>>'{participant,mode}'is distinct from'digital'
   or record_row.payload#>>'{participant,profileId}'is distinct from actor::text
   or not exists(select 1 from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
    join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=actor
    where p.id::text=record_row.payload#>>'{participant,participantId}'and p.tournament_id=tid and p.event_id=eid
     and p.profile_id=actor and r.scorecard_type='digital'and r.id::text=record_row.payload#>>'{participant,rosterEntryId}'))then return null;end if;
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response||jsonb_build_object('current',false,'historicalReceipt',true,'recovered',true,
  'currentSourceVerified',false,'writeAuthorized',false,'originalSessionVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy','current',false,'writeAuthorized',false);end$$;
create function public.get_native_mixed_pool_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql volatile security definer set search_path=''as $$select app.get_native_mixed_pool_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request)$$;
do $acl$declare f regprocedure;begin foreach f in array array[
 'app.native_mixed_pool_operation_read_enabled_v1()'::regprocedure,
 'app.get_native_mixed_pool_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'public.get_native_mixed_pool_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$acl$;
commit;
