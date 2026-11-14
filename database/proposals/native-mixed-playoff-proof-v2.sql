-- PRIVATE CLOSED proof-only followup. Frozen V1 source remains unchanged.
-- Requires native-mixed-playoff-reopen-v1.sql SHA256 2c6c0a253adc887443e6c33203115b94a261d167243ce32c603fb689f501c6e7.
-- Same wire, hashes, policy, authority and every row/header/receipt/audit check.
-- No tables, grants, enablement, public API, cache or sporting result changes.
begin;
do $dependencies$declare x record;p record;begin
 for x in select*from(values ('app.native_mixed_playoff_row_bound_v1(uuid,text)','de4622bc360a3ea03ccd5255bca0915e2d2e2178672b32f9ef63ddd0af445a04'),('app.native_mixed_playoff_reopen_bound_v1(uuid)','335f74451014f230191568a2741925994013b286c167c593e830bda83fe34343'))v(signature,body_sha)loop
  select*into p from pg_proc where oid=to_regprocedure(x.signature);
  if p.oid is null or encode(extensions.digest(replace(p.prosrc,E'\r\n',E'\n'),'sha256'),'hex')<>x.body_sha
   or pg_get_userbyid(p.proowner)<>'postgres'or p.prosecdef is distinct from true or p.provolatile<>'s'
   or p.proconfig is distinct from array['search_path=""','TimeZone=UTC']::text[]
   or has_function_privilege('anon',p.oid,'execute')or has_function_privilege('authenticated',p.oid,'execute')or has_function_privilege('service_role',p.oid,'execute')
  then raise exception 'playoff_proof_dependency_changed: %',x.signature;end if;
 end loop;end$dependencies$;
create function app.native_mixed_playoff_leaf_row_bound_v2(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare v jsonb;r app.operation_receipts%rowtype;q jsonb;d jsonb;expected_entry jsonb;artifact jsonb;prior_history jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;begin
 if kind='context'then select to_jsonb(x)into v from app.native_mixed_playoff_contexts_v1 x where id=row_id;
 elsif kind='evidence'then select to_jsonb(x)into v from app.native_mixed_playoff_all_evidence_v1() x where id=row_id;else return false;end if;
 if v is null then return false;end if;
 q:=v->'request_payload';d:=q->'data';
 if not app.native_mixed_pool_exact_v1(q,array['version','action','expectedSourceDigest','data','reason'])
  or q->>'version'is distinct from'native-mixed-playoff-request-v1'then return false;end if;
 if kind='context'then
  if q->>'action'is distinct from'create-context'or not app.native_mixed_pool_exact_v1(d,array[]::text[])
   or q->>'expectedSourceDigest'is distinct from v->>'source_digest'
   or v#>>'{source_capture,tournamentId}'is distinct from v->>'tournament_id'
   or v#>>'{source_capture,eventId}'is distinct from v->>'event_id'
   or v#>>'{source_capture,startId}'is distinct from v->>'start_id'
   or v->>'source_digest'is distinct from app.native_mixed_simulation_hash_v1(v->'source_capture')
   or v->>'context_digest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',row_id,(v->>'tournament_id')::uuid,(v->>'event_id')::uuid,(v->>'start_id')::uuid,v->>'source_digest'))then return false;end if;
 else
  select*into c from app.native_mixed_playoff_contexts_v1 where id=(v->>'context_id')::uuid;
  if c.id is null or c.tournament_id::text is distinct from v->>'tournament_id'or c.event_id::text is distinct from v->>'event_id'
   or q->>'action'is distinct from'game-action'or q->>'expectedSourceDigest'is distinct from c.source_digest
   or not app.native_mixed_pool_exact_v1(d,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])
   or d->>'contextId'is distinct from v->>'context_id'or d->'slot'is distinct from v->'slot'or d->'gameNumber'is distinct from v->'game_number'
   or d->>'expectedMatchDigest'is distinct from v->>'match_digest'or d->'expectedRevision'is distinct from to_jsonb((v->>'sequence')::integer-1)
   or jsonb_typeof(d->'entry')is distinct from'object'or(d->'entry')?|array['id','actorId']
   or(d#>>'{entry,type}'='paper-capture'and(d->'entry')?'artifactDigest')
   or not app.native_mixed_pool_exact_v1(v->'authority_capture',array['actorId','sessionId','roles','paperIdentityBinding','simulationOnly'])
   or v#>>'{authority_capture,actorId}'is distinct from v->>'actor_id'or v#>>'{authority_capture,sessionId}'is distinct from v->>'actor_session_id'
   or v#>'{authority_capture,simulationOnly}'is distinct from'true'::jsonb then return false;end if;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into prior_history from app.native_mixed_playoff_all_evidence_v1()
   where context_id=c.id and slot=(v->>'slot')::integer and game_number=(v->>'game_number')::integer and sequence<(v->>'sequence')::integer and app.native_mixed_playoff_entry_attempt_v1(id)is not distinct from app.native_mixed_playoff_entry_attempt_v1(row_id);
  if jsonb_array_length(prior_history)<>(v->>'sequence')::integer-1 or d->>'expectedHistoryDigest'is distinct from app.native_mixed_playoff_attempt_digest_v1(c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history,app.native_mixed_playoff_entry_attempt_v1(row_id))then return false;end if;
  expected_entry:=jsonb_build_object('id',row_id,'actorId',(v->>'actor_id')::uuid)||(d->'entry');
  if d#>>'{entry,type}'='paper-capture'then
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',(v->>'slot')::integer,'gameNumber',(v->>'game_number')::integer,'claims',d#>'{entry,claims}','physicalOriginal',false,'actualPlayClaimed',false);
   expected_entry:=expected_entry||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
  end if;
  if v->'entry'is distinct from expected_entry
   or v->>'entry_digest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',row_id,(v->>'context_id')::uuid,(v->>'slot')::integer,(v->>'game_number')::integer,(v->>'sequence')::integer,(v->>'actor_id')::uuid,(v->>'actor_session_id')::uuid,(v->>'operation_id')::uuid,v->'request_payload',v->>'match_digest',v->'entry',v->'authority_capture'))then return false;end if;
 end if;
 select*into r from app.operation_receipts where id=(v->>'receipt_id')::uuid;
 return r.id is not null and r.actor_profile_id=(v->>'actor_id')::uuid and r.client_operation_id=(v->>'operation_id')::uuid
  and r.tournament_id=(v->>'tournament_id')::uuid and r.target_id=row_id and r.operation_type='native_mixed_playoff_v1'
  and r.request_hash=v->>'request_hash'and r.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',r.actor_profile_id,r.tournament_id,(v->>'event_id')::uuid,v->'request_payload'))
  and r.outcome='accepted'and r.response_payload=v->'response_payload'
  and exists(select 1 from app.audit_events a where a.tournament_id=r.tournament_id and a.actor_profile_id=r.actor_profile_id and a.operation_receipt_id=r.id
   and a.entity_type='native_mixed_playoff_simulation'and a.entity_id=row_id and a.action=kind and a.after_state=r.response_payload);
end$$;

create or replace function app.native_mixed_playoff_row_bound_v1(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare attempt uuid;begin
 if app.native_mixed_playoff_leaf_row_bound_v2(row_id,kind)is distinct from true then return false;end if;
 if kind='evidence'then
  attempt:=app.native_mixed_playoff_entry_attempt_v1(row_id);
  if attempt is not null then return app.native_mixed_playoff_reopen_bound_v1(attempt);end if;
 end if;
 return true;end$$;

create or replace function app.native_mixed_playoff_reopen_bound_v1(reopen uuid)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare p app.native_mixed_playoff_reopens_v1%rowtype;prior app.native_mixed_playoff_reopens_v1%rowtype;r app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;h jsonb;v record;cursor_id uuid:=reopen;seen uuid[]:=array[]::uuid[];root_context uuid;root_slot integer;root_game integer;expected_version integer;m jsonb;begin
 -- Function-local state only. A historical header/row is proved once in this
 -- strictly decreasing chain; no session setting or client cache is trusted.
 while cursor_id is not null loop
 if cursor_id=any(seen)then return false;end if;seen:=array_append(seen,cursor_id);
 select*into p from app.native_mixed_playoff_reopens_v1 where id=cursor_id;if p.id is null then return false;end if;
 if root_context is null then
  root_context:=p.context_id;root_slot:=p.slot;root_game:=p.game_number;expected_version:=p.version;
  m:=app.native_mixed_playoff_match_v1(root_context,root_slot);if m is null then return false;end if;
 elsif p.context_id<>root_context or p.slot<>root_slot or p.game_number<>root_game or p.version<>expected_version then return false;end if;
 if p.version<1 or(p.version=1 and p.prior_attempt_id is not null)or(p.version>1 and p.prior_attempt_id is null)then return false;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=p.context_id;select*into r from app.operation_receipts where id=p.receipt_id;
 if c.id is null or c.tournament_id<>p.tournament_id or c.event_id<>p.event_id or app.native_mixed_playoff_leaf_row_bound_v2(c.id,'context')is distinct from true
 or r.id is null or r.actor_profile_id<>p.actor_id or r.client_operation_id<>p.operation_id or r.tournament_id<>p.tournament_id
 or r.target_id<>p.id or r.operation_type<>'native_mixed_playoff_reopen_v1'or r.outcome<>'accepted'or r.response_payload<>p.response_payload
 or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-request-v1',p.actor_id,p.tournament_id,p.event_id,p.operation_id,p.request_payload))
 or p.authority_capture->>'subjectId'is distinct from p.actor_id::text or p.authority_capture->>'sessionId'is distinct from p.actor_session_id::text
 or p.authority_capture->'directorChecked'is distinct from'true'::jsonb or p.authority_capture->'nonselfChecked'is distinct from'true'::jsonb
 or p.request_payload->>'expectedSourceDigest'<>c.source_digest or p.request_payload->>'expectedPolicyDigest'<>app.native_mixed_simulation_hash_v1(p.policy_capture)
 or not exists(select 1 from app.correction_policy_versions x where x.tournament_id=p.tournament_id and to_jsonb(x)=p.policy_capture and x.required_approvals=0)
 or not exists(select 1 from app.paper_official_identity_bindings x where x.id=(p.authority_capture->>'paperIdentityBindingId')::uuid and x.tournament_id=p.tournament_id and x.official_profile_id=p.actor_id)
 or not exists(select 1 from app.audit_events x where x.operation_receipt_id=r.id and x.tournament_id=p.tournament_id and x.actor_profile_id=p.actor_id and x.entity_type='native_mixed_playoff_reopen'and x.entity_id=p.id and x.action='game_reopened'and x.after_state=p.response_payload)then return false;end if;
 if p.prior_attempt_id is not null then
  select*into prior from app.native_mixed_playoff_reopens_v1 where id=p.prior_attempt_id and context_id=p.context_id and slot=p.slot and game_number=p.game_number and version=p.version-1;
  if prior.id is null then return false;end if;
 end if;
 for v in select*from app.native_mixed_playoff_attempt_history_v1(p.context_id,p.slot,p.game_number,p.prior_attempt_id)loop
  if app.native_mixed_playoff_leaf_row_bound_v2(v.id,'evidence')is distinct from true then return false;end if;
 end loop;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_playoff_attempt_history_v1(p.context_id,p.slot,p.game_number,p.prior_attempt_id);
 if(h=p.prior_history and jsonb_array_length(h)=(p.request_payload->>'expectedRevision')::integer
 and app.native_mixed_playoff_attempt_digest_v1(p.context_id,p.slot,p.game_number,p.request_payload->>'expectedMatchDigest',h,p.prior_attempt_id)=p.request_payload->>'expectedHistoryDigest'
 and m->>'matchDigest'=p.request_payload->>'expectedMatchDigest'
 and app.native_mixed_playoff_game_v1(c.source_capture,m->'participants',h)->'reviewRequired'='true'::jsonb
 and p.record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-record-v1',p.id,p.context_id,p.tournament_id,p.event_id,p.slot,p.game_number,p.version,p.prior_attempt_id,p.actor_id,p.actor_session_id,p.operation_id,p.receipt_id,p.request_payload,p.policy_capture,p.authority_capture,p.prior_history,p.response_payload)))is distinct from true then return false;end if;
 expected_version:=p.version-1;cursor_id:=p.prior_attempt_id;
 end loop;
 return cardinality(seen)>0;end$$;

alter function app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)owner to postgres;
revoke all on function app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)from public,anon,authenticated,service_role;
-- CREATE OR REPLACE preserves the two existing OIDs, owners and ACLs.
commit;
