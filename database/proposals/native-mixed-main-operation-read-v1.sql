-- PRIVATE DEFAULT-OFF SOURCE CANDIDATE. Historical owned Main receipt only.
-- No policy, grant, journal mutation, current-source claim or retry permission.
-- Stored original session evidence remains internal; current authentication
-- does not certify that the caller still uses the original request's session.
begin;
create function app.native_mixed_main_operation_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.get_native_mixed_main_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql volatile security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;v_action text;rh text;response jsonb;
 record_row app.native_mixed_main_finance_records_v1%rowtype;
 receipt_row app.operation_receipts%rowtype;
begin
 if app.native_mixed_main_operation_read_enabled_v1()is distinct from true
  or app.native_mixed_main_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 -- Normalized JSON technical bound precedes lock/hash work. A cold backend may
 -- still need rowtype catalog locks during compilation: SQLSTATE 55P03 there
 -- is an unknown read outcome, not proof of absence or authorization to write.
 if request is null or octet_length(convert_to(request::text,'UTF8'))>32768 then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,
  app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles tr where tr.tournament_id=tid and tr.profile_id=actor and tr.role='director'for share nowait;
 if not found then return null;end if;
 if tid is null or eid is null or op is null
  or app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','expectedJournalDigest','data','reason'])is distinct from true
  or request->>'version'is distinct from'native-mixed-main-finance-request-v1'
  or jsonb_typeof(request->'expectedSourceDigest')is distinct from'string'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'expectedJournalDigest')is distinct from'string'or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'<>trim(request->>'reason')
  or length(request->>'reason')not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'
  or jsonb_typeof(request->'data')is distinct from'object'then return null;end if;
 v_action:=request->>'action';if v_action is null or v_action not in('cost-line','review-costs','propose-awards','finalize-unpaid')then return null;end if;
 -- The existing bound helper reads the complete journal prefix, cost lineage,
 -- award/review references, actual final obligation rows, receipts and audits.
 -- Reserve all those domains coherently without requiring the current source.
 lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1,
  app.operation_receipts,app.audit_events in share mode nowait;
 select m.*into record_row from app.native_mixed_main_finance_records_v1 m where m.actor_id=actor and m.operation_id=op;
 -- Missing is unknown; it never establishes non-execution or permission.
 if record_row.id is null then return null;end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',actor,tid,eid,request));
 if record_row.tournament_id is distinct from tid or record_row.event_id is distinct from eid
  or record_row.actor_id is distinct from actor or record_row.operation_id is distinct from op
  or record_row.kind is distinct from v_action or record_row.request_payload is distinct from request
  or record_row.request_hash is distinct from rh
  or app.native_mixed_main_finance_record_bound_v1(record_row.id)is distinct from true then return null;end if;
 select r.*into receipt_row from app.operation_receipts r where r.id=record_row.receipt_id;
 if receipt_row.id is null or receipt_row.tournament_id is distinct from tid or receipt_row.actor_profile_id is distinct from actor
  or receipt_row.client_operation_id is distinct from op or receipt_row.target_id is distinct from record_row.id
  or receipt_row.operation_type is distinct from'native_mixed_main_finance_v1'
  or receipt_row.request_hash is distinct from rh or receipt_row.outcome is distinct from'accepted'
  or receipt_row.response_payload is distinct from record_row.response_payload then return null;end if;
 -- Independently pin the public response; the bound helper also proves that
 -- this response is the exact audit after_state and reconstructs payload/rows.
 response:=jsonb_build_object('status','accepted','kind','native-mixed-main-finance-receipt-v1','action',v_action,
  'recordId',record_row.id,'recordDigest',record_row.record_digest,'sequence',record_row.sequence,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,
  'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if response is distinct from record_row.response_payload then return null;end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response||jsonb_build_object('operationId',op,'tournamentId',tid,'eventId',eid,
  'current',false,'historicalReceipt',true,'recovered',true,'currentSourceVerified',false,
  'writeAuthorized',false,'originalSessionVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy','current',false,'writeAuthorized',false);end$$;

create function public.get_native_mixed_main_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql volatile security definer set search_path=''as $$
 select app.get_native_mixed_main_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request)
$$;
do $acl$declare f regprocedure;begin foreach f in array array[
 'app.native_mixed_main_operation_read_enabled_v1()'::regprocedure,
 'app.get_native_mixed_main_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'public.get_native_mixed_main_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',f);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$acl$;
commit;
