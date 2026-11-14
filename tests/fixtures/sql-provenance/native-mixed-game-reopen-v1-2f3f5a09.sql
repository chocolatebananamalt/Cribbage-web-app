-- PRIVATE SOURCE CANDIDATE / DEFAULT OFF. Native fictional mismatch reopen only.
-- Apply AFTER the closed native play + Finance package. No ordinary correction,
-- result, eligibility, qualification, MRP, payment or payout authority is added.
-- Policy 0 only: a reasoned nonself Director opens a fresh independent attempt.
-- Policy 1 is explicitly unavailable; this does not substitute for Rule 12.
begin;
create function app.native_mixed_game_reopen_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;

create function app.native_mixed_game_reopen_request_valid_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''set timezone='UTC'as $$begin
 return app.native_mixed_game_exact_v1(v,array['kind','action','startId','gameId','expectedStartSourceDigest','expectedRevision','expectedHistoryDigest','proposalId','reason'])is true
  and v->>'kind'='native-mixed-game-reopen-v1'and v->>'action'in('propose','approve','reject')
  and app.native_mixed_simulation_uuid_v1(v->>'startId')is true and app.native_mixed_simulation_uuid_v1(v->>'gameId')is true
  and jsonb_typeof(v->'expectedStartSourceDigest')='string'and v->>'expectedStartSourceDigest'~'^[a-f0-9]{64}$'
  and jsonb_typeof(v->'expectedHistoryDigest')='string'and v->>'expectedHistoryDigest'~'^[a-f0-9]{64}$'
  and jsonb_typeof(v->'expectedRevision')='number'and v->>'expectedRevision'~'^[0-4]$'
  and jsonb_typeof(v->'reason')='string'and v->>'reason'=btrim(v->>'reason',U&' \0009\000A\000B\000C\000D\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')and length(v->>'reason')between 1 and 500
  and(select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)from regexp_split_to_table(v->>'reason','')ch)<=500
  and v->>'reason'!~ U&'[\0001-\001F\007F]'
  and(case when v->>'action'='propose'then v->'proposalId'='null'::jsonb else app.native_mixed_simulation_uuid_v1(v->>'proposalId')is true end);
end$$;

create table app.native_mixed_game_reopens_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,start_id uuid not null,
 game_id uuid not null,version integer not null check(version>0),prior_attempt_id uuid,
 actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,
 operation_id uuid not null,receipt_id uuid not null unique references app.operation_receipts(id),
 request_payload jsonb not null,policy_capture jsonb not null,authority_capture jsonb not null,
 prior_revision integer not null check(prior_revision between 1 and 4),prior_history_digest text not null,
 response_payload jsonb not null,record_digest text not null,created_at timestamptz not null default clock_timestamp(),
 unique(start_id,game_id,version),unique(id,start_id,game_id),unique(actor_id,operation_id),
 foreign key(start_id)references app.native_mixed_simulation_starts_v1(id),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 foreign key(prior_attempt_id,start_id,game_id)references app.native_mixed_game_reopens_v1(id,start_id,game_id),
 check((version=1 and prior_attempt_id is null)or(version>1 and prior_attempt_id is not null)),
 check(app.native_mixed_game_reopen_request_valid_v1(request_payload)is true),
 check(request_payload->>'action'='propose'and request_payload->'proposalId'='null'::jsonb),
 check(request_payload->>'startId'=start_id::text and request_payload->>'gameId'=game_id::text),
 check(request_payload->'expectedRevision'=to_jsonb(prior_revision)and request_payload->>'expectedHistoryDigest'=prior_history_digest),
 check(record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-reopen-record-v1',id,tournament_id,event_id,start_id,game_id,version,prior_attempt_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,policy_capture,authority_capture,prior_revision,prior_history_digest,response_payload)))
);
-- LIKE copies row checks/defaults, deliberately not original per-game unique
-- indexes. A new attempt has its own 1..4 sequence and one capture artifact.
create table app.native_mixed_game_attempt_evidence_v1(
 attempt_id uuid not null,like app.native_mixed_game_evidence_v1 including defaults including constraints,
 primary key(id),unique(attempt_id,sequence),unique(actor_id,operation_id),unique(operation_receipt_id),
 foreign key(attempt_id,start_id,game_id)references app.native_mixed_game_reopens_v1(id,start_id,game_id),
 foreign key(operation_receipt_id)references app.operation_receipts(id),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 foreign key(actor_id)references app.profiles(id)
);
create table app.native_mixed_game_attempt_artifacts_v1(
 attempt_id uuid not null,like app.native_mixed_game_artifacts_v1 including defaults including constraints,
 primary key(id),unique(attempt_id),unique(operation_receipt_id),
 foreign key(attempt_id,start_id,game_id)references app.native_mixed_game_reopens_v1(id,start_id,game_id),
 foreign key(operation_receipt_id)references app.operation_receipts(id),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 foreign key(creator_id)references app.profiles(id)
);
do $security$declare n text;begin foreach n in array array['native_mixed_game_reopens_v1','native_mixed_game_attempt_evidence_v1','native_mixed_game_attempt_artifacts_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$security$;

create function app.native_mixed_game_all_evidence_v1()returns setof app.native_mixed_game_evidence_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select e.*from app.native_mixed_game_evidence_v1 e union all
 select id,tournament_id,event_id,start_id,game_id,sequence,actor_id,operation_id,operation_receipt_id,request_payload,entry,authority_capture,created_at from app.native_mixed_game_attempt_evidence_v1$$;
create function app.native_mixed_game_all_artifacts_v1()returns setof app.native_mixed_game_artifacts_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select a.*from app.native_mixed_game_artifacts_v1 a union all
 select id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256,created_at from app.native_mixed_game_attempt_artifacts_v1$$;
create function app.native_mixed_game_entry_attempt_v1(entry_id uuid)returns uuid
language sql stable security definer set search_path=''set timezone='UTC'as $$select attempt_id from app.native_mixed_game_attempt_evidence_v1 where id=entry_id$$;
create function app.native_mixed_game_attempt_history_v1(sid uuid,gid uuid,attempt uuid)returns setof app.native_mixed_game_evidence_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select e.*from app.native_mixed_game_all_evidence_v1()e where e.start_id=sid and e.game_id=gid
 and app.native_mixed_game_entry_attempt_v1(e.id)is not distinct from attempt$$;
create function app.native_mixed_game_attempt_digest_v1(sid uuid,gid uuid,digest text,h jsonb,attempt uuid)returns text
language sql immutable set search_path=''set timezone='UTC'as $$select app.native_mixed_simulation_hash_v1(case when attempt is null
 then jsonb_build_array('native-mixed-game-history-v1',sid,gid,digest,h)
 else jsonb_build_array('native-mixed-game-attempt-history-v1',sid,gid,digest,attempt,h)end)$$;

-- The operation receipt, policy and nonself authority snapshot bind the immutable
-- reopen, without pretending that historical roles or a JWT remain current.
create function app.native_mixed_game_reopen_bound_v1(proposal uuid)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare p app.native_mixed_game_reopens_v1%rowtype;r app.operation_receipts%rowtype;prior app.native_mixed_game_reopens_v1%rowtype;begin
 select*into p from app.native_mixed_game_reopens_v1 where id=proposal;if not found then return false;end if;
 select*into r from app.operation_receipts where id=p.receipt_id;
 if r.id is null or r.actor_profile_id<>p.actor_id or r.tournament_id<>p.tournament_id or r.client_operation_id<>p.operation_id
  or r.operation_type<>'native_mixed_game_reopen_v1'or r.outcome<>'accepted'or r.target_id<>p.id or r.response_payload<>p.response_payload
  or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-reopen-request-v1',p.actor_id,p.tournament_id,p.event_id,p.operation_id,p.request_payload))
  or p.record_digest<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-reopen-record-v1',p.id,p.tournament_id,p.event_id,p.start_id,p.game_id,p.version,p.prior_attempt_id,p.actor_id,p.actor_session_id,p.operation_id,p.receipt_id,p.request_payload,p.policy_capture,p.authority_capture,p.prior_revision,p.prior_history_digest,p.response_payload))
  or p.authority_capture->>'subjectId'is distinct from p.actor_id::text or p.authority_capture->>'sessionId'is distinct from p.actor_session_id::text
  or p.authority_capture->'directorChecked'is distinct from'true'::jsonb or p.authority_capture->'nonselfChecked'is distinct from'true'::jsonb
  or not exists(select 1 from app.paper_official_identity_bindings b where b.id=(p.authority_capture->>'paperIdentityBindingId')::uuid and b.tournament_id=p.tournament_id and b.official_profile_id=p.actor_id)
  or not exists(select 1 from app.correction_policy_versions c where c.tournament_id=p.tournament_id and to_jsonb(c)=p.policy_capture and c.required_approvals=0)
  or not exists(select 1 from app.audit_events a where a.operation_receipt_id=r.id and a.actor_profile_id=p.actor_id and a.tournament_id=p.tournament_id
   and a.entity_type='native_mixed_game_reopen'and a.entity_id=p.id and a.action='game_reopened'and a.after_state=p.response_payload)
 then return false;end if;
 if p.prior_attempt_id is not null then
  select*into prior from app.native_mixed_game_reopens_v1 where id=p.prior_attempt_id and start_id=p.start_id and game_id=p.game_id and version=p.version-1;
  if prior.id is null or app.native_mixed_game_reopen_bound_v1(prior.id)is distinct from true then return false;end if;
 end if;
 return true;end$$;
create function app.native_mixed_game_active_attempt_v1(sid uuid,gid uuid)returns uuid
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare p uuid;begin
 select id into p from app.native_mixed_game_reopens_v1 where start_id=sid and game_id=gid order by version desc limit 1;
 if p is not null and app.native_mixed_game_reopen_bound_v1(p)is distinct from true then raise exception'unbound native game reopen';end if;
 return p;end$$;
create function app.native_mixed_game_active_evidence_v1(sid uuid,gid uuid)returns setof app.native_mixed_game_evidence_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$select*from app.native_mixed_game_attempt_history_v1(sid,gid,app.native_mixed_game_active_attempt_v1(sid,gid))$$;

create function app.native_mixed_game_reopen_subject_v1(tid uuid,eid uuid,sid uuid,gid uuid,writing boolean)returns uuid
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;claims jsonb;begin
 actor:=app.native_mixed_game_own_subject_v1();claims:=auth.jwt();
 if actor is null or claims->>'sub'is distinct from actor::text or coalesce(claims->>'exp','')!~'^[0-9]{1,12}$'then return null;end if;
 if(claims->>'exp')::bigint<=extract(epoch from clock_timestamp())
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,writing)is distinct from true then return null;end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.event_participants,
  app.tournament_roster_entries,app.roster_account_links in share mode nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 perform 1 from app.native_mixed_simulation_starts_v1 s join app.canonical_games g on g.id=gid and g.tournament_id=tid and g.event_id=eid
 where s.id=sid and s.tournament_id=tid and s.event_id=eid and app.native_mixed_simulation_start_bound_v1(s.id)
 and exists(select 1 from jsonb_array_elements(s.source_capture->'canonicalGames')x where x->>'gameId'=gid::text)for share of s,g nowait;
 if not found or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true or app.paper_official_is_independent(actor,tid,gid)is distinct from true then return null;end if;
 return actor;end$$;

-- Caller holds the shared native event/game lock and source-table locks. Unknown
-- evidence does not become a mismatch. Later Paper evidence counts as later play.
create function app.native_mixed_game_reopen_block_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns text
language plpgsql security definer set search_path=''set timezone='UTC'as $$declare st app.native_mixed_simulation_starts_v1%rowtype;g app.canonical_games%rowtype;h jsonb;results jsonb;v record;round_value integer;begin
 select*into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;
 if st.id is null or g.id is null then return'source_changed';end if;
 for v in select id from app.native_mixed_game_active_evidence_v1(sid,gid)loop
  if app.native_mixed_game_entry_bound_with_start_v1(v.id,st)is distinct from true then return'operation_history_unavailable';end if;
 end loop;
 if app.native_mixed_game_complete_with_start_v1(tid,eid,st,gid)is true then return'game_already_complete';end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid);
 select coalesce(jsonb_agg(result),'[]')into results from(
  select x->'result'result from jsonb_array_elements(h)x where x->>'action'='digital-submit'
  union all select c->'result'from jsonb_array_elements(h)x,lateral jsonb_array_elements(x->'claims')c where x->>'action'='paper-capture')r;
 if jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>2 then return'game_not_mismatched';end if;
 select round_number into round_value from app.rounds where id=g.round_id and event_id=eid;
 if round_value is null then return'source_changed';end if;
 if exists(select 1 from app.canonical_games later join app.rounds rn on rn.id=later.round_id and rn.event_id=eid
  join app.native_mixed_game_all_evidence_v1()e on e.start_id=sid and e.game_id=later.id
  where later.tournament_id=tid and later.event_id=eid and rn.round_number>round_value
   and(g.side_a_participant_id in(later.side_a_participant_id,later.side_b_participant_id)or g.side_b_participant_id in(later.side_a_participant_id,later.side_b_participant_id)))then return'later_evidence_exists';end if;
 if exists(select 1 from app.qualification_result_versions where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='finalize-unpaid')
  or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='final')then return'downstream_closed';end if;
 return null;end$$;

create function app.get_native_mixed_game_reopen_workspace_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;root jsonb;state jsonb;policy app.correction_policy_versions%rowtype;p app.native_mixed_game_reopens_v1%rowtype;blocked text;people jsonb;game_value jsonb;display_entries jsonb;private_start_key uuid;begin
 if app.native_mixed_game_reopen_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_reopen_subject_v1(tid,eid,sid,gid,false);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,app.correction_policy_versions in share mode nowait;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 state:=app.get_native_mixed_simulation_game_state_v1(tid,eid,sid,gid);if state->>'kind'is distinct from'native-mixed-simulation-game-state-v1'then return null;end if;
 -- Exactly the two verified Start participants. Fixed IDs come from immutable
 -- original assignments, never current table seats or membership numbers.
 select x into game_value from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=gid::text;
 select jsonb_agg(jsonb_build_object('displayName',r.claimed_display_name,'fixedTournamentId',f->>'fixedId','mode',r.scorecard_type)order by sides.side)into people
 from(values('a',(game_value->>'sideAParticipantId')::uuid),('b',(game_value->>'sideBParticipantId')::uuid))sides(side,pid)
 join app.event_participants ep on ep.id=sides.pid and ep.tournament_id=tid and ep.event_id=eid
 join app.tournament_roster_entries r on r.id=ep.roster_entry_id and r.tournament_id=tid
 join jsonb_array_elements(root#>'{source,fixedAssignments}')f on f->>'participantId'=ep.id::text and f->>'rosterEntryId'=r.id::text;
 if jsonb_array_length(people)is distinct from 2 or(game_value->>'round')::integer not between 1 and 12
  or exists(select 1 from jsonb_array_elements(people)x where coalesce(btrim(x->>'displayName'),'')=''or x->>'fixedTournamentId'!~'^A-([1-9]|1[0-8])$'or x->>'mode'not in('digital','paper'))then return null;end if;
 select*into policy from app.correction_policy_versions where tournament_id=tid order by version desc limit 1;
 if policy.tournament_id is null then return jsonb_build_object('status','blocked','code','policy_unavailable');end if;
 blocked:=case when policy.required_approvals<>0 then'approval_workflow_unavailable'else app.native_mixed_game_reopen_block_v1(tid,eid,sid,gid)end;
 -- The generic own-state reader correctly keeps nonplaying DD viewers blind.
 -- Only this authenticated, independently bound Director mismatch review may
 -- inspect both active claims. Reuse its exact per-game actor pseudonyms.
 if blocked is null and state->>'evidenceVisibility'='metadata-only'then
  select operation_receipt_id into private_start_key from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
  if private_start_key is null then return null;end if;
  select coalesce(jsonb_agg(case when e.entry->>'actorId'=actor::text then e.entry else
   jsonb_set(e.entry,'{actorId}',to_jsonb(substr(encode(extensions.hmac(sid::text||':'||gid::text||':'||(e.entry->>'actorId'),private_start_key::text,'sha256'),'hex'),1,32)::uuid))end order by e.sequence),'[]')into display_entries
  from app.native_mixed_game_active_evidence_v1(sid,gid)e;
  if jsonb_array_length(display_entries)is distinct from(state->>'revision')::integer then return null;end if;
  state:=state||jsonb_build_object('evidenceVisibility','evidence','entries',display_entries);
 end if;
 select*into p from app.native_mixed_game_reopens_v1 where id=app.native_mixed_game_active_attempt_v1(sid,gid);
 return jsonb_build_object('kind','native-mixed-game-reopen-workspace-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
  'startSourceDigest',root->>'startSourceDigest','revision',state->'revision','historyDigest',state->>'historyDigest',
  'gameNumber',(game_value->>'round')::integer,'sideA',people->0,'sideB',people->1,
  'policy',jsonb_build_object('version',policy.version,'reasonRequired',policy.reason_required,'requiredApprovals',policy.required_approvals),
  'latestProposal',case when p.id is null then null else jsonb_build_object('id',p.id,'status','reopened','reason',p.request_payload->>'reason','recordedAt',p.created_at,'policyVersion',(p.policy_capture->>'version')::integer)end,
  'canPropose',blocked is null,'canReview',false,'blockedCode',blocked,'state',state,'simulationOnly',true,
  'ordinaryScoreWritten',false,'officialResultVerified',false,'qualificationAuthorized',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_game_reopen_receipt_bound_v1(r app.operation_receipts,actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare v jsonb:=(r).response_payload;begin
 if(r).id is null or(r).actor_profile_id<>actor or(r).tournament_id<>tid or(r).client_operation_id<>op or(r).operation_type<>'native_mixed_game_reopen_v1'
  or(r).request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-reopen-request-v1',actor,tid,eid,op,request))
  or v is distinct from jsonb_build_object('kind','native-mixed-game-reopen-receipt-v1','status',v->>'status','code',v->>'code','actorId',actor,'tournamentId',tid,'eventId',eid,
   'startId',request->>'startId','gameId',request->>'gameId','operationId',op,'request',request,'proposalId',v->'proposalId','priorRevision',request->'expectedRevision','priorHistoryDigest',request->>'expectedHistoryDigest',
   'revision',v->'revision','historyDigest',v->'historyDigest','simulationOnly',true,'ordinaryScoreWritten',false,'officialResultVerified',false,'qualificationAuthorized',false,'moneyMoved',false,'historicalReceipt',false,'currentSourceVerified',v->'currentSourceVerified')
  or not exists(select 1 from app.audit_events a where a.operation_receipt_id=(r).id and a.actor_profile_id=actor and a.tournament_id=tid and a.entity_type='native_mixed_game_reopen'
   and a.entity_id=(r).target_id and a.action=v->>'code'and a.after_state=v)then return false;end if;
 if v->>'status'='reopened'then
  return(r).outcome='accepted'and v->>'code'='game_reopened'and v->'currentSourceVerified'='true'::jsonb and v->'revision'='0'::jsonb
   and v->>'proposalId'=(r).target_id::text and app.native_mixed_game_reopen_bound_v1((r).target_id)is true;
 end if;
 return(r).outcome='rejected'and v->>'status'='rejected'and(r).target_id=(request->>'gameId')::uuid and v->'proposalId'='null'::jsonb and v->'revision'='null'::jsonb and v->'historyDigest'='null'::jsonb
  and v->'currentSourceVerified'='false'::jsonb and v->>'code'in('source_changed','history_changed','game_not_mismatched','game_already_complete','later_evidence_exists','downstream_closed','approval_workflow_unavailable','policy_unavailable','source_unavailable');
end$$;
create function app.get_native_mixed_game_reopen_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;r app.operation_receipts%rowtype;begin
 if app.native_mixed_game_reopen_enabled_v1()is distinct from true then return null;end if;
 if app.native_mixed_game_reopen_request_valid_v1(request)is distinct from true or op is null then return null;end if;
 actor:=app.native_mixed_game_reopen_subject_v1(tid,eid,(request->>'startId')::uuid,(request->>'gameId')::uuid,false);if actor is null then return null;end if;
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if not found then return jsonb_build_object('status','not_found','writeAuthorized',false,'currentSourceVerified',false);end if;
 if app.native_mixed_game_reopen_receipt_bound_v1(r,actor,tid,eid,op,request)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 return r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.record_native_mixed_game_reopen_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;sid uuid;gid uuid;root jsonb;h jsonb;hd text;policy app.correction_policy_versions%rowtype;old app.operation_receipts%rowtype;p app.native_mixed_game_reopens_v1%rowtype;
 prior uuid;version_value integer;code_value text;id_value uuid:=extensions.gen_random_uuid();rid uuid:=extensions.gen_random_uuid();v jsonb;authority jsonb;digest_value text;
begin
 if app.native_mixed_game_reopen_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'or op is null or app.native_mixed_game_reopen_request_valid_v1(request)is distinct from true then return null;end if;
 sid:=(request->>'startId')::uuid;gid:=(request->>'gameId')::uuid;
 actor:=app.native_mixed_game_reopen_subject_v1(tid,eid,sid,gid,true);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-game:'||sid::text||':'||gid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if app.native_mixed_game_reopen_receipt_bound_v1(old,actor,tid,eid,op,request)is distinct from true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)then return jsonb_build_object('status','blocked','code','operation_conflict');end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,app.paper_official_identity_bindings,app.correction_policy_versions,
 app.qualification_result_versions,app.native_mixed_playoff_contexts_v1,app.native_mixed_main_finance_records_v1,app.native_mixed_pool_records_v1 in share row exclusive mode nowait;
 select*into policy from app.correction_policy_versions where tournament_id=tid order by version desc limit 1;
 if request->>'action'<>'propose'then return jsonb_build_object('status','blocked','code','approval_workflow_unavailable');end if;
 code_value:=case when policy.tournament_id is null then'policy_unavailable'when policy.required_approvals<>0 then'approval_workflow_unavailable'else null end;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null then code_value:=coalesce(code_value,'source_unavailable');end if;
 if app.native_mixed_game_reopen_subject_v1(tid,eid,sid,gid,true)is distinct from actor then return null;end if;
 if code_value is null and root->>'startSourceDigest'is distinct from request->>'expectedStartSourceDigest'then code_value:='source_changed';end if;
 prior:=app.native_mixed_game_active_attempt_v1(sid,gid);
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid);
 hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,coalesce(root->>'startSourceDigest',request->>'expectedStartSourceDigest'),h,prior);
 if code_value is null and(jsonb_array_length(h)<>(request->>'expectedRevision')::integer or hd<>request->>'expectedHistoryDigest')then code_value:='history_changed';end if;
 if code_value is null then code_value:=app.native_mixed_game_reopen_block_v1(tid,eid,sid,gid);end if;
 if code_value='operation_history_unavailable'then return jsonb_build_object('status','blocked','code',code_value);end if;
 v:=jsonb_build_object('kind','native-mixed-game-reopen-receipt-v1','status',case when code_value is null then'reopened'else'rejected'end,'code',coalesce(code_value,'game_reopened'),
  'actorId',actor,'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,'operationId',op,'request',request,'proposalId',case when code_value is null then id_value else null end,
  'priorRevision',request->'expectedRevision','priorHistoryDigest',request->>'expectedHistoryDigest','revision',case when code_value is null then 0 else null end,
  'historyDigest',case when code_value is null then app.native_mixed_game_attempt_digest_v1(sid,gid,root->>'startSourceDigest','[]',id_value)else null end,
  'simulationOnly',true,'ordinaryScoreWritten',false,'officialResultVerified',false,'qualificationAuthorized',false,'moneyMoved',false,'historicalReceipt',false,'currentSourceVerified',code_value is null);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(rid,tid,actor,'native_mixed_game_reopen_v1',case when code_value is null then id_value else gid end,
 app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-reopen-request-v1',actor,tid,eid,op,request)),op,case when code_value is null then'accepted'else'rejected'end,v,clock_timestamp());
 if code_value is null then
  select coalesce(max(version),0)+1 into version_value from app.native_mixed_game_reopens_v1 where start_id=sid and game_id=gid;
  authority:=jsonb_build_object('subjectId',actor,'sessionId',auth.jwt()->>'session_id','directorChecked',true,'nonselfChecked',true,'paperIdentityBindingId',
   (select id from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1));
  digest_value:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-reopen-record-v1',id_value,tid,eid,sid,gid,version_value,prior,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,to_jsonb(policy),authority,jsonb_array_length(h),hd,v));
  insert into app.native_mixed_game_reopens_v1(id,tournament_id,event_id,start_id,game_id,version,prior_attempt_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,policy_capture,authority_capture,prior_revision,prior_history_digest,response_payload,record_digest)
  values(id_value,tid,eid,sid,gid,version_value,prior,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,to_jsonb(policy),authority,jsonb_array_length(h),hd,v,digest_value);
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,rid,'native_mixed_game_reopen',case when code_value is null then id_value else gid end,coalesce(code_value,'game_reopened'),v);
 select*into old from app.operation_receipts where id=rid;
 if app.native_mixed_game_reopen_receipt_bound_v1(old,actor,tid,eid,op,request)is distinct from true then raise exception'native reopen postcondition failed';end if;
 return v;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function public.get_native_mixed_game_reopen_workspace_v1(p_tournament_id uuid,p_event_id uuid,p_start_id uuid,p_game_id uuid)returns jsonb
language sql security definer set search_path=''set timezone='UTC'as $$select app.get_native_mixed_game_reopen_workspace_v1(p_tournament_id,p_event_id,p_start_id,p_game_id)$$;
create function public.record_native_mixed_game_reopen_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql security definer set search_path=''set timezone='UTC'as $$select app.record_native_mixed_game_reopen_v1(p_tournament_id,p_event_id,p_operation_id,p_request)$$;
create function public.get_native_mixed_game_reopen_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql security definer set search_path=''set timezone='UTC'as $$select app.get_native_mixed_game_reopen_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request)$$;

-- BEGIN DERIVED FUNCTIONS: generated by tests/helpers/build-native-mixed-game-reopen-v1.mjs.
create or replace function app.native_mixed_game_entry_bound_with_start_v1(entry_value uuid,s app.native_mixed_simulation_starts_v1)returns boolean
language plpgsql stable security definer set search_path=''as $$declare e app.native_mixed_game_evidence_v1%rowtype;
 r app.operation_receipts%rowtype;a app.native_mixed_game_artifacts_v1%rowtype;capture_entry app.native_mixed_game_evidence_v1%rowtype;h jsonb;hd text;begin
 select*into e from app.native_mixed_game_all_evidence_v1() where id=entry_value;if not found then return false;end if;
 if app.native_mixed_game_entry_attempt_v1(e.id)is not null and app.native_mixed_game_reopen_bound_v1(app.native_mixed_game_entry_attempt_v1(e.id))is distinct from true then return false;end if;
 select*into r from app.operation_receipts where id=e.operation_receipt_id;
 if s.id is null or s.tournament_id<>e.tournament_id or s.event_id<>e.event_id or s.id<>e.start_id or not exists(select 1 from app.native_mixed_simulation_starts_v1 stored where stored.id=s.id and stored=s)
  or app.native_mixed_game_request_valid_v1(e.request_payload)is distinct from true
  or r.id is null or r.actor_profile_id<>e.actor_id or r.client_operation_id<>e.operation_id or r.tournament_id<>e.tournament_id
  or r.operation_type<>'native_mixed_simulation_game_evidence_v1'or r.target_id<>e.id or r.outcome<>'accepted'
  or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',e.actor_id,e.tournament_id,e.event_id,e.request_payload))
  or e.entry->>'id'is distinct from e.id::text or e.entry->>'actorId'is distinct from e.actor_id::text or e.entry->>'receiptId'is distinct from e.operation_receipt_id::text
  or e.entry->>'tournamentId'is distinct from e.tournament_id::text or e.entry->>'eventId'is distinct from e.event_id::text
  or e.request_payload->>'expectedStartSourceDigest'is distinct from s.source_digest
  or e.request_payload->'expectedRevision'is distinct from to_jsonb(e.sequence-1)
  or e.entry->>'payloadDigest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',e.entry-'payloadDigest',e.authority_capture))
  or e.entry->>'startSourceDigest'is distinct from s.source_digest or e.entry->>'gameId'is distinct from e.game_id::text or e.entry->>'startId'is distinct from e.start_id::text
  or e.entry->>'operationId'is distinct from e.operation_id::text or e.entry->'sequence'is distinct from to_jsonb(e.sequence)
  or e.entry->>'action'is distinct from e.request_payload->>'action'
  or(e.entry-'payloadDigest'-array['id','operationId','receiptId','sequence','actorId','tournamentId','eventId','startId','gameId','startSourceDigest','action'])
    is distinct from(e.request_payload->'payload'||case when e.entry->>'action'='paper-capture'then jsonb_build_object('artifactDigest',e.entry->>'artifactDigest')else'{}'::jsonb end)
  or e.authority_capture->>'subjectId'is distinct from e.actor_id::text or app.native_mixed_simulation_uuid_v1(e.authority_capture->>'sessionId')is distinct from true
 then return false;end if;
 if e.entry->>'action'in('paper-capture','paper-review')then
  if app.native_mixed_game_exact_v1(e.authority_capture,array['subjectId','sessionId','roles','paperIdentityChecked','nonselfChecked','paperIdentityBindingId'])is distinct from true
   or e.authority_capture->'paperIdentityChecked'is distinct from'true'::jsonb or e.authority_capture->'nonselfChecked'is distinct from'true'::jsonb
   or app.native_mixed_simulation_uuid_v1(e.authority_capture->>'paperIdentityBindingId')is distinct from true
   or not exists(select 1 from app.paper_official_identity_bindings b where b.id=(e.authority_capture->>'paperIdentityBindingId')::uuid and b.tournament_id=e.tournament_id and b.official_profile_id=e.actor_id)
   or(e.entry->>'action'='paper-capture'and not(e.authority_capture->'roles'?'cross_checker'))
   or(e.entry->>'action'='paper-review'and not(e.authority_capture->'roles'?|array['director','co_director','cross_checker']))then return false;end if;
 else
  if app.native_mixed_game_exact_v1(e.authority_capture,array['subjectId','sessionId','roles'])is distinct from true
   or not exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 c,
    lateral jsonb_array_elements(c.source_capture#>'{attendance,digitalConsents}')d
    where c.id=s.publication_context_id and d->>'profileId'=e.actor_id::text and d->>'participantId'=e.entry->>'participantId')then return false;end if;
 end if;
 if e.entry->>'action'='paper-capture'then
  select*into a from app.native_mixed_game_all_artifacts_v1() where id=(e.entry->>'artifactId')::uuid and start_id=e.start_id and game_id=e.game_id;
  if a.id is null or a.creator_id<>e.actor_id or a.operation_receipt_id<>r.id or a.sha256<>e.entry->>'artifactDigest'
   or a.body is distinct from jsonb_build_object('kind','native-mixed-fictional-paper-v1','tournamentId',e.tournament_id,'eventId',e.event_id,
    'startId',e.start_id,'gameId',e.game_id,'claims',e.entry->'claims','physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false)then return false;end if;
 end if;
 if e.entry->>'action'='paper-review'then
  select*into capture_entry from app.native_mixed_game_all_evidence_v1() where id=(e.entry->>'captureId')::uuid and start_id=e.start_id and game_id=e.game_id and sequence<e.sequence and app.native_mixed_game_entry_attempt_v1(id)is not distinct from app.native_mixed_game_entry_attempt_v1(e.id);
  if capture_entry.id is null or capture_entry.entry->>'action'is distinct from'paper-capture'or capture_entry.actor_id=e.actor_id
   or e.entry->>'artifactId'is distinct from capture_entry.entry->>'artifactId'or e.entry->>'artifactDigest'is distinct from capture_entry.entry->>'artifactDigest'
   or(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(e.entry->'reenteredClaims')x)
    is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture_entry.entry->'claims')x)then return false;end if;
 end if;
 select coalesce(jsonb_agg(x.entry order by x.sequence),'[]')into h from app.native_mixed_game_all_evidence_v1() x where x.start_id=e.start_id and x.game_id=e.game_id and x.sequence<e.sequence and app.native_mixed_game_entry_attempt_v1(x.id)is not distinct from app.native_mixed_game_entry_attempt_v1(e.id);
 if jsonb_array_length(h)<>e.sequence-1 or e.request_payload->>'expectedHistoryDigest'is distinct from app.native_mixed_game_attempt_digest_v1(e.start_id,e.game_id,s.source_digest,h,app.native_mixed_game_entry_attempt_v1(e.id))then return false;end if;
 h:=h||jsonb_build_array(e.entry);
 if jsonb_array_length(h)<>e.sequence then return false;end if;
 hd:=app.native_mixed_game_attempt_digest_v1(e.start_id,e.game_id,s.source_digest,h,app.native_mixed_game_entry_attempt_v1(e.id));
 return r.response_payload=app.native_mixed_game_receipt_v1(e,hd)and exists(select 1 from app.audit_events v
 where v.tournament_id=e.tournament_id and v.actor_profile_id=e.actor_id and v.operation_receipt_id=r.id
  and v.entity_type='native_mixed_simulation_game_evidence'and v.entity_id=e.id and v.action='simulation_game_evidence_recorded'and v.after_state=r.response_payload);end$$;

create or replace function app.native_mixed_game_entry_bound_v1(entry_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$declare st app.native_mixed_simulation_starts_v1%rowtype;begin
 select x.*into st from app.native_mixed_simulation_starts_v1 x join app.native_mixed_game_all_evidence_v1() e on e.start_id=x.id where e.id=entry_value;
 if st.id is null or app.native_mixed_simulation_start_bound_v1(st.id)is distinct from true then return false;end if;
 return app.native_mixed_game_entry_bound_with_start_v1(entry_value,st);end$$;

create or replace function app.native_mixed_game_complete_with_start_v1(tid uuid,eid uuid,s app.native_mixed_simulation_starts_v1,gid uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare sid uuid:=s.id;g app.canonical_games%rowtype;h jsonb;subs jsonb;confirms jsonb;capture_value jsonb;review_value jsonb;refs jsonb;results jsonb;digital_ids uuid[];digital_profiles uuid[];paper_sides text[];people_count integer;row_value record;
begin
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;if not found then return false;end if;
 if not exists(select 1 from app.native_mixed_simulation_starts_v1 st where st.id=sid and st.tournament_id=tid and st.event_id=eid and st=s
  and exists(select 1 from jsonb_array_elements(st.source_capture->'canonicalGames')x where x->>'gameId'=gid::text))then return false;end if;
 select count(*),array_agg(p.id)filter(where r.scorecard_type='digital'),array_agg(p.profile_id)filter(where r.scorecard_type='digital'),
 array_agg(case when p.id=g.side_a_participant_id then'a'else'b'end order by case when p.id=g.side_a_participant_id then'a'else'b'end)filter(where r.scorecard_type='paper')
 into people_count,digital_ids,digital_profiles,paper_sides from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 where p.event_id=eid and p.id in(g.side_a_participant_id,g.side_b_participant_id);
 if people_count<>2 or coalesce(cardinality(digital_ids),0)+coalesce(cardinality(paper_sides),0)<>2 then return false;end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid) where tournament_id=tid and event_id=eid and start_id=sid and game_id=gid;
 if jsonb_array_length(h)<>(case when coalesce(cardinality(digital_ids),0)=0 then 2 else 4 end)then return false;end if;
 for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where tournament_id=tid and event_id=eid and start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,s)is distinct from true then return false;end if;
 end loop;
 select coalesce(jsonb_agg(x),'[]')into subs from jsonb_array_elements(h)x where x->>'action'='digital-submit';
 select coalesce(jsonb_agg(x),'[]')into confirms from jsonb_array_elements(h)x where x->>'action'='digital-confirm';
 if jsonb_array_length(subs)<>coalesce(cardinality(digital_ids),0)or jsonb_array_length(confirms)<>coalesce(cardinality(digital_ids),0)
  or(select count(distinct x->>'participantId')from jsonb_array_elements(subs)x)<>coalesce(cardinality(digital_ids),0)
  or(select count(distinct x->>'participantId')from jsonb_array_elements(confirms)x)<>coalesce(cardinality(digital_ids),0)
  or exists(select 1 from jsonb_array_elements(subs||confirms)x where not exists(select 1 from app.event_participants p where p.event_id=eid and p.id=any(digital_ids)and p.id::text=x->>'participantId'and p.profile_id::text=x->>'actorId'))then return false;end if;
 if(select count(*)from jsonb_array_elements(h)x where x->>'action'='paper-capture')<>(case when coalesce(cardinality(paper_sides),0)>0 then 1 else 0 end)
  or(select count(*)from jsonb_array_elements(h)x where x->>'action'='paper-review')<>(case when coalesce(cardinality(paper_sides),0)>0 then 1 else 0 end) then return false;end if;
 select x into capture_value from jsonb_array_elements(h)x where x->>'action'='paper-capture';select x into review_value from jsonb_array_elements(h)x where x->>'action'='paper-review';
 if capture_value is not null then
  if capture_value->>'actorId'=review_value->>'actorId'or (capture_value->>'actorId')::uuid=any(digital_profiles)or(review_value->>'actorId')::uuid=any(digital_profiles)
   or(select jsonb_agg(x->>'side'order by x->>'side')from jsonb_array_elements(capture_value->'claims')x)is distinct from to_jsonb(paper_sides)
   or review_value->>'captureId'is distinct from capture_value->>'id'then return false;end if;
 end if;
 select coalesce(jsonb_agg(result_value),'[]')into results from(select x->'result'result_value from jsonb_array_elements(subs)x union all select x->'result'from jsonb_array_elements(coalesce(capture_value->'claims','[]'))x)y;
 if jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>1 then return false;end if;
 select jsonb_agg(to_jsonb(x->>'id')order by x->>'id')into refs from jsonb_array_elements(h)x where x->>'action'<>'digital-confirm';
 if exists(select 1 from jsonb_array_elements(confirms)c where c->'result'is distinct from results->0
  or(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(c->'references')x)is distinct from refs
  or exists(select 1 from jsonb_array_elements(h)x where x->>'action'<>'digital-confirm'and(x->>'sequence')::integer>=(c->>'sequence')::integer))then return false;end if;
 return true;
end$$;

create or replace function app.native_mixed_game_closed_receipt_v1(r app.operation_receipts,actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare v jsonb:=(r).response_payload;begin
 if (r).operation_type<>'native_mixed_game_closed_v1'or(r).actor_profile_id<>actor or(r).tournament_id<>tid
  or(r).client_operation_id<>(request->>'operationId')::uuid or(r).target_id<>(request->>'gameId')::uuid or(r).outcome<>'accepted'
  or(r).request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request))
  or v is distinct from jsonb_build_object('kind','native-mixed-game-closed-v1','status','closed','code','terminal_operation_closed',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',request->>'operationId','request',request,'closureId',(r).id,
   'reason',v->>'reason','simulationOnly',true,'noWriteCommitted',true,'ordinaryScoreWritten',false,'normalStartAuthorized',false,
   'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false)
  or coalesce(v->>'reason','')not in('source_changed','history_changed')
  or exists(select 1 from app.native_mixed_game_all_evidence_v1() where actor_id=actor and operation_id=(request->>'operationId')::uuid)
  or not exists(select 1 from app.audit_events where actor_profile_id=actor and tournament_id=tid and operation_receipt_id=(r).id
   and entity_type='native_mixed_game_closed'and entity_id=(r).id and action='terminal_request_closed'and after_state=v)
 then return null;end if;return v;end$$;

create or replace function app.append_native_mixed_simulation_game_evidence_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare verified_start app.native_mixed_simulation_starts_v1%rowtype;actor uuid;op uuid;sid uuid;gid uuid;g app.canonical_games%rowtype;root jsonb;start_digest text;
 old app.operation_receipts%rowtype;e app.native_mixed_game_evidence_v1%rowtype;row_value record;history jsonb;revision_value integer;hd text;
 payload jsonb;action_value text;digital uuid[];paper_sides text[];actor_own uuid;capture jsonb;review jsonb;submissions jsonb;results jsonb;refs jsonb;
 idv uuid:=extensions.gen_random_uuid();receipt_id uuid:=extensions.gen_random_uuid();request_hash text;body jsonb;entry_value jsonb;authority jsonb;artifact jsonb;artifact_digest text;response jsonb;roles jsonb;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if app.native_mixed_game_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request->>'operationId')::uuid;sid:=(request->>'startId')::uuid;gid:=(request->>'gameId')::uuid;payload:=request->'payload';action_value:=request->>'action';
 request_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request));
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-game:'||sid::text||':'||gid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if old.operation_type='native_mixed_game_closed_v1'then
   response:=app.native_mixed_game_closed_receipt_v1(old,actor,tid,eid,request);
   return coalesce(response,jsonb_build_object('status','rejected','code','idempotency_conflict'));end if;
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_simulation_game_evidence_v1'or old.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select*into e from app.native_mixed_game_all_evidence_v1() where operation_receipt_id=old.id and tournament_id=tid and event_id=eid and actor_id=actor;
  if e.id is null or app.native_mixed_game_entry_bound_v1(e.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null or root->>'startSourceDigest'is distinct from request->>'expectedStartSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into verified_start from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 start_digest:=root->>'startSourceDigest';
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid for share nowait;
 if not found or not exists(select 1 from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=gid::text)then return jsonb_build_object('status','rejected','code','game_not_in_scope');end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,app.paper_official_identity_bindings in share row exclusive mode nowait;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)
 then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,verified_start)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;end loop;
 select coalesce(jsonb_agg(x.entry order by x.sequence),'[]'),count(*)into history,revision_value from app.native_mixed_game_active_evidence_v1(sid,gid) x where start_id=sid and game_id=gid;
 hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,start_digest,history,app.native_mixed_game_active_attempt_v1(sid,gid));
 if revision_value<>(request->>'expectedRevision')::integer or hd<>request->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
 if revision_value>=4 then return jsonb_build_object('status','rejected','code','evidence_complete_or_review_required');end if;
 select array_agg(p.id order by p.id)filter(where r.scorecard_type='digital'),array_agg(case when p.id=g.side_a_participant_id then'a'else'b'end order by p.id)filter(where r.scorecard_type='paper')
 into digital,paper_sides from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 where p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.event_id=eid;
 select p.id into actor_own from app.event_participants p join app.roster_account_links l on l.tournament_id=p.tournament_id and l.roster_entry_id=p.roster_entry_id and l.profile_id=p.profile_id
 where p.id=any(digital)and p.profile_id=actor and p.event_id=eid;
 select value into capture from jsonb_array_elements(history)x where x->>'action'='paper-capture';
 select value into review from jsonb_array_elements(history)x where x->>'action'='paper-review';
 select coalesce(jsonb_agg(x),'[]')into submissions from jsonb_array_elements(history)x where x->>'action'='digital-submit';
 select coalesce(jsonb_agg(v),'[]')into results from(
  select x->'result'v from jsonb_array_elements(submissions)x
  union all select x->'result'from jsonb_array_elements(coalesce(capture->'claims','[]'))x)y;
 if(select count(distinct v)from jsonb_array_elements(results)v)>1 then return jsonb_build_object('status','rejected','code','mismatch_requires_review');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor for share nowait;
 select coalesce(jsonb_agg(role order by role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 authority:=jsonb_build_object('subjectId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles);
 if action_value in('digital-submit','digital-confirm')then
  if actor_own is null or actor_own::text<>payload->>'participantId'then return jsonb_build_object('status','rejected','code','own_digital_side_required');end if;
  if app.native_mixed_game_play_order_with_start_v1(tid,eid,verified_start,gid,actor_own)is distinct from'current'then return jsonb_build_object('status','rejected','code','prior_game_incomplete');end if;
  if action_value='digital-submit'then
   if exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=actor_own::text)
    or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm')then return jsonb_build_object('status','rejected','code','evidence_complete_or_review_required');end if;
  else
   if jsonb_array_length(submissions)<>cardinality(digital)or(coalesce(cardinality(paper_sides),0)>0 and review is null)
    or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm'and x->>'participantId'=actor_own::text)
    or jsonb_array_length(results)=0 or payload->'result'is distinct from results->0
   then return jsonb_build_object('status','rejected','code','exact_confirmation_required');end if;
   select jsonb_agg(to_jsonb(x->>'id')order by x->>'id')into refs from jsonb_array_elements(history)x where x->>'action'in('digital-submit','paper-capture','paper-review');
   if refs is distinct from(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(payload->'references')x)then return jsonb_build_object('status','rejected','code','exact_confirmation_required');end if;
  end if;
 else
  if coalesce(cardinality(paper_sides),0)=0 or actor_own is not null
   or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true or app.paper_official_is_independent(actor,tid,gid)is distinct from true
  then return jsonb_build_object('status','rejected','code','independent_official_required');end if;
  authority:=authority||jsonb_build_object('paperIdentityChecked',true,'nonselfChecked',true,'paperIdentityBindingId',
   (select id from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1));
  if action_value='paper-capture'then
   if not(roles?'cross_checker')or capture is not null or jsonb_array_length(payload->'claims')<>cardinality(paper_sides)
    or exists(select 1 from jsonb_array_elements(payload->'claims')x where not(x->>'side'=any(paper_sides)))
   then return jsonb_build_object('status','rejected','code','paper_capture_required');end if;
   artifact:=jsonb_build_object('kind','native-mixed-fictional-paper-v1','tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
    'claims',payload->'claims','physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false);
   if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-artifact:'||(payload->>'artifactId'),0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
   if exists(select 1 from app.native_mixed_game_all_artifacts_v1()where id=(payload->>'artifactId')::uuid)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
   artifact_digest:=app.native_mixed_simulation_hash_v1(artifact);payload:=payload||jsonb_build_object('artifactDigest',artifact_digest);
  else
   if not(roles?|array['director','co_director','cross_checker'])or capture is null or review is not null
    or capture->>'actorId'=actor::text or payload->>'captureId'<>capture->>'id'
    or payload->>'artifactId'<>capture->>'artifactId'or payload->>'artifactDigest'<>capture->>'artifactDigest'
    or(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(payload->'reenteredClaims')x)
     is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture->'claims')x)
   then return jsonb_build_object('status','rejected','code','independent_paper_review_required');end if;
  end if;
 end if;
 body:=jsonb_build_object('id',idv,'operationId',op,'receiptId',receipt_id,'sequence',revision_value+1,'actorId',actor,
 'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,'startSourceDigest',start_digest,'action',action_value)||payload;
 entry_value:=body||jsonb_build_object('payloadDigest',app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',body,authority)));
 select idv,tid,eid,sid,gid,revision_value+1,actor,op,receipt_id,request,entry_value,authority,clock_timestamp()into e;
 history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,start_digest,history,app.native_mixed_game_active_attempt_v1(sid,gid));
 response:=app.native_mixed_game_receipt_v1(e,hd);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt_id,tid,actor,'native_mixed_simulation_game_evidence_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
 if action_value='paper-capture'then
  if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-artifact:'||(payload->>'artifactId'),0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
  if exists(select 1 from app.native_mixed_game_all_artifacts_v1()where id=(payload->>'artifactId')::uuid)then raise exception 'Artifact identity collision';end if;
  if app.native_mixed_game_active_attempt_v1(sid,gid)is not null then
   insert into app.native_mixed_game_attempt_artifacts_v1(attempt_id,id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256)
   values(app.native_mixed_game_active_attempt_v1(sid,gid),(payload->>'artifactId')::uuid,tid,eid,sid,gid,actor,receipt_id,artifact,artifact_digest);
  else
  insert into app.native_mixed_game_artifacts_v1(id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256)
  values((payload->>'artifactId')::uuid,tid,eid,sid,gid,actor,receipt_id,artifact,artifact_digest);end if;end if;
 if app.native_mixed_game_active_attempt_v1(sid,gid)is null then
  insert into app.native_mixed_game_evidence_v1 select(e).*;
 else insert into app.native_mixed_game_attempt_evidence_v1 select app.native_mixed_game_active_attempt_v1(sid,gid),(e).*;end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt_id,'native_mixed_simulation_game_evidence',idv,'simulation_game_evidence_recorded',response);
 if app.native_mixed_game_entry_bound_with_start_v1(idv,verified_start)is distinct from true then raise exception'simulation evidence postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.get_native_mixed_simulation_game_operation_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare actor uuid;e app.native_mixed_game_evidence_v1%rowtype;r app.operation_receipts%rowtype;active_id uuid;active_version integer;old_version integer;state_value jsonb;begin
 if app.native_mixed_game_recovery_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','recovery_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or app.native_mixed_game_request_valid_v1(request)is distinct from true then return null;end if;
 select*into r from app.operation_receipts where tournament_id=tid and actor_profile_id=actor and client_operation_id=(request->>'operationId')::uuid;
 if not found then return null;end if;
 if r.operation_type='native_mixed_game_closed_v1'then return app.native_mixed_game_closed_receipt_v1(r,actor,tid,eid,request);end if;
 select*into e from app.native_mixed_game_all_evidence_v1() where operation_receipt_id=r.id and actor_id=actor and tournament_id=tid and event_id=eid and request_payload=request;
 if not found or app.native_mixed_game_entry_bound_v1(e.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 active_id:=app.native_mixed_game_active_attempt_v1(e.start_id,e.game_id);
 if active_id is not null and active_id is distinct from app.native_mixed_game_entry_attempt_v1(e.id)
  and auth.jwt()->>'sub'=actor::text
  and(case when coalesce(auth.jwt()->>'exp','')~'^[0-9]{1,12}$'then(auth.jwt()->>'exp')::bigint>extract(epoch from clock_timestamp())else false end)then
  select version into active_version from app.native_mixed_game_reopens_v1 where id=active_id;
  select coalesce((select version from app.native_mixed_game_reopens_v1 where id=app.native_mixed_game_entry_attempt_v1(e.id)),0)into old_version;
  if old_version<active_version and app.native_mixed_game_reopen_bound_v1(active_id)is true then
   state_value:=app.get_native_mixed_simulation_game_state_v1(tid,eid,e.start_id,e.game_id);
   if state_value->>'kind'='native-mixed-simulation-game-state-v1'and state_value->'currentSourceVerified'='true'::jsonb
    and state_value->>'actorId'=actor::text and state_value->>'tournamentId'=tid::text and state_value->>'eventId'=eid::text
    and state_value->>'startId'=e.start_id::text and state_value->>'gameId'=e.game_id::text
    and state_value->>'historyDigest'is distinct from r.response_payload->>'historyDigest'
    and not exists(select 1 from jsonb_array_elements(state_value->'entries')x where x->>'id'=e.id::text)then
    return jsonb_build_object('kind','native-mixed-game-superseded-v1','status','superseded','actorId',actor,'tournamentId',tid,'eventId',eid,
     'operationId',e.operation_id,'request',request,'receipt',r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false),
     'proposalId',active_id,'currentState',state_value,'currentSourceVerified',true,'simulationOnly',true,
     'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
   end if;
  end if;
 end if;
 return r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);end$$;

create or replace function app.get_native_mixed_simulation_game_state_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare verified_start app.native_mixed_simulation_starts_v1%rowtype;actor uuid;root jsonb;g app.canonical_games%rowtype;h jsonb;hd text;row_value record;blind boolean;private_start_key uuid;own_participant uuid;play_order text;begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select*into verified_start from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;if not found then return null;end if;
 if not exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not(exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker'))and app.paper_official_identity_is_current_valid(actor,tid)and app.paper_official_is_independent(actor,tid,gid))then return null;end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1 in share mode nowait;
 for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,verified_start)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;end loop;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid;
 hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,root->>'startSourceDigest',h,app.native_mixed_game_active_attempt_v1(sid,gid));
 select id into own_participant from app.event_participants where event_id=eid and id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor;
 play_order:=case when own_participant is null then'official'else app.native_mixed_game_play_order_with_start_v1(tid,eid,verified_start,gid,own_participant)end;
 if play_order is null then return null;end if;
 -- A participating Digital official is still blind until their own submission.
 -- Revision/digest permit CAS without revealing another person's score.
 blind:=exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not exists(select 1 from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid and actor_id=actor and entry->>'action'='digital-submit');
 -- Paper preparers cannot copy a prior Digital result either. Once a capture
 -- exists, a nonplaying reviewer needs it for the separate review action.
 blind:=blind or(not exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not exists(select 1 from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid and entry->>'action'='paper-capture'));
 -- Display DTOs never disclose another account UUID, including to Paper officials. Correlation is
 -- needed only inside this game. The private Start receipt is not exposed to
 -- players and keys the HMAC; canonical journal/hash/own receipt stay unchanged.
 -- Canonical raw journal, digest and owned receipts are unchanged.
 select operation_receipt_id into private_start_key from app.native_mixed_simulation_starts_v1 where id=sid;
  if private_start_key is null then return null;end if;
  select coalesce(jsonb_agg(case when x->>'actorId'=actor::text then x else
   jsonb_set(x,'{actorId}',to_jsonb(substr(encode(extensions.hmac(sid::text||':'||gid::text||':'||(x->>'actorId'),private_start_key::text,'sha256'),'hex'),1,32)::uuid))end order by(x->>'sequence')::integer),'[]')into h from jsonb_array_elements(h)x;
 return jsonb_build_object('kind','native-mixed-simulation-game-state-v1','playOrder',play_order,'actorId',actor,'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
 'startSourceDigest',root->>'startSourceDigest','revision',jsonb_array_length(h),'historyDigest',hd,'evidenceVisibility',case when blind then 'metadata-only'else 'evidence'end,'entries',case when blind then '[]'::jsonb else h end,'currentSourceVerified',true,
 'simulationOnly',true,'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.resolve_native_mixed_game_operation_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;op uuid;sid uuid;gid uuid;r app.operation_receipts%rowtype;root jsonb;history jsonb;hd text;reason_value text;v jsonb;rid uuid:=extensions.gen_random_uuid();row_value record;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true or app.native_mixed_game_recovery_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'or app.native_mixed_game_request_valid_v1(request)is distinct from true then return null;end if;
 op:=(request->>'operationId')::uuid;sid:=(request->>'startId')::uuid;gid:=(request->>'gameId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-game:'||sid::text||':'||gid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if r.operation_type='native_mixed_game_closed_v1'then return app.native_mixed_game_closed_receipt_v1(r,actor,tid,eid,request);end if;
  return app.get_native_mixed_simulation_game_operation_v1(tid,eid,request);
 end if;
 -- Even after consent/source revocation, resolving one's nonce is not a new
 -- scoring permission. Scope must still be a bound private Start/game and own
 -- Digital side, or a current independently bound Paper official.
 if not exists(select 1 from app.native_mixed_simulation_starts_v1 st where st.id=sid and st.tournament_id=tid and st.event_id=eid
   and st.source_digest=request->>'expectedStartSourceDigest'and app.native_mixed_simulation_start_bound_v1(st.id)
   and exists(select 1 from jsonb_array_elements(st.source_capture->'canonicalGames')x where x->>'gameId'=gid::text))
  or not exists(select 1 from app.canonical_games g where g.id=gid and g.tournament_id=tid and g.event_id=eid
   and (request->>'action'in('digital-submit','digital-confirm')and exists(select 1 from app.event_participants p where p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.event_id=eid and p.profile_id=actor and p.id::text=request#>>'{payload,participantId}')
    or request->>'action'in('paper-capture','paper-review')and app.paper_official_identity_is_current_valid(actor,tid)and app.paper_official_is_independent(actor,tid,gid)
     and exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker'))))
 then return jsonb_build_object('status','blocked','code','resolution_scope_unavailable');end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1 in share row exclusive mode nowait;
 if exists(select 1 from app.native_mixed_game_all_evidence_v1() where actor_id=actor and operation_id=op)
  or app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)
 then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null then
  -- Generic unavailability, disabled prerequisites or temporary source failure
  -- is NOT a terminal contradiction. Bound own consent revocation is durable.
  if app.native_mixed_simulation_start_enabled_v1()is distinct from true
   or app.native_mixed_simulation_publication_enabled_v1()is distinct from true
   or request->>'action'not in('digital-submit','digital-confirm')then return jsonb_build_object('status','blocked','code','resolution_source_unavailable');end if;
  if not exists(select 1 from app.native_mixed_digital_consent_decisions_v1 c
   join app.native_mixed_attendance_seals_v1 seal on seal.scope_id=c.scope_id
   join app.native_mixed_simulation_starts_v1 st on st.id=sid and st.source_capture#>>'{attendance,sealId}'=seal.id::text
   where c.tournament_id=tid and c.event_id=eid and c.profile_id=actor and c.participant_id::text=request#>>'{payload,participantId}'and c.decision='revoked'
    and app.native_mixed_attendance_consent_bound_v1(c.id)
    and not exists(select 1 from app.native_mixed_digital_consent_decisions_v1 newer where newer.scope_id=c.scope_id and newer.profile_id=c.profile_id and newer.version>c.version))
   then return jsonb_build_object('status','blocked','code','resolution_source_unavailable');end if;
  reason_value:='source_changed';
 else
  for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid loop
   if app.native_mixed_game_entry_bound_v1(row_value.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  end loop;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into history from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid;
  hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,root->>'startSourceDigest',history,app.native_mixed_game_active_attempt_v1(sid,gid));
  if jsonb_array_length(history)<>(request->>'expectedRevision')::integer or hd<>request->>'expectedHistoryDigest'then reason_value:='history_changed';end if;
 end if;
 if reason_value is null then return jsonb_build_object('status','blocked','code','resolution_not_terminal');end if;
 v:=jsonb_build_object('kind','native-mixed-game-closed-v1','status','closed','code','terminal_operation_closed','actorId',actor,'tournamentId',tid,'eventId',eid,
  'operationId',op,'request',request,'closureId',rid,'reason',reason_value,'simulationOnly',true,'noWriteCommitted',true,
  'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(rid,tid,actor,'native_mixed_game_closed_v1',gid,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request)),op,'accepted',v,clock_timestamp());
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,rid,'native_mixed_game_closed',rid,'terminal_request_closed',v);
 select*into r from app.operation_receipts where id=rid;
 if app.native_mixed_game_closed_receipt_v1(r,actor,tid,eid,request)is distinct from v then raise exception'closure postcondition failed';end if;
 return v;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.native_mixed_qualification_review_v1(tid uuid,eid uuid,sid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;root jsonb;st app.native_mixed_simulation_starts_v1%rowtype;
 funding jsonb;funding_entries jsonb;game_values jsonb;cards jsonb;heads jsonb;ties jsonb;body jsonb;loop_game jsonb;
begin
 if app.native_mixed_qualification_review_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();
 if actor is null then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director')for share nowait;
 if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select * into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,
  app.paper_official_identity_bindings in share mode nowait;
 game_values:=st.source_capture->'canonicalGames';
 if jsonb_array_length(game_values)<>108 then return jsonb_build_object('status','blocked','code','unsupported_field');end if;
 for loop_game in select value from jsonb_array_elements(game_values)loop
  if app.native_mixed_game_complete_with_start_v1(tid,eid,st,(loop_game->>'gameId')::uuid)is distinct from true then
   return jsonb_build_object('status','blocked','code','practice_games_incomplete');end if;
 end loop;
 -- Fresh private funding proof must still be the funding source sealed into Start.
 -- Do not switch JWT role or project this into the ordinary Finance assembler.
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'or not exists(
  select 1 from app.native_mixed_attendance_seals_v1 seal
  join app.native_mixed_attendance_scopes_v1 a on a.id=seal.scope_id
  where seal.id::text=st.source_capture#>>'{attendance,sealId}'
   and a.tournament_id=tid and a.event_id=eid
   and a.funding_scope_id::text=funding#>>'{scope,scopeId}'
   and a.funding_source_digest=funding->>'sourceDigest')then
  return jsonb_build_object('status','blocked','code','funding_source_changed');end if;
 select jsonb_agg(jsonb_build_object('participantId',x->'participantId','receiptId',x#>'{receipt,receiptId}',
  'amountMinor',x#>'{receipt,amountMinor}','sourceDigest',x->'sourceDigest')order by x->>'participantId')
 into funding_entries from jsonb_array_elements(funding->'entries')x;
 if jsonb_array_length(funding_entries)<>18 then return null;end if;
 -- Completion above proves every raw journal entry, actor, receipt and audit.
 -- Never aggregate the pseudonymized player-display DTO as canonical evidence.
 with results as(
  select g,coalesce(e.entry->'result',e.entry#>'{claims,0,result}')r
  from jsonb_array_elements(game_values)g join lateral app.native_mixed_game_active_evidence_v1(sid,(g->>'gameId')::uuid)e
   on e.start_id=sid and e.game_id=(g->>'gameId')::uuid and e.sequence=1
 ),lines as(
  select g->>'sideAParticipantId'pid,g->>'sideBParticipantId'opp,r->>'winnerSide'='a'won,(r->>'margin')::integer margin from results
  union all
  select g->>'sideBParticipantId',g->>'sideAParticipantId',r->>'winnerSide'='b',(r->>'margin')::integer from results
 ),totals as(
  select pid,count(*)games,count(distinct opp)opponents,count(*)filter(where won)wins,
   sum(case when won then case when margin>=31 then 3 else 2 end else 0 end)gp,
   sum(case when won then margin else 0 end)pos,sum(case when won then 0 else margin end)neg
  from lines group by pid
 ),ranked as(
  select t.*,rank()over(order by gp desc,wins desc,pos-neg desc,pos desc)place,
   count(*)over(partition by gp,wins,pos-neg,pos)tie_count
  from totals t
 )select jsonb_agg(jsonb_build_object('participantId',rc.pid,'fixedTournamentId',a->'fixedId',
  'games',rc.games,'distinctOpponents',rc.opponents,'wins',rc.wins,'losses',rc.games-rc.wins,'gamePoints',rc.gp,
  'positiveSpread',rc.pos,'negativeSpread',rc.neg,'netSpread',rc.pos-rc.neg,'rank',rc.place,'tieCount',rc.tie_count)
  order by rc.place,rc.pid)into cards from ranked rc join jsonb_array_elements(st.source_capture->'fixedAssignments')a on a->>'participantId'=rc.pid;
 if jsonb_array_length(cards)<>18 or exists(select 1 from jsonb_array_elements(cards)c
  where (c->>'games')::integer<>12 or(c->>'distinctOpponents')::integer<>12)then
  return jsonb_build_object('status','blocked','code','scorecard_shape_invalid');end if;
 select coalesce(jsonb_agg(x),'[]')into ties from jsonb_array_elements(cards)x where(x->>'tieCount')::integer>1;
 select jsonb_agg(jsonb_build_object('gameId',game_id,'revision',revision,'historyDigest',digest)order by game_id)
 into heads from(select game_id,count(*)revision,case when app.native_mixed_game_active_attempt_v1(sid,game_id)is null then app.native_mixed_simulation_hash_v1(jsonb_agg(entry order by sequence))else app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-attempt-qualification-head-v1',app.native_mixed_game_active_attempt_v1(sid,game_id),jsonb_agg(entry order by sequence)))end digest
  from jsonb_array_elements(game_values)gv cross join lateral app.native_mixed_game_active_evidence_v1(sid,(gv->>'gameId')::uuid)e where e.start_id=sid group by game_id)h;
 body:=jsonb_build_object('kind','native-mixed-qualification-finance-review-v1','status','review_available',
  'tournamentId',tid,'eventId',eid,'startId',sid,'startSourceDigest',root->>'startSourceDigest',
  'evidenceHeads',heads,'cards',cards,'entrantCount',18,'qualifyingCount',5,
  'qualificationReady',jsonb_array_length(ties)=0,'tieReviewRequired',jsonb_array_length(ties)>0,
  'tieReviewReason',case when jsonb_array_length(ties)>0 then 'Head-to-head where applicable, then a deciding game; no arbitrary selection.'else null end,
  'fundingSourceDigest',funding->>'sourceDigest','simulatedReceipts',funding_entries,
  'simulatedGrossMinor',funding#>'{totals,receiptMinor}','costsMinor',null,'netPrizeFundMinor',null,'awards',null,
  'policyReviewRequired',true,'simulationOnly',true,'officialQualificationRecorded',false,'mrpAwarded',false,
  'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryFinanceSource',false);
 return body||jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body));
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;

create or replace function app.native_mixed_playoff_review_v1(tid uuid,eid uuid,sid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;root jsonb;st app.native_mixed_simulation_starts_v1%rowtype;
 funding jsonb;funding_entries jsonb;game_values jsonb;cards jsonb;heads jsonb;ties jsonb;body jsonb;loop_game jsonb;
begin
 if app.native_mixed_qualification_review_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();
 if actor is null then return null;end if;
 perform 1 from app.tournament_roles role_row join app.native_mixed_simulation_starts_v1 start_row
  on start_row.id=sid and start_row.tournament_id=tid and start_row.event_id=eid
  where role_row.tournament_id=tid and role_row.profile_id=start_row.actor_id and role_row.role='director'
  for share of role_row,start_row nowait;
 if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select * into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 if not found then return null;end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,
  app.paper_official_identity_bindings in share mode nowait;
 game_values:=st.source_capture->'canonicalGames';
 if jsonb_array_length(game_values)<>108 then return jsonb_build_object('status','blocked','code','unsupported_field');end if;
 for loop_game in select value from jsonb_array_elements(game_values)loop
  if app.native_mixed_game_complete_with_start_v1(tid,eid,st,(loop_game->>'gameId')::uuid)is distinct from true then
   return jsonb_build_object('status','blocked','code','practice_games_incomplete');end if;
 end loop;
 -- Fresh private funding proof must still be the funding source sealed into Start.
 -- Do not switch JWT role or project this into the ordinary Finance assembler.
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'or not exists(
  select 1 from app.native_mixed_attendance_seals_v1 seal
  join app.native_mixed_attendance_scopes_v1 a on a.id=seal.scope_id
  where seal.id::text=st.source_capture#>>'{attendance,sealId}'
   and a.tournament_id=tid and a.event_id=eid
   and a.funding_scope_id::text=funding#>>'{scope,scopeId}'
   and a.funding_source_digest=funding->>'sourceDigest')then
  return jsonb_build_object('status','blocked','code','funding_source_changed');end if;
 select jsonb_agg(jsonb_build_object('participantId',x->'participantId','receiptId',x#>'{receipt,receiptId}',
  'amountMinor',x#>'{receipt,amountMinor}','sourceDigest',x->'sourceDigest')order by x->>'participantId')
 into funding_entries from jsonb_array_elements(funding->'entries')x;
 if jsonb_array_length(funding_entries)<>18 then return null;end if;
 -- Completion above proves every raw journal entry, actor, receipt and audit.
 -- Never aggregate the pseudonymized player-display DTO as canonical evidence.
 with results as(
  select g,coalesce(e.entry->'result',e.entry#>'{claims,0,result}')r
  from jsonb_array_elements(game_values)g join lateral app.native_mixed_game_active_evidence_v1(sid,(g->>'gameId')::uuid)e
   on e.start_id=sid and e.game_id=(g->>'gameId')::uuid and e.sequence=1
 ),lines as(
  select g->>'sideAParticipantId'pid,g->>'sideBParticipantId'opp,r->>'winnerSide'='a'won,(r->>'margin')::integer margin from results
  union all
  select g->>'sideBParticipantId',g->>'sideAParticipantId',r->>'winnerSide'='b',(r->>'margin')::integer from results
 ),totals as(
  select pid,count(*)games,count(distinct opp)opponents,count(*)filter(where won)wins,
   sum(case when won then case when margin>=31 then 3 else 2 end else 0 end)gp,
   sum(case when won then margin else 0 end)pos,sum(case when won then 0 else margin end)neg
  from lines group by pid
 ),ranked as(
  select t.*,rank()over(order by gp desc,wins desc,pos-neg desc,pos desc)place,
   count(*)over(partition by gp,wins,pos-neg,pos)tie_count
  from totals t
 )select jsonb_agg(jsonb_build_object('participantId',rc.pid,'fixedTournamentId',a->'fixedId',
  'games',rc.games,'distinctOpponents',rc.opponents,'wins',rc.wins,'losses',rc.games-rc.wins,'gamePoints',rc.gp,
  'positiveSpread',rc.pos,'negativeSpread',rc.neg,'netSpread',rc.pos-rc.neg,'rank',rc.place,'tieCount',rc.tie_count)
  order by rc.place,rc.pid)into cards from ranked rc join jsonb_array_elements(st.source_capture->'fixedAssignments')a on a->>'participantId'=rc.pid;
 if jsonb_array_length(cards)<>18 or exists(select 1 from jsonb_array_elements(cards)c
  where (c->>'games')::integer<>12 or(c->>'distinctOpponents')::integer<>12)then
  return jsonb_build_object('status','blocked','code','scorecard_shape_invalid');end if;
 select coalesce(jsonb_agg(x),'[]')into ties from jsonb_array_elements(cards)x where(x->>'tieCount')::integer>1;
 select jsonb_agg(jsonb_build_object('gameId',game_id,'revision',revision,'historyDigest',digest)order by game_id)
 into heads from(select game_id,count(*)revision,case when app.native_mixed_game_active_attempt_v1(sid,game_id)is null then app.native_mixed_simulation_hash_v1(jsonb_agg(entry order by sequence))else app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-attempt-qualification-head-v1',app.native_mixed_game_active_attempt_v1(sid,game_id),jsonb_agg(entry order by sequence)))end digest
  from jsonb_array_elements(game_values)gv cross join lateral app.native_mixed_game_active_evidence_v1(sid,(gv->>'gameId')::uuid)e where e.start_id=sid group by game_id)h;
 body:=jsonb_build_object('kind','native-mixed-qualification-finance-review-v1','status','review_available',
  'tournamentId',tid,'eventId',eid,'startId',sid,'startSourceDigest',root->>'startSourceDigest',
  'evidenceHeads',heads,'cards',cards,'entrantCount',18,'qualifyingCount',5,
  'qualificationReady',jsonb_array_length(ties)=0,'tieReviewRequired',jsonb_array_length(ties)>0,
  'tieReviewReason',case when jsonb_array_length(ties)>0 then 'Head-to-head where applicable, then a deciding game; no arbitrary selection.'else null end,
  'fundingSourceDigest',funding->>'sourceDigest','simulatedReceipts',funding_entries,
  'simulatedGrossMinor',funding#>'{totals,receiptMinor}','costsMinor',null,'netPrizeFundMinor',null,'awards',null,
  'policyReviewRequired',true,'simulationOnly',true,'officialQualificationRecorded',false,'mrpAwarded',false,
  'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryFinanceSource',false);
 return body||jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body));
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;

alter function app.native_mixed_game_reopen_enabled_v1()owner to postgres;
revoke all on function app.native_mixed_game_reopen_enabled_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_game_reopen_request_valid_v1(jsonb)owner to postgres;
revoke all on function app.native_mixed_game_reopen_request_valid_v1(jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_all_evidence_v1()owner to postgres;
revoke all on function app.native_mixed_game_all_evidence_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_game_all_artifacts_v1()owner to postgres;
revoke all on function app.native_mixed_game_all_artifacts_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_game_entry_attempt_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_game_entry_attempt_v1(uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_attempt_history_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_game_attempt_history_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_attempt_digest_v1(uuid,uuid,text,jsonb,uuid)owner to postgres;
revoke all on function app.native_mixed_game_attempt_digest_v1(uuid,uuid,text,jsonb,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_reopen_bound_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_game_reopen_bound_v1(uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_active_attempt_v1(uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_game_active_attempt_v1(uuid,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_active_evidence_v1(uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_game_active_evidence_v1(uuid,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_reopen_subject_v1(uuid,uuid,uuid,uuid,boolean)owner to postgres;
revoke all on function app.native_mixed_game_reopen_subject_v1(uuid,uuid,uuid,uuid,boolean)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_reopen_block_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_game_reopen_block_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_game_reopen_workspace_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_game_reopen_workspace_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_reopen_receipt_bound_v1(app.operation_receipts,uuid,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_mixed_game_reopen_receipt_bound_v1(app.operation_receipts,uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_game_reopen_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.get_native_mixed_game_reopen_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.record_native_mixed_game_reopen_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.record_native_mixed_game_reopen_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_game_reopen_workspace_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_game_reopen_workspace_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function public.record_native_mixed_game_reopen_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.record_native_mixed_game_reopen_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_game_reopen_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.get_native_mixed_game_reopen_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_entry_bound_with_start_v1(uuid,app.native_mixed_simulation_starts_v1)owner to postgres;
revoke all on function app.native_mixed_game_entry_bound_with_start_v1(uuid,app.native_mixed_simulation_starts_v1)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_entry_bound_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_game_entry_bound_v1(uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)owner to postgres;
revoke all on function app.native_mixed_game_complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_closed_receipt_v1(app.operation_receipts,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_mixed_game_closed_receipt_v1(app.operation_receipts,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.append_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.append_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_simulation_game_operation_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.get_native_mixed_simulation_game_operation_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_simulation_game_state_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_simulation_game_state_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function app.resolve_native_mixed_game_operation_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.resolve_native_mixed_game_operation_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_qualification_review_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_qualification_review_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_review_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_playoff_review_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
