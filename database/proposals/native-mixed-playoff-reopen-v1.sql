-- PRIVATE DEFAULT-OFF fictional Playoff disagreement and audited fresh attempts.
-- Dedicated context/slot/game protocol; never qualifying or ordinary scores.
-- Install after exact native Playoff/own/latest-source/Main+Pool Finance closure.
-- Source dispatcher, Setup/qualifying evidence, original rows and grants unchanged.
begin;
create function app.native_mixed_playoff_disagreement_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;
create function app.native_mixed_playoff_reopen_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;

create function app.native_mixed_playoff_reopen_request_valid_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''set timezone='UTC'as $$begin
 return app.native_mixed_pool_exact_v1(v,array['kind','action','contextId','slot','gameNumber','expectedSourceDigest','expectedMatchDigest','expectedRevision','expectedHistoryDigest','expectedPolicyDigest','reason'])is true
 and v->>'kind'='native-mixed-playoff-reopen-v1'and v->>'action'='propose'
 and app.native_mixed_simulation_uuid_v1(v->>'contextId')is true
 and jsonb_typeof(v->'slot')='number'and v->>'slot'~'^[1-4]$'
 and jsonb_typeof(v->'gameNumber')='number'and v->>'gameNumber'~'^[1-9][0-9]{0,3}$'and(v->>'gameNumber')::integer<=2500
 and jsonb_typeof(v->'expectedRevision')='number'and v->>'expectedRevision'~'^[0-6]$'
 and jsonb_typeof(v->'expectedSourceDigest')='string'and v->>'expectedSourceDigest'~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedMatchDigest')='string'and v->>'expectedMatchDigest'~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedHistoryDigest')='string'and v->>'expectedHistoryDigest'~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedPolicyDigest')='string'and v->>'expectedPolicyDigest'~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'reason')='string'and length(v->>'reason')between 1 and 500
 and v->>'reason'=btrim(v->>'reason',U&' \0009\000A\000B\000C\000D\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
 and v->>'reason'!~U&'[\0001-\001F\007F]'
 and(select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)from regexp_split_to_table(v->>'reason','')ch)<=500;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;

create table app.native_mixed_playoff_reopens_v1(
 id uuid primary key,context_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 slot integer not null check(slot between 1 and 4),game_number integer not null check(game_number between 1 and 2500),
 version integer not null check(version>0),prior_attempt_id uuid,actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,
 operation_id uuid not null,receipt_id uuid not null unique,request_payload jsonb not null,policy_capture jsonb not null,
 authority_capture jsonb not null,prior_history jsonb not null,response_payload jsonb not null,record_digest text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(context_id,slot,game_number,version),unique(id,context_id,slot,game_number),unique(actor_id,operation_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(prior_attempt_id,context_id,slot,game_number)references app.native_mixed_playoff_reopens_v1(id,context_id,slot,game_number),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check((version=1 and prior_attempt_id is null)or(version>1 and prior_attempt_id is not null)),
 check(app.native_mixed_playoff_reopen_request_valid_v1(request_payload)is true),
 check(request_payload->>'contextId'=context_id::text and request_payload->'slot'=to_jsonb(slot)and request_payload->'gameNumber'=to_jsonb(game_number)),
 check(record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-record-v1',id,context_id,tournament_id,event_id,slot,game_number,version,prior_attempt_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,policy_capture,authority_capture,prior_history,response_payload)))
);
create table app.native_mixed_playoff_attempt_evidence_v1(
 attempt_id uuid not null,like app.native_mixed_playoff_evidence_v1 including defaults including constraints,
 primary key(id),unique(attempt_id,sequence),unique(actor_id,operation_id),unique(receipt_id),
 foreign key(attempt_id,context_id,slot,game_number)references app.native_mixed_playoff_reopens_v1(id,context_id,slot,game_number),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),foreign key(actor_id)references app.profiles(id)
);
create table app.native_mixed_playoff_own_closures_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,context_id uuid not null,actor_id uuid not null references app.profiles(id),
 actor_session_id uuid not null,operation_id uuid not null,receipt_id uuid not null unique,request_payload jsonb not null,
 proof_capture jsonb not null,response_payload jsonb not null,record_digest text not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,operation_id),foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-own-closure-record-v1',id,tournament_id,event_id,context_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,proof_capture,response_payload)))
);
do $security$declare n text;begin foreach n in array array['native_mixed_playoff_reopens_v1','native_mixed_playoff_attempt_evidence_v1','native_mixed_playoff_own_closures_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_playoff_all_evidence_v1()returns setof app.native_mixed_playoff_evidence_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$
 select e.*from app.native_mixed_playoff_evidence_v1 e union all
 select id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload,created_at from app.native_mixed_playoff_attempt_evidence_v1$$;
create function app.native_mixed_playoff_entry_attempt_v1(entry_id uuid)returns uuid
language sql stable security definer set search_path=''set timezone='UTC'as $$select attempt_id from app.native_mixed_playoff_attempt_evidence_v1 where id=entry_id$$;
create function app.native_mixed_playoff_attempt_history_v1(ctx uuid,s integer,g integer,attempt uuid)returns setof app.native_mixed_playoff_evidence_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$select e.*from app.native_mixed_playoff_all_evidence_v1()e
 where context_id=ctx and slot=s and game_number=g and app.native_mixed_playoff_entry_attempt_v1(id)is not distinct from attempt$$;
create function app.native_mixed_playoff_attempt_digest_v1(ctx uuid,s integer,g integer,md text,h jsonb,attempt uuid)returns text
language sql immutable set search_path=''set timezone='UTC'as $$select app.native_mixed_simulation_hash_v1(case when attempt is null
 then jsonb_build_array('native-mixed-playoff-game-history-v1',ctx,s,g,md,h)
 else jsonb_build_array('native-mixed-playoff-attempt-history-v1',ctx,s,g,md,attempt,h)end)$$;

create function app.native_mixed_playoff_reopen_bound_v1(reopen uuid)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare p app.native_mixed_playoff_reopens_v1%rowtype;prior app.native_mixed_playoff_reopens_v1%rowtype;r app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;h jsonb;v record;begin
 select*into p from app.native_mixed_playoff_reopens_v1 where id=reopen;if p.id is null then return false;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=p.context_id;select*into r from app.operation_receipts where id=p.receipt_id;
 if c.id is null or c.tournament_id<>p.tournament_id or c.event_id<>p.event_id or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true
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
  if prior.id is null or app.native_mixed_playoff_reopen_bound_v1(prior.id)is distinct from true then return false;end if;
 end if;
 for v in select*from app.native_mixed_playoff_attempt_history_v1(p.context_id,p.slot,p.game_number,p.prior_attempt_id)loop
  if app.native_mixed_playoff_row_bound_v1(v.id,'evidence')is distinct from true then return false;end if;
 end loop;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_playoff_attempt_history_v1(p.context_id,p.slot,p.game_number,p.prior_attempt_id);
 return h=p.prior_history and jsonb_array_length(h)=(p.request_payload->>'expectedRevision')::integer
 and app.native_mixed_playoff_attempt_digest_v1(p.context_id,p.slot,p.game_number,p.request_payload->>'expectedMatchDigest',h,p.prior_attempt_id)=p.request_payload->>'expectedHistoryDigest'
 and app.native_mixed_playoff_match_v1(p.context_id,p.slot)->>'matchDigest'=p.request_payload->>'expectedMatchDigest'
 and app.native_mixed_playoff_game_v1(c.source_capture,app.native_mixed_playoff_match_v1(p.context_id,p.slot)->'participants',h)->'reviewRequired'='true'::jsonb
 and p.record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-record-v1',p.id,p.context_id,p.tournament_id,p.event_id,p.slot,p.game_number,p.version,p.prior_attempt_id,p.actor_id,p.actor_session_id,p.operation_id,p.receipt_id,p.request_payload,p.policy_capture,p.authority_capture,p.prior_history,p.response_payload));
end$$;
create function app.native_mixed_playoff_active_attempt_v1(ctx uuid,s integer,g integer)returns uuid
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare p uuid;begin
 select id into p from app.native_mixed_playoff_reopens_v1 where context_id=ctx and slot=s and game_number=g order by version desc limit 1;
 if p is not null and app.native_mixed_playoff_reopen_bound_v1(p)is distinct from true then raise exception 'unbound Playoff attempt';end if;return p;end$$;
create function app.native_mixed_playoff_active_evidence_v1(ctx uuid,s integer,g integer)returns setof app.native_mixed_playoff_evidence_v1
language sql stable security definer set search_path=''set timezone='UTC'as $$select*from app.native_mixed_playoff_attempt_history_v1(ctx,s,g,app.native_mixed_playoff_active_attempt_v1(ctx,s,g))$$;

create function app.native_mixed_playoff_reopen_subject_v1(tid uuid,eid uuid,ctx uuid,s integer,g integer,writing boolean)returns uuid
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;b app.paper_official_identity_bindings%rowtype;begin
 actor:=app.native_mixed_pool_actor_v1();if actor is null or auth.jwt()->>'sub'is distinct from actor::text or app.native_mixed_pilot_permitted_v1(actor,tid,eid,writing)is distinct from true then return null;end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.roster_account_links,app.event_participants,app.tournament_roster_entries in share mode nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;
 if not found or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true or s not between 1 and 4 or g not between 1 and 2500 then return null;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx and tournament_id=tid and event_id=eid;
 if c.id is null or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return null;end if;
 m:=app.native_mixed_playoff_match_v1(ctx,s);if m is null or g>(m#>>'{format,maximumGames}')::integer then return null;end if;
 select*into b from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
 if b.id is null or exists(select 1 from jsonb_array_elements(c.source_capture->'roster')x where m->'participants'?(x->>'participantId')and(x->>'profileId'=actor::text or x->>'rosterEntryId'=b.roster_entry_id::text))
 or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and m->'participants'?p.id::text and(p.profile_id=actor or p.roster_entry_id=b.roster_entry_id))then return null;end if;
 return actor;end$$;

create function app.native_mixed_playoff_reopen_block_v1(ctx uuid,s integer,g integer)returns text
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare c app.native_mixed_playoff_contexts_v1%rowtype;p jsonb;x jsonb;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx;p:=app.native_mixed_playoff_progress_v1(ctx,s);
 if c.id is null or p is null then return'operation_history_unavailable';end if;
 select value into x from jsonb_array_elements(p->'games')v where(v->>'gameNumber')::integer=g;
 if x->'complete'='true'::jsonb or p->'complete'='true'::jsonb or exists(select 1 from app.native_mixed_playoff_results_v1 where context_id=ctx and slot=s)then return'game_already_complete';end if;
 if exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where context_id=ctx and slot=s and game_number>g)
 or exists(select 1 from app.native_mixed_playoff_reopens_v1 where context_id=ctx and slot=s and game_number>g)then return'later_evidence_exists';end if;
 if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=ctx)
 or exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where context_id=ctx and(slot=4 and s in(1,2,3)or slot=2 and s=1))
 or exists(select 1 from app.native_mixed_playoff_results_v1 where context_id=ctx and(slot=4 and s in(1,2,3)or slot=2 and s=1))
 or exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=c.tournament_id and event_id=c.event_id)
 or exists(select 1 from app.native_mixed_main_finance_obligations_v1 where tournament_id=c.tournament_id and event_id=c.event_id)
 or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=c.tournament_id and event_id=c.event_id and kind='final')then return'downstream_closed';end if;
 if(p->>'nextGameNumber')::integer<>g then return'match_or_game_changed';end if;
 if x->'reviewRequired'is distinct from'true'::jsonb then return'game_not_disputed';end if;
 return null;end$$;

-- Explicit whitelist shared by own display and the authorized two-player review.
create function app.native_mixed_playoff_display_entry_v1(e jsonb)returns jsonb
language plpgsql immutable set search_path=''set timezone='UTC'as $$declare v jsonb;begin
 v:=jsonb_build_object('id',e->'id','type',e->'type');
 if e->>'type'='digital-submit'then return v||jsonb_build_object('participantId',e->'participantId','winnerParticipantId',e->'winnerParticipantId');end if;
 if e->>'type'='digital-confirm'then return v||jsonb_build_object('participantId',e->'participantId','submissionId',e->'submissionId','winnerParticipantId',e->'winnerParticipantId','evidenceIds',e->'evidenceIds');end if;
 if e->>'type'='paper-capture'then return v||jsonb_build_object('artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','claims',e->'claims');end if;
 if e->>'type'='paper-review'then return v||jsonb_build_object('captureId',e->'captureId','artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','reenteredClaims',e->'reenteredClaims')||case when e?'decision'then jsonb_build_object('decision',e->'decision')else'{}'::jsonb end;end if;
 return null;end$$;

create function app.get_native_mixed_playoff_reopen_workspace_v1(tid uuid,eid uuid,ctx uuid,s integer,g integer)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;source jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;p jsonb;x jsonb;policy app.correction_policy_versions%rowtype;blocked text;people jsonb;entries jsonb;begin
 if app.native_mixed_playoff_reopen_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_playoff_reopen_subject_v1(tid,eid,ctx,s,g,false);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1,app.correction_policy_versions in share mode nowait;
 source:=app.native_mixed_playoff_source_v1(tid,eid);select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx;
 if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 if c.source_digest<>source->>'sourceDigest'or c.source_capture<>source->'capture'then return jsonb_build_object('status','blocked','code','source_changed');end if;
 p:=app.native_mixed_playoff_progress_v1(ctx,s);m:=p->'match';if p is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 select value into x from jsonb_array_elements(p->'games')v where(v->>'gameNumber')::integer=g;
 if x is null then return jsonb_build_object('status','blocked','code','game_not_disputed');end if;
 select*into policy from app.correction_policy_versions where tournament_id=tid order by version desc limit 1;
 blocked:=case when policy.tournament_id is null then'policy_unavailable'when policy.required_approvals<>0 then'approval_workflow_unavailable'else app.native_mixed_playoff_reopen_block_v1(ctx,s,g)end;
 if blocked='operation_history_unavailable'then return jsonb_build_object('status','blocked','code',blocked);end if;
 select jsonb_agg(jsonb_build_object('participantId',r->'participantId','tournamentIdNumber',r->'fixedTournamentId','displayName',tr.claimed_display_name,'mode',r->'mode')order by sides.n)into people
 from jsonb_array_elements(m->'participants')with ordinality sides(pid,n)join jsonb_array_elements(c.source_capture->'roster')r on r->'participantId'=sides.pid
 join app.tournament_roster_entries tr on tr.id=(r->>'rosterEntryId')::uuid and tr.tournament_id=tid;
 if jsonb_array_length(people)is distinct from 2 then return null;end if;
 select coalesce(jsonb_agg(app.native_mixed_playoff_display_entry_v1(entry)order by sequence),'[]')into entries from app.native_mixed_playoff_active_evidence_v1(ctx,s,g);
 if app.native_mixed_playoff_reopen_subject_v1(tid,eid,ctx,s,g,false)is distinct from actor then return null;end if;
 return jsonb_build_object('kind','native-mixed-playoff-reopen-workspace-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',tid,'eventId',eid,'contextId',ctx,'slot',s,'gameNumber',g,
 'sourceDigest',c.source_digest,'matchDigest',m->'matchDigest','revision',x->'revision','historyDigest',x->'historyDigest','sideA',people->0,'sideB',people->1,'entries',entries,
 'policy',case when policy.tournament_id is null then null else jsonb_build_object('version',policy.version,'requiredApprovals',policy.required_approvals,'reasonRequired',policy.reason_required,'digest',app.native_mixed_simulation_hash_v1(to_jsonb(policy)))end,
 'canPropose',blocked is null,'blockedCode',blocked,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_playoff_reopen_receipt_bound_v1(r app.operation_receipts,actor uuid,tid uuid,eid uuid,op uuid,q jsonb)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare v jsonb:=r.response_payload;begin
 if r.id is null or r.tournament_id<>tid or r.actor_profile_id<>actor or r.client_operation_id<>op or r.operation_type<>'native_mixed_playoff_reopen_v1'
 or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-request-v1',actor,tid,eid,op,q))
 or v is distinct from jsonb_build_object('kind','native-mixed-playoff-reopen-receipt-v1','status',r.outcome,'actorId',actor,'sessionId',v->'sessionId','tournamentId',tid,'eventId',eid,'operationId',op,'request',q,
 'reopenId',case when r.outcome='accepted'then to_jsonb(r.target_id)else'null'::jsonb end,'priorRevision',q->'expectedRevision','priorHistoryDigest',q->'expectedHistoryDigest',
 'revision',case when r.outcome='accepted'then'0'::jsonb else'null'::jsonb end,'historyDigest',case when r.outcome='accepted'then v->'historyDigest'else'null'::jsonb end,'code',v->'code',
 'historicalReceipt',false,'currentSourceVerified',false,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false)
 or app.native_mixed_simulation_uuid_v1(v->>'sessionId')is distinct from true
 or not exists(select 1 from app.audit_events a where a.operation_receipt_id=r.id and a.tournament_id=tid and a.actor_profile_id=actor and a.entity_type='native_mixed_playoff_reopen'and a.entity_id=r.target_id and a.action=case when r.outcome='accepted'then'game_reopened'else'game_reopen_rejected'end and a.after_state=v)then return false;end if;
 if r.outcome='accepted'then return v->>'code'='game_reopened'and app.native_mixed_playoff_reopen_bound_v1(r.target_id)is true;end if;
 return r.outcome='rejected'and v->>'code'in('source_changed','source_unavailable','match_or_game_changed','history_changed','policy_changed','policy_unavailable','approval_workflow_unavailable','game_not_disputed','game_already_complete','later_evidence_exists','downstream_closed');end$$;

create function app.record_native_mixed_playoff_reopen_v1(tid uuid,eid uuid,op uuid,q jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;ctx uuid;s integer;g integer;c app.native_mixed_playoff_contexts_v1%rowtype;policy app.correction_policy_versions%rowtype;old app.operation_receipts%rowtype;
 source jsonb;p jsonb;m jsonb;x jsonb;h jsonb;authority jsonb;code text;idv uuid;rid uuid;prior uuid;ver integer;rh text;response jsonb;b uuid;begin
 if app.native_mixed_playoff_reopen_enabled_v1()is distinct from true then return null;end if;
 if op is null or app.native_mixed_playoff_reopen_request_valid_v1(q)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 ctx:=(q->>'contextId')::uuid;s:=(q->>'slot')::integer;g:=(q->>'gameNumber')::integer;
 actor:=app.native_mixed_playoff_reopen_subject_v1(tid,eid,ctx,s,g,true);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-request-v1',actor,tid,eid,op,q));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if old.id is not null then
  if old.request_hash<>rh or old.operation_type<>'native_mixed_playoff_reopen_v1'or old.tournament_id<>tid then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  if app.native_mixed_playoff_reopen_receipt_bound_v1(old,actor,tid,eid,op,q)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true);end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1,app.correction_policy_versions,
 app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1,app.native_mixed_pool_records_v1 in share row exclusive mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx;
 source:=app.native_mixed_playoff_source_v1(tid,eid);
 if source is null then code:='source_unavailable';
 elsif c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'or c.source_digest<>q->>'expectedSourceDigest'then code:='source_changed';end if;
 select*into policy from app.correction_policy_versions where tournament_id=tid order by version desc limit 1;
 if code is null then
  if policy.tournament_id is null then code:='policy_unavailable';
  elsif app.native_mixed_simulation_hash_v1(to_jsonb(policy))<>q->>'expectedPolicyDigest'then code:='policy_changed';
  elsif policy.required_approvals<>0 then code:='approval_workflow_unavailable';end if;
 end if;
 if code is null then
  p:=app.native_mixed_playoff_progress_v1(ctx,s);if p is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;m:=p->'match';
  select value into x from jsonb_array_elements(p->'games')v where(v->>'gameNumber')::integer=g;
  if m->>'matchDigest'<>q->>'expectedMatchDigest'then code:='match_or_game_changed';
  elsif x is null then code:='game_not_disputed';
  elsif x->'revision'<>q->'expectedRevision'or x->>'historyDigest'<>q->>'expectedHistoryDigest'then code:='history_changed';
  else code:=app.native_mixed_playoff_reopen_block_v1(ctx,s,g);end if;
  if code='operation_history_unavailable'then return jsonb_build_object('status','blocked','code',code);end if;
 end if;
 if app.native_mixed_playoff_reopen_subject_v1(tid,eid,ctx,s,g,true)is distinct from actor then raise exception 'Playoff reopen authorization changed';end if;
 idv:=extensions.gen_random_uuid();rid:=extensions.gen_random_uuid();
 response:=jsonb_build_object('kind','native-mixed-playoff-reopen-receipt-v1','status',case when code is null then'accepted'else'rejected'end,'actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',tid,'eventId',eid,'operationId',op,'request',q,
 'reopenId',case when code is null then to_jsonb(idv)else'null'::jsonb end,'priorRevision',q->'expectedRevision','priorHistoryDigest',q->'expectedHistoryDigest','revision',case when code is null then'0'::jsonb else'null'::jsonb end,
 'historyDigest',case when code is null then to_jsonb(app.native_mixed_playoff_attempt_digest_v1(ctx,s,g,m->>'matchDigest','[]',idv))else'null'::jsonb end,'code',coalesce(code,'game_reopened'),
 'historicalReceipt',false,'currentSourceVerified',false,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(rid,tid,actor,'native_mixed_playoff_reopen_v1',idv,rh,op,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then
  prior:=app.native_mixed_playoff_active_attempt_v1(ctx,s,g);select coalesce(max(version),0)+1 into ver from app.native_mixed_playoff_reopens_v1 where context_id=ctx and slot=s and game_number=g;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_playoff_active_evidence_v1(ctx,s,g);
  select id into b from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
  authority:=jsonb_build_object('subjectId',actor,'sessionId',auth.jwt()->>'session_id','directorChecked',true,'nonselfChecked',true,'paperIdentityBindingId',b);
  insert into app.native_mixed_playoff_reopens_v1(id,context_id,tournament_id,event_id,slot,game_number,version,prior_attempt_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,policy_capture,authority_capture,prior_history,response_payload,record_digest)
  values(idv,ctx,tid,eid,s,g,ver,prior,actor,(auth.jwt()->>'session_id')::uuid,op,rid,q,to_jsonb(policy),authority,h,response,
  app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-reopen-record-v1',idv,ctx,tid,eid,s,g,ver,prior,actor,(auth.jwt()->>'session_id')::uuid,op,rid,q,to_jsonb(policy),authority,h,response)));
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_playoff_reopen',idv,case when code is null then'game_reopened'else'game_reopen_rejected'end,response);
 select*into old from app.operation_receipts where id=rid;if app.native_mixed_playoff_reopen_receipt_bound_v1(old,actor,tid,eid,op,q)is distinct from true then raise exception 'Playoff reopen postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.reconcile_native_mixed_playoff_reopen_v1(tid uuid,eid uuid,op uuid,q jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;r app.operation_receipts%rowtype;begin
 if app.native_mixed_playoff_reopen_enabled_v1()is distinct from true or app.native_mixed_playoff_reopen_request_valid_v1(q)is distinct from true or op is null then return null;end if;
 actor:=app.native_mixed_playoff_reopen_subject_v1(tid,eid,(q->>'contextId')::uuid,(q->>'slot')::integer,(q->>'gameNumber')::integer,false);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if r.id is null then return jsonb_build_object('status','not_found');end if;
 if app.native_mixed_playoff_reopen_receipt_bound_v1(r,actor,tid,eid,op,q)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return r.response_payload||jsonb_build_object('historicalReceipt',true);exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Own operation authorization is bound to the immutable Playoff roster AND the
-- live actor/account link. No qualifying canonical game or official-self helper.
create function app.native_mixed_playoff_own_request_subject_v1(tid uuid,eid uuid,q jsonb,writing boolean)returns uuid
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;d jsonb;e jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;begin
 actor:=app.native_mixed_pool_actor_v1();if actor is null or auth.jwt()->>'sub'is distinct from actor::text or app.native_mixed_pilot_permitted_v1(actor,tid,eid,writing)is distinct from true then return null;end if;
 if app.native_mixed_pool_exact_v1(q,array['version','action','expectedSourceDigest','data','reason'])is distinct from true or q->>'version'is distinct from'native-mixed-playoff-request-v1'or q->>'action'is distinct from'game-action'
 or jsonb_typeof(q->'reason')is distinct from'string'or length(q->>'reason')not between 1 and 500 or q->>'reason'<>btrim(q->>'reason')or q->>'reason'~'[[:cntrl:]]'
 or coalesce(q->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'then return null;end if;
 d:=q->'data';e:=d->'entry';
 if app.native_mixed_pool_exact_v1(d,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])is distinct from true
 or app.native_mixed_simulation_uuid_v1(d->>'contextId')is distinct from true or jsonb_typeof(d->'slot')is distinct from'number'or coalesce(d->>'slot','')!~'^[1-4]$'
 or jsonb_typeof(d->'gameNumber')is distinct from'number'or coalesce(d->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'or(d->>'gameNumber')::integer>2500
 or jsonb_typeof(d->'expectedRevision')is distinct from'number'or coalesce(d->>'expectedRevision','')!~'^[0-5]$'
 or coalesce(d->>'expectedMatchDigest','')!~'^[a-f0-9]{64}$'or coalesce(d->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'
 or app.native_mixed_simulation_uuid_v1(e->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(e->>'winnerParticipantId')is distinct from true then return null;end if;
 if e->>'type'='digital-submit'then
  if app.native_mixed_pool_exact_v1(e,array['type','participantId','winnerParticipantId','statement'])is distinct from true or e->>'statement'is distinct from'simulation-own-playoff-result-v1'then return null;end if;
 elsif e->>'type'='digital-confirm'then
  if app.native_mixed_pool_exact_v1(e,array['type','participantId','submissionId','winnerParticipantId','evidenceIds','statement'])is distinct from true or e->>'statement'is distinct from'simulation-own-playoff-confirmation-v1'or app.native_mixed_simulation_uuid_v1(e->>'submissionId')is distinct from true or jsonb_typeof(e->'evidenceIds')is distinct from'array'then return null;end if;
  if jsonb_array_length(e->'evidenceIds')not between 2 and 3
  or exists(select 1 from jsonb_array_elements(e->'evidenceIds')x where jsonb_typeof(x)<>'string'or app.native_mixed_simulation_uuid_v1(x#>>'{}')is distinct from true)
  or(select count(distinct x)from jsonb_array_elements(e->'evidenceIds')x)<>jsonb_array_length(e->'evidenceIds')
  or not((e->'evidenceIds')?(e->>'submissionId'))
  or e->'evidenceIds'is distinct from(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(e->'evidenceIds')x)then return null;end if;
 else return null;end if;
 lock table app.event_participants,app.roster_account_links in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=(d->>'contextId')::uuid and tournament_id=tid and event_id=eid;
 if c.id is null or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true or c.source_digest<>q->>'expectedSourceDigest'then return null;end if;
 m:=app.native_mixed_playoff_match_v1(c.id,(d->>'slot')::integer);
 if m is null or not(m->'participants'?(e->>'participantId'))or not(m->'participants'?(e->>'winnerParticipantId'))or(d->>'gameNumber')::integer>(m#>>'{format,maximumGames}')::integer then return null;end if;
 if not exists(select 1 from jsonb_array_elements(c.source_capture->'roster')r join app.event_participants ep on ep.id=(r->>'participantId')::uuid and ep.tournament_id=tid and ep.event_id=eid
 join app.roster_account_links l on l.tournament_id=tid and l.roster_entry_id=ep.roster_entry_id and l.profile_id=ep.profile_id
 where r->>'participantId'=e->>'participantId'and r->>'mode'='digital'and r->>'profileId'=actor::text and ep.profile_id=actor and ep.status='registered'and ep.roster_entry_id::text=r->>'rosterEntryId')then return null;end if;
 return actor;exception when invalid_text_representation or numeric_value_out_of_range then return null;end$$;

create function app.native_mixed_playoff_own_closure_bound_v1(r app.operation_receipts,actor uuid,tid uuid,eid uuid,op uuid,q jsonb)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare c app.native_mixed_playoff_own_closures_v1%rowtype;v jsonb;begin
 select*into c from app.native_mixed_playoff_own_closures_v1 where receipt_id=r.id;v:=c.response_payload;
 return c.id is not null and c.actor_id=actor and c.tournament_id=tid and c.event_id=eid and c.operation_id=op and c.request_payload=q
 and r.actor_profile_id=actor and r.tournament_id=tid and r.client_operation_id=op and r.target_id=c.id and r.operation_type='native_mixed_playoff_own_closure_v1'and r.outcome='rejected'and r.response_payload=v
 and r.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,q))
 and v=jsonb_build_object('kind','native-mixed-playoff-own-closure-receipt-v1','status','closed','actorId',actor,'sessionId',c.actor_session_id,'tournamentId',tid,'eventId',eid,'operationId',op,'request',q,'code',v->'code',
 'historicalReceipt',false,'currentSourceVerified',false,'writeAuthorized',false,'noWriteCommitted',true,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false)
 and v->>'code'in('source_changed','history_changed','match_or_game_changed')
 and c.record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-own-closure-record-v1',c.id,tid,eid,c.context_id,actor,c.actor_session_id,op,r.id,q,c.proof_capture,v))
 and not exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where actor_id=actor and operation_id=op)
 and exists(select 1 from app.audit_events a where a.operation_receipt_id=r.id and a.actor_profile_id=actor and a.tournament_id=tid and a.entity_type='native_mixed_playoff_own_closure'and a.entity_id=c.id and a.action='uncommitted_closed'and a.after_state=v);
end$$;

create function app.get_native_mixed_playoff_own_operation_v1(tid uuid,eid uuid,op uuid,q jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;r app.operation_receipts%rowtype;e app.native_mixed_playoff_evidence_v1%rowtype;source jsonb;own_state jsonb;p jsonb;m jsonb;d jsonb:=q->'data';h jsonb;hd text;rev integer;attempt uuid;old_attempt uuid;base jsonb;candidate jsonb;begin
 if app.native_mixed_playoff_reopen_enabled_v1()is distinct from true or op is null then return null;end if;
 actor:=app.native_mixed_playoff_own_request_subject_v1(tid,eid,q,false);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 base:=jsonb_build_object('kind','native-mixed-playoff-own-operation-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',tid,'eventId',eid,'operationId',op,'request',q,'writeAuthorized',false,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if r.id is not null then
  if app.native_mixed_playoff_own_closure_bound_v1(r,actor,tid,eid,op,q)is true then return base||jsonb_build_object('status','closed','closureReceipt',r.response_payload||jsonb_build_object('historicalReceipt',true),'currentSourceVerified',false);end if;
  if r.operation_type<>'native_mixed_playoff_v1'or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,q))then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  select*into e from app.native_mixed_playoff_all_evidence_v1()where receipt_id=r.id and actor_id=actor and operation_id=op and request_payload=q;
  if e.id is null or app.native_mixed_playoff_row_bound_v1(e.id,'evidence')is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 end if;
 own_state:=app.get_native_mixed_playoff_own_v1(tid,eid);
 if own_state->>'status'is distinct from'simulated_playoff_own_available'or own_state->>'contextId'is distinct from d->>'contextId'or own_state->>'sourceDigest'is distinct from q->>'expectedSourceDigest'then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if e.id is not null then
  attempt:=app.native_mixed_playoff_active_attempt_v1(e.context_id,e.slot,e.game_number);old_attempt:=app.native_mixed_playoff_entry_attempt_v1(e.id);
  if attempt is not distinct from old_attempt then return base||jsonb_build_object('status','accepted','receipt',r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false),'currentOwnState',own_state,'currentSourceVerified',true);end if;
  if attempt is not null and coalesce((select version from app.native_mixed_playoff_reopens_v1 where id=old_attempt),0)<(select version from app.native_mixed_playoff_reopens_v1 where id=attempt)
  and app.native_mixed_playoff_reopen_bound_v1(attempt)is true then return base||jsonb_build_object('status','superseded','receipt',r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false),'reopenId',attempt,'currentOwnState',own_state,'currentSourceVerified',true);end if;
  return jsonb_build_object('status','blocked','code','operation_history_unavailable');
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true or exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where actor_id=actor and operation_id=op)then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 if d#>>'{entry,type}'<>'digital-submit'or app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','not_found');end if;
 p:=app.native_mixed_playoff_progress_v1((d->>'contextId')::uuid,(d->>'slot')::integer);m:=p->'match';
 if p is null or p->'complete'='true'::jsonb or p->'nextGameNumber'<>d->'gameNumber'or m->'matchDigest'<>d->'expectedMatchDigest'then return jsonb_build_object('status','not_found');end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into h,rev from app.native_mixed_playoff_active_evidence_v1((d->>'contextId')::uuid,(d->>'slot')::integer,(d->>'gameNumber')::integer);
 hd:=app.native_mixed_playoff_attempt_digest_v1((d->>'contextId')::uuid,(d->>'slot')::integer,(d->>'gameNumber')::integer,m->>'matchDigest',h,app.native_mixed_playoff_active_attempt_v1((d->>'contextId')::uuid,(d->>'slot')::integer,(d->>'gameNumber')::integer));
 if rev<>(d->>'expectedRevision')::integer or hd<>d->>'expectedHistoryDigest'then return jsonb_build_object('status','not_found');end if;
 candidate:=app.native_mixed_playoff_progress_v1((d->>'contextId')::uuid,(d->>'slot')::integer,jsonb_build_object('gameNumber',d->'gameNumber','entry',jsonb_build_object('id',op,'actorId',actor)||(d->'entry')));
 if candidate is null or(candidate->'games'->-1)->'reviewRequired'is distinct from'true'::jsonb then return jsonb_build_object('status','not_found');end if;
 return base||jsonb_build_object('status','retry-original','currentOwnState',own_state,'currentSourceVerified',true);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.close_native_mixed_playoff_own_operation_v1(tid uuid,eid uuid,op uuid,q jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;r app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;d jsonb:=q->'data';p jsonb;source jsonb;h jsonb;proof jsonb;hd text;rev integer;code text;rid uuid;idv uuid;response jsonb;begin
 if app.native_mixed_playoff_reopen_enabled_v1()is distinct from true or op is null then return null;end if;
 actor:=app.native_mixed_playoff_own_request_subject_v1(tid,eid,q,true);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if r.id is not null then
  if app.native_mixed_playoff_own_closure_bound_v1(r,actor,tid,eid,op,q)is true then return r.response_payload||jsonb_build_object('historicalReceipt',true);end if;
  return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share row exclusive mode nowait;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true or exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where actor_id=actor and operation_id=op)then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=(d->>'contextId')::uuid;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 if c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'then code:='source_changed';
 else
  p:=app.native_mixed_playoff_progress_v1(c.id,(d->>'slot')::integer);if p is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  if p->'complete'='true'::jsonb or p->'nextGameNumber'<>d->'gameNumber'or p#>'{match,matchDigest}'<>d->'expectedMatchDigest'then code:='match_or_game_changed';
  else
   select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into h,rev from app.native_mixed_playoff_active_evidence_v1(c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer);
   hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer,d->>'expectedMatchDigest',h,app.native_mixed_playoff_active_attempt_v1(c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer));
   if rev<>(d->>'expectedRevision')::integer or hd<>d->>'expectedHistoryDigest'then code:='history_changed';end if;
  end if;
 end if;
 if code is null then return jsonb_build_object('status','blocked','code','request_still_current');end if;
 if app.native_mixed_playoff_own_request_subject_v1(tid,eid,q,true)is distinct from actor then raise exception 'Playoff closure authorization changed';end if;
 rid:=extensions.gen_random_uuid();idv:=extensions.gen_random_uuid();proof:=jsonb_build_object('sourceDigest',source->'sourceDigest','progress',p,'revision',rev,'historyDigest',hd,'code',code);
 response:=jsonb_build_object('kind','native-mixed-playoff-own-closure-receipt-v1','status','closed','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',tid,'eventId',eid,'operationId',op,'request',q,'code',code,'historicalReceipt',false,'currentSourceVerified',false,'writeAuthorized',false,'noWriteCommitted',true,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_own_closure_v1',idv,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,q)),op,'rejected',response,clock_timestamp());
 insert into app.native_mixed_playoff_own_closures_v1(id,tournament_id,event_id,context_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,proof_capture,response_payload,record_digest)
 values(idv,tid,eid,c.id,actor,(auth.jwt()->>'session_id')::uuid,op,rid,q,proof,response,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-own-closure-record-v1',idv,tid,eid,c.id,actor,(auth.jwt()->>'session_id')::uuid,op,rid,q,proof,response)));
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_playoff_own_closure',idv,'uncommitted_closed',response);
 select*into r from app.operation_receipts where id=rid;if app.native_mixed_playoff_own_closure_bound_v1(r,actor,tid,eid,op,q)is distinct from true then raise exception 'Playoff closure postcondition failed';end if;return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function public.get_native_mixed_playoff_reopen_workspace_v1(p_tournament_id uuid,p_event_id uuid,p_context_id uuid,p_slot integer,p_game_number integer)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'then return null;end if;return app.get_native_mixed_playoff_reopen_workspace_v1(p_tournament_id,p_event_id,p_context_id,p_slot,p_game_number);end$$;
create function public.record_native_mixed_playoff_reopen_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'or octet_length(convert_to(p_request::text,'UTF8'))>32768 then return null;end if;return app.record_native_mixed_playoff_reopen_v1(p_tournament_id,p_event_id,p_operation_id,p_request);end$$;
create function public.reconcile_native_mixed_playoff_reopen_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'or octet_length(convert_to(p_request::text,'UTF8'))>32768 then return null;end if;return app.reconcile_native_mixed_playoff_reopen_v1(p_tournament_id,p_event_id,p_operation_id,p_request);end$$;
create function public.get_native_mixed_playoff_own_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'or octet_length(convert_to(p_request::text,'UTF8'))>32768 then return null;end if;return app.get_native_mixed_playoff_own_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request);end$$;
create function public.close_native_mixed_playoff_own_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'or octet_length(convert_to(p_request::text,'UTF8'))>32768 then return null;end if;return app.close_native_mixed_playoff_own_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request);end$$;

-- BEGIN DERIVED FUNCTIONS: build-native-mixed-playoff-reopen-v1.mjs
create or replace function app.native_mixed_playoff_row_bound_v1(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare v jsonb;r app.operation_receipts%rowtype;q jsonb;d jsonb;expected_entry jsonb;artifact jsonb;prior_history jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;begin
 if kind='context'then select to_jsonb(x)into v from app.native_mixed_playoff_contexts_v1 x where id=row_id;
 elsif kind='evidence'then select to_jsonb(x)into v from app.native_mixed_playoff_all_evidence_v1() x where id=row_id;else return false;end if;
 if v is null then return false;end if;
 if kind='evidence'and app.native_mixed_playoff_entry_attempt_v1(row_id)is not null and app.native_mixed_playoff_reopen_bound_v1(app.native_mixed_playoff_entry_attempt_v1(row_id))is distinct from true then return false;end if;
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

create or replace function app.native_mixed_playoff_game_v1(capture jsonb,participants jsonb,history jsonb)returns jsonb
language plpgsql immutable set search_path=''set timezone='UTC'as $$
declare e jsonb;p jsonb;item jsonb;submissions jsonb:='[]';confirmed jsonb:='[]';digital jsonb;paper jsonb;capture_entry jsonb;review_entry jsonb;
 disputed boolean:=false;winner text;refs jsonb;own_pid text;action text;actor text;roles jsonb;begin
 if jsonb_typeof(history)is distinct from'array'then return null;end if;
 if jsonb_array_length(history)>6 then return null;end if;
 if jsonb_typeof(participants)is distinct from'array'then return null;end if;
 if jsonb_array_length(participants)<>2 then return null;end if;
 if exists(select 1 from jsonb_array_elements(history)x where jsonb_typeof(x)is distinct from'object'
  or app.native_mixed_simulation_uuid_v1(x->>'id')is distinct from true or app.native_mixed_simulation_uuid_v1(x->>'actorId')is distinct from true)
  or(select count(distinct x->>'id')from jsonb_array_elements(history)x)<>jsonb_array_length(history)then return null;end if;
 select coalesce(jsonb_agg(x->'participantId'),'[]')into digital from jsonb_array_elements(capture->'seeds')x where participants? (x->>'participantId')and x->>'mode'='digital';
 select coalesce(jsonb_agg(x->'participantId'),'[]')into paper from jsonb_array_elements(capture->'seeds')x where participants? (x->>'participantId')and x->>'mode'='paper';
 if jsonb_array_length(digital)+jsonb_array_length(paper)<>2 then return null;end if;
 for e in select value from jsonb_array_elements(history)loop
  if disputed then return null;end if;
  action:=e->>'type';actor:=e->>'actorId';p:=e-'id'-'type'-'actorId';
  select x->>'participantId'into own_pid from jsonb_array_elements(capture->'roster')x where x->>'profileId'=actor and x->>'mode'='digital'and participants?(x->>'participantId');
  if action='digital-submit'then
   if not app.native_mixed_pool_exact_v1(p,array['participantId','winnerParticipantId','statement'])or p->>'statement'is distinct from'simulation-own-playoff-result-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid)
    or not(participants?(p->>'winnerParticipantId'))or jsonb_array_length(confirmed)>0 then return null;end if;
   if winner is not null and winner<>p->>'winnerParticipantId'then disputed:=true;end if;
   winner:=p->>'winnerParticipantId';submissions:=submissions||jsonb_build_array(e);
  elsif action='digital-confirm'then
   select coalesce(jsonb_agg(x->'id'order by x->>'id'),'[]')into refs from jsonb_array_elements(history)x where x->>'type'in('digital-submit','paper-capture','paper-review')and(x->>'id')<>(e->>'id');
   -- The current prefix must be complete before a confirmation is admitted.
   if not app.native_mixed_pool_exact_v1(p,array['participantId','submissionId','winnerParticipantId','evidenceIds','statement'])or p->>'statement'is distinct from'simulation-own-playoff-confirmation-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'submissionId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or jsonb_array_length(submissions)<>jsonb_array_length(digital)
    or(jsonb_array_length(paper)>0 and review_entry is null)or winner is null or winner is distinct from p->>'winnerParticipantId'
    or not exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid and x->>'id'=p->>'submissionId')
    or confirmed?own_pid or p->'evidenceIds'is distinct from refs then return null;end if;
   confirmed:=confirmed||jsonb_build_array(own_pid);
  elsif action='paper-capture'then
   if jsonb_typeof(p->'claims')is distinct from'array'then return null;end if;
   if not app.native_mixed_pool_exact_v1(p,array['artifactId','artifactDigest','claims','statement'])or p->>'statement'is distinct from'fictional-playoff-paper-capture-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'artifactId')is distinct from true or coalesce(p->>'artifactDigest','')!~'^[a-f0-9]{64}$'
    or jsonb_array_length(paper)=0 or own_pid is not null or capture_entry is not null or jsonb_typeof(p->'claims')is distinct from'array'
    or jsonb_array_length(p->'claims')<>jsonb_array_length(paper)then return null;end if;
   if(select count(distinct x->>'participantId')from jsonb_array_elements(p->'claims')x)<>jsonb_array_length(paper)then return null;end if;
   for item in select value from jsonb_array_elements(p->'claims')loop
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))then return null;end if;if winner is not null and winner<>item->>'winnerParticipantId'then disputed:=true;end if;winner:=item->>'winnerParticipantId';end loop;
   capture_entry:=e;
  elsif action='paper-review'then
   if not(app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','statement'])or app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement']))or p->>'statement'is distinct from'fictional-playoff-paper-review-v1'
    or capture_entry is null or review_entry is not null or actor=capture_entry->>'actorId'or own_pid is not null
    or p->'captureId'is distinct from capture_entry->'id'or p->'artifactId'is distinct from capture_entry->'artifactId'or p->'artifactDigest'is distinct from capture_entry->'artifactDigest'
    or jsonb_typeof(p->'reenteredClaims')is distinct from'array'then return null;end if;
   if jsonb_array_length(p->'reenteredClaims')<>jsonb_array_length(paper)or(select count(distinct x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)<>jsonb_array_length(paper)then return null;end if;
   for item in select value from jsonb_array_elements(p->'reenteredClaims')loop
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))then return null;end if;
   end loop;
   if not(p?'decision')then if p->'reenteredClaims'is distinct from capture_entry->'claims'then return null;end if;
   elsif p->>'decision'='accepted-simulation-only'then
    if(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then return null;end if;
   elsif p->>'decision'='disputed-simulation-only'then
    if jsonb_array_length(confirmed)>0 or(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is not distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then return null;end if;disputed:=true;
   else return null;end if;review_entry:=e;
  else return null;end if;
 end loop;
 if disputed then return jsonb_build_object('complete',false,'winnerId',null,'reviewRequired',true);end if;
 return jsonb_build_object('complete',winner is not null and jsonb_array_length(submissions)=jsonb_array_length(digital)
  and jsonb_array_length(confirmed)=jsonb_array_length(digital)and(jsonb_array_length(paper)=0 or review_entry is not null),'winnerId',winner);
end$$;

create or replace function app.native_mixed_playoff_progress_v1(context_value uuid,slot_value integer,extra jsonb default null)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;history jsonb;games jsonb:='[]';g jsonb;v record;n integer:=0;last_game integer:=0;
 wins_a integer:=0;wins_b integer:=0;winner text;limit_wins integer;hd text;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;m:=app.native_mixed_playoff_match_v1(context_value,slot_value);if c.id is null or m is null then return null;end if;
 limit_wins:=(m#>>'{format,winsRequired}')::integer;
 for n in select distinct game_number from app.native_mixed_playoff_all_evidence_v1() where context_id=context_value and slot=slot_value
  union select game_number from app.native_mixed_playoff_reopens_v1 where context_id=context_value and slot=slot_value
  union select(extra->>'gameNumber')::integer where extra is not null order by 1 loop
  if winner is not null or n<>last_game+1 or n>(m#>>'{format,maximumGames}')::integer then return null;end if;
  for v in select id,match_digest from app.native_mixed_playoff_active_evidence_v1(context_value,slot_value,n)where context_id=context_value and slot=slot_value and game_number=n loop
   if v.match_digest<>m->>'matchDigest'or app.native_mixed_playoff_row_bound_v1(v.id,'evidence')is distinct from true then return null;end if;end loop;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into history from app.native_mixed_playoff_active_evidence_v1(context_value,slot_value,n)where context_id=context_value and slot=slot_value and game_number=n;
  if extra is not null and n=(extra->>'gameNumber')::integer then history:=history||jsonb_build_array(extra->'entry');end if;
  g:=app.native_mixed_playoff_game_v1(c.source_capture,m->'participants',history);if g is null then return null;end if;
  hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,slot_value,n,m->>'matchDigest',history,app.native_mixed_playoff_active_attempt_v1(c.id,slot_value,n));
  games:=games||jsonb_build_array(jsonb_build_object('gameNumber',n,'revision',jsonb_array_length(history),'historyDigest',hd,'complete',g->'complete','winnerId',g->'winnerId')||case when g->'reviewRequired'='true'::jsonb then jsonb_build_object('reviewRequired',true)else'{}'::jsonb end);
  if g->'complete'is distinct from'true'::jsonb then
   if exists(select 1 from app.native_mixed_playoff_all_evidence_v1() where context_id=context_value and slot=slot_value and game_number>n)or(extra is not null and(extra->>'gameNumber')::integer>n)then return null;end if;
   return jsonb_build_object('match',m,'games',games,'complete',false,'winsA',wins_a,'winsB',wins_b,'nextGameNumber',n,'winnerId',null);
  end if;
  if g->>'winnerId'=m#>>'{participants,0}'then wins_a:=wins_a+1;else wins_b:=wins_b+1;end if;
  if wins_a=limit_wins or wins_b=limit_wins then winner:=g->>'winnerId';end if;last_game:=n;
 end loop;
 return jsonb_build_object('match',m,'games',games,'complete',winner is not null,'winsA',wins_a,'winsB',wins_b,'nextGameNumber',case when winner is null then last_game+1 else null end,'winnerId',winner);
end$$;

create or replace function app.native_mixed_playoff_result_bound_v1(result_value uuid)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare r app.native_mixed_playoff_results_v1%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;
 p jsonb;m jsonb;body jsonb;loser uuid;last_e app.native_mixed_playoff_evidence_v1%rowtype;begin
 select*into r from app.native_mixed_playoff_results_v1 where id=result_value;if r.id is null then return false;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=r.context_id;
 if c.id is null or r.tournament_id<>c.tournament_id or r.event_id<>c.event_id or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return false;end if;
 p:=app.native_mixed_playoff_progress_v1(c.id,r.slot);if p is null or p->'complete'is distinct from'true'::jsonb then return false;end if;m:=p->'match';
 loser:=case when p->>'winnerId'=m#>>'{participants,0}'then(m#>>'{participants,1}')::uuid else(m#>>'{participants,0}')::uuid end;
 body:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'sourceDigest',c.source_digest,'slot',r.slot,'match',m,'progress',p,'winnerId',(p->>'winnerId')::uuid,'loserId',loser,'simulationOnly',true);
 select*into last_e from app.native_mixed_playoff_all_evidence_v1() where context_id=c.id and slot=r.slot and app.native_mixed_playoff_entry_attempt_v1(id)is not distinct from app.native_mixed_playoff_active_attempt_v1(c.id,r.slot,game_number)order by game_number desc,sequence desc limit 1;
 return r.source_capture=body and r.result_digest=app.native_mixed_simulation_hash_v1(body)and r.match_digest=m->>'matchDigest'
  and r.winner_id=(p->>'winnerId')::uuid and r.loser_id=loser and last_e.receipt_id=r.receipt_id
  and app.native_mixed_playoff_row_bound_v1(last_e.id,'evidence')is true;
end$$;

create or replace function app.execute_native_mixed_playoff_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;action text;data jsonb;source jsonb;old app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;
 e app.native_mixed_playoff_evidence_v1%rowtype;m jsonb;progress jsonb;history jsonb;revision integer;hd text;request_hash text;
 entry_value jsonb;payload jsonb;authority jsonb;roles jsonb;binding app.paper_official_identity_bindings%rowtype;
 rid uuid:=extensions.gen_random_uuid();idv uuid:=extensions.gen_random_uuid();ctxid uuid;slot_no integer;game_no integer;
 typ text;own_pid uuid;response jsonb;kind text;artifact jsonb;result_id uuid;winner uuid;loser uuid;cohorts jsonb;result_capture jsonb;is_director boolean;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-playoff-request-v1'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or length(request->>'reason')not between 1 and 500 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 action:=request->>'action';data:=request->'data';if action is null or action not in('create-context','game-action')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.roster_account_links,app.event_participants in share mode nowait;
 select coalesce(jsonb_agg(role order by role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 is_director:=roles?'director';
 if action='create-context'and not is_director then return null;end if;
 if action='game-action'then
  if not app.native_mixed_pool_exact_v1(data,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])
   or app.native_mixed_simulation_uuid_v1(data->>'contextId')is distinct from true
   or jsonb_typeof(data->'slot')is distinct from'number'or coalesce(data->>'slot','')!~'^[1-4]$'
   or jsonb_typeof(data->'gameNumber')is distinct from'number'or coalesce(data->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'
   or(data->>'gameNumber')::integer>2500 or coalesce(data->>'expectedMatchDigest','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(data->'expectedRevision')is distinct from'number'or coalesce(data->>'expectedRevision','')!~'^[0-5]$'
   or coalesce(data->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(data->'entry')is distinct from'object'
  then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  ctxid:=(data->>'contextId')::uuid;slot_no:=(data->>'slot')::integer;game_no:=(data->>'gameNumber')::integer;typ:=data#>>'{entry,type}';
  select*into c from app.native_mixed_playoff_contexts_v1 where id=ctxid and tournament_id=tid and event_id=eid;
  m:=app.native_mixed_playoff_match_v1(ctxid,slot_no);if c.id is null or m is null then return jsonb_build_object('status','rejected','code','parent_or_context_unavailable');end if;
  if typ is null or typ not in('digital-submit','digital-confirm','paper-capture','paper-review')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  select(p->>'participantId')::uuid into own_pid from jsonb_array_elements(c.source_capture->'roster')p
   where p->>'mode'='digital'and p->>'profileId'=actor::text and m->'participants'?(p->>'participantId')
   and exists(select 1 from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id and l.profile_id=ep.profile_id where ep.id=(p->>'participantId')::uuid and ep.tournament_id=tid and ep.event_id=eid and ep.profile_id=actor);
  if typ in('digital-submit','digital-confirm')then if own_pid is null then return null;end if;
  else
   if own_pid is not null or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true
    or(typ='paper-capture'and not(roles?'cross_checker'))or(typ='paper-review'and not(roles?|array['director','co_director','cross_checker']))then return null;end if;
   select*into binding from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
   if binding.id is null or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and m->'participants'?p.id::text and(p.profile_id=actor or p.roster_entry_id=binding.roster_entry_id))then return null;end if;
  end if;
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 request_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,request));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if old.id is not null then
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_playoff_v1'or old.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  kind:=case action when'create-context'then'context'else'evidence'end;
  if app.native_mixed_playoff_row_bound_v1(old.target_id,kind)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null or source->>'sourceDigest'<>request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share row exclusive mode nowait;
 if action='create-context'then
  if not app.native_mixed_pool_exact_v1(data,array[]::text[])then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if exists(select 1 from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','context_already_exists');end if;
  response:=jsonb_build_object('status','simulated_playoff_context_created','contextId',idv,'sourceDigest',source->>'sourceDigest',
   'contextDigest',app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',idv,tid,eid,(source#>>'{capture,startId}')::uuid,source->>'sourceDigest')),
   'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  insert into app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id,start_id,actor_id,operation_id,receipt_id,request_payload,request_hash,source_capture,source_digest,context_digest,response_payload)
   values(idv,tid,eid,(source#>>'{capture,startId}')::uuid,actor,op,rid,request,request_hash,source->'capture',source->>'sourceDigest',response->>'contextDigest',response);kind:='context';
 else
  if c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return jsonb_build_object('status','rejected','code','source_changed');end if;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no);
  if progress is null or progress->'complete'='true'::jsonb or(progress->>'nextGameNumber')::integer<>game_no or m->>'matchDigest'<>data->>'expectedMatchDigest'then return jsonb_build_object('status','rejected','code','match_or_game_changed');end if;
  select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into history,revision from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,game_no) where context_id=c.id and slot=slot_no and game_number=game_no;
  hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,slot_no,game_no,m->>'matchDigest',history,app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no));
  if revision<>(data->>'expectedRevision')::integer or hd<>data->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
  if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then return jsonb_build_object('status','rejected','code','playoffs_complete');end if;
  if exists(select 1 from jsonb_array_elements(progress->'games')g where g->'gameNumber'=data->'gameNumber'and g->'reviewRequired'='true'::jsonb)then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  payload:=(data->'entry')-'type';
  if payload?'id'or payload?'actorId'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if typ='paper-capture'then
   if not app.native_mixed_pool_exact_v1(payload,array['artifactId','claims','statement'])or app.native_mixed_simulation_uuid_v1(payload->>'artifactId')is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'claims',payload->'claims','physicalOriginal',false,'actualPlayClaimed',false);
   payload:=payload||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
   if exists(select 1 from app.native_mixed_playoff_all_evidence_v1() where entry->>'artifactId'=payload->>'artifactId'and entry->>'type'='paper-capture')then return jsonb_build_object('status','rejected','code','artifact_already_used');end if;
  end if;
  authority:=jsonb_build_object('actorId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles,'paperIdentityBinding',case when typ in('paper-capture','paper-review')then to_jsonb(binding)else null end,'simulationOnly',true);
  entry_value:=jsonb_build_object('id',idv,'type',typ,'actorId',actor)||payload;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no,jsonb_build_object('gameNumber',game_no,'entry',entry_value));if progress is null then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  if(progress->'games'->-1)->'reviewRequired'='true'::jsonb and app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','retry_exact','code','playoff_disagreement_unavailable');end if;
  history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,slot_no,game_no,m->>'matchDigest',history,app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no));
  response:=jsonb_build_object('status','simulated_playoff_evidence_recorded','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'entryId',idv,'revision',revision+1,'historyDigest',hd,'sourceDigest',c.source_digest,'matchDigest',m->>'matchDigest','gameComplete',(progress->'games'->-1)->'complete','matchComplete',progress->'complete','winnerId',progress->'winnerId','simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  if app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no)is null then
  insert into app.native_mixed_playoff_evidence_v1(id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);
  else insert into app.native_mixed_playoff_attempt_evidence_v1(attempt_id,id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no),idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);end if;kind:='evidence';
  if progress->'complete'='true'::jsonb then
   winner:=(progress->>'winnerId')::uuid;loser:=case when winner=(m#>>'{participants,0}')::uuid then(m#>>'{participants,1}')::uuid else(m#>>'{participants,0}')::uuid end;
   result_capture:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'sourceDigest',c.source_digest,'slot',slot_no,'match',m,'progress',progress,'winnerId',winner,'loserId',loser,'simulationOnly',true);
   result_id:=extensions.gen_random_uuid();insert into app.native_mixed_playoff_results_v1(id,context_id,tournament_id,event_id,slot,receipt_id,match_digest,source_capture,result_digest,winner_id,loser_id)
    values(result_id,c.id,tid,eid,slot_no,rid,m->>'matchDigest',result_capture,app.native_mixed_simulation_hash_v1(result_capture),winner,loser);
   if slot_no=4 then
    select jsonb_build_array(jsonb_build_object('firstPlace',1,'lastPlace',1,'participantIds',jsonb_build_array(winner)),jsonb_build_object('firstPlace',2,'lastPlace',2,'participantIds',jsonb_build_array(loser)),
     jsonb_build_object('firstPlace',3,'lastPlace',4,'participantIds',(select jsonb_agg(loser_id order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot in(2,3))),
     jsonb_build_object('firstPlace',5,'lastPlace',5,'participantIds',(select jsonb_agg(loser_id)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1)))into cohorts;
    result_capture:=jsonb_build_object('contextId',c.id,'sourceDigest',c.source_digest,'finishingGroups',cohorts,'resultPins',(select jsonb_agg(jsonb_build_object('id',id,'slot',slot,'digest',result_digest)order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
    insert into app.native_mixed_playoff_completions_v1(context_id,tournament_id,event_id,receipt_id,source_capture,source_digest)values(c.id,tid,eid,rid,result_capture,app.native_mixed_simulation_hash_v1(result_capture));
   end if;
  end if;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_playoff_simulation',idv,kind,response);
 if app.native_mixed_playoff_row_bound_v1(idv,kind)is distinct from true then raise exception 'mixed playoff receipt postcondition failed';end if;
 if result_id is not null and app.native_mixed_playoff_result_bound_v1(result_id)is distinct from true then raise exception 'mixed playoff result postcondition failed';end if;
 if slot_no=4 and result_id is not null and app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then raise exception 'mixed playoff completion postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.get_native_mixed_playoff_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;source jsonb;matches jsonb:='[]';m jsonb;i integer;response jsonb;begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')for share nowait;if not found then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
  app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 if c.id is null then response:=jsonb_build_object('status','source_available','source',source);
 else
 if c.source_capture is distinct from source->'capture'or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return jsonb_build_object('status','blocked','code','source_changed');end if;
 for i in 1..4 loop
  if exists(select 1 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=i and app.native_mixed_playoff_result_bound_v1(id)is distinct from true)then return jsonb_build_object('status','blocked','code','result_history_changed');end if;
  m:=app.native_mixed_playoff_progress_v1(c.id,i);matches:=matches||jsonb_build_array(jsonb_build_object('slot',i,'projection',m));end loop;
 if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)and app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','completion_history_changed');end if;
 response:=jsonb_build_object('status','simulated_playoffs_available','contextId',c.id,'contextDigest',c.context_digest,'source',source,'matches',matches,
  'completion',(select source_capture from app.native_mixed_playoff_completions_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.get_native_mixed_playoff_own_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;source jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;
 own_person jsonb;own_id uuid;mine jsonb;other_person jsonb;other_id uuid;
 m jsonb;p jsonb;g jsonb;e jsonb;item jsonb;entries jsonb;games jsonb;next_game jsonb;matches jsonb:='[]';
 slot_no integer;own_place jsonb;own_submitted boolean;finished boolean:=false;eliminated boolean:=false;open_match boolean:=false;answer jsonb;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 select value into own_person from jsonb_array_elements(source#>'{capture,roster}')x
 where x->>'mode'='digital'and x->>'profileId'=actor::text;
 if own_person is null then return null;end if;own_id:=(own_person->>'participantId')::uuid;
 mine:=jsonb_build_object('participantId',own_id,'tournamentIdNumber',own_person->'fixedTournamentId');
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
  app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 if c.id is null then answer:=jsonb_build_object('status','awaiting_playoff_preparation','own',mine);
 else
  if c.source_digest is distinct from source->>'sourceDigest'or c.source_capture is distinct from source->'capture'
   or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true
  then return jsonb_build_object('status','blocked','code','source_changed');end if;
  if not exists(select 1 from jsonb_array_elements(c.source_capture->'seeds')x where x->>'participantId'=own_id::text)
  then answer:=jsonb_build_object('status','not_in_simulated_playoffs','own',mine);
  else
   for slot_no in 1..4 loop
    m:=app.native_mixed_playoff_match_v1(c.id,slot_no);
    if m is null or not(m->'participants'?own_id::text)then continue;end if;
    p:=app.native_mixed_playoff_progress_v1(c.id,slot_no);if p is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    select value into other_person from jsonb_array_elements(c.source_capture->'roster')x
     where m->'participants'?(x->>'participantId')and x->>'participantId'<>own_id::text;
    if other_person is null then return jsonb_build_object('status','blocked','code','opponent_unavailable');end if;
    other_id:=(other_person->>'participantId')::uuid;
    games:='[]';
    for g in select value from jsonb_array_elements(p->'games')loop
     entries:='[]';
     select exists(select 1 from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)where context_id=c.id and slot=slot_no
      and game_number=(g->>'gameNumber')::integer and entry->>'type'='digital-submit'
      and entry->>'participantId'=own_id::text and actor_id=actor)into own_submitted;
     for e in select entry from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)where context_id=c.id and slot=slot_no
       and game_number=(g->>'gameNumber')::integer and own_submitted order by sequence loop
      -- Explicit projection: never return actor/session/profile, authority capture,
      -- request payload, roster contact/ACC fields, or unrelated game evidence.
      item:=jsonb_build_object('id',e->'id','type',e->'type');
      if e->>'type'='digital-submit'then item:=item||jsonb_build_object('participantId',e->'participantId','winnerParticipantId',e->'winnerParticipantId');
      elsif e->>'type'='digital-confirm'then item:=item||jsonb_build_object('participantId',e->'participantId','submissionId',e->'submissionId','winnerParticipantId',e->'winnerParticipantId','evidenceIds',e->'evidenceIds');
      elsif e->>'type'='paper-capture'then item:=item||jsonb_build_object('artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','claims',e->'claims');
      elsif e->>'type'='paper-review'then item:=item||jsonb_build_object('captureId',e->'captureId','artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','reenteredClaims',e->'reenteredClaims')||case when e?'decision'then jsonb_build_object('decision',e->'decision')else'{}'::jsonb end;
      else return jsonb_build_object('status','blocked','code','history_unavailable');end if;
      entries:=entries||jsonb_build_array(item);
     end loop;
     games:=games||jsonb_build_array(jsonb_build_object('gameNumber',g->'gameNumber','complete',case when own_submitted then g->'complete'else'false'::jsonb end,
      'winnerParticipantId',case when own_submitted then g->'winnerId'else'null'::jsonb end,
      'revision',g->'revision','historyDigest',g->'historyDigest','counterEvidenceAvailable',own_submitted,'entries',entries,'reviewRequired',coalesce(g->'reviewRequired','false'::jsonb)));
    end loop;
    if p->'complete'='true'::jsonb and p->>'winnerId'<>own_id::text then eliminated:=true;end if;
    if p->'complete'='false'::jsonb then open_match:=true;end if;
    next_game:=null;
    if p->'complete'='false'::jsonb then
     select value into g from jsonb_array_elements(p->'games')x where x->'gameNumber'=p->'nextGameNumber';
     next_game:=jsonb_build_object('gameNumber',p->'nextGameNumber','expectedRevision',coalesce(g->'revision','0'::jsonb),
      'expectedHistoryDigest',coalesce(g->'historyDigest',to_jsonb(app.native_mixed_simulation_hash_v1(jsonb_build_array(
       'native-mixed-playoff-game-history-v1',c.id,slot_no,(p->>'nextGameNumber')::integer,m->>'matchDigest','[]'::jsonb)))));
    end if;
    matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'matchDigest',m->'matchDigest','format',m->'format',
     'own',mine,'opponent',jsonb_build_object('participantId',other_id,'tournamentIdNumber',other_person->'fixedTournamentId',
      'mode',other_person->'mode',
      'displayName',(select claimed_display_name from app.tournament_roster_entries where id=(other_person->>'rosterEntryId')::uuid and tournament_id=tid)),
     'complete',p->'complete','winnerParticipantId',p->'winnerId','nextGame',next_game,'games',games,
     'ownWins',case when m#>>'{participants,0}'=own_id::text then p->'winsA'else p->'winsB'end,
     'opponentWins',case when m#>>'{participants,0}'=own_id::text then p->'winsB'else p->'winsA'end));
   end loop;
   if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then
    if app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    finished:=true;
    select jsonb_build_object('firstPlace',x->'firstPlace','lastPlace',x->'lastPlace')into own_place
     from app.native_mixed_playoff_completions_v1 completion_row cross join lateral jsonb_array_elements(completion_row.source_capture->'finishingGroups')x
     where completion_row.context_id=c.id and x->'participantIds'?own_id::text;
    if own_place is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
   end if;
   answer:=jsonb_build_object('status','simulated_playoff_own_available','contextId',c.id,'sourceDigest',source->'sourceDigest',
    'own',mine,'matches',matches,'complete',finished,'eliminated',eliminated,'awaitingOpponent',not finished and not eliminated and not open_match,'ownFinishingGroup',own_place);
  end if;
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 return answer||jsonb_build_object('tournamentId',tid,'eventId',eid,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;
alter function app.native_mixed_playoff_disagreement_enabled_v1()owner to postgres;
revoke all on function app.native_mixed_playoff_disagreement_enabled_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_reopen_enabled_v1()owner to postgres;
revoke all on function app.native_mixed_playoff_reopen_enabled_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_reopen_request_valid_v1(jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_reopen_request_valid_v1(jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_all_evidence_v1()owner to postgres;
revoke all on function app.native_mixed_playoff_all_evidence_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_entry_attempt_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_playoff_entry_attempt_v1(uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_attempt_history_v1(uuid,integer,integer,uuid)owner to postgres;
revoke all on function app.native_mixed_playoff_attempt_history_v1(uuid,integer,integer,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_attempt_digest_v1(uuid,integer,integer,text,jsonb,uuid)owner to postgres;
revoke all on function app.native_mixed_playoff_attempt_digest_v1(uuid,integer,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_reopen_bound_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_playoff_reopen_bound_v1(uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_active_attempt_v1(uuid,integer,integer)owner to postgres;
revoke all on function app.native_mixed_playoff_active_attempt_v1(uuid,integer,integer)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_active_evidence_v1(uuid,integer,integer)owner to postgres;
revoke all on function app.native_mixed_playoff_active_evidence_v1(uuid,integer,integer)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_reopen_subject_v1(uuid,uuid,uuid,integer,integer,boolean)owner to postgres;
revoke all on function app.native_mixed_playoff_reopen_subject_v1(uuid,uuid,uuid,integer,integer,boolean)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_reopen_block_v1(uuid,integer,integer)owner to postgres;
revoke all on function app.native_mixed_playoff_reopen_block_v1(uuid,integer,integer)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_display_entry_v1(jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_display_entry_v1(jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_reopen_workspace_v1(uuid,uuid,uuid,integer,integer)owner to postgres;
revoke all on function app.get_native_mixed_playoff_reopen_workspace_v1(uuid,uuid,uuid,integer,integer)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_reopen_receipt_bound_v1(app.operation_receipts,uuid,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_reopen_receipt_bound_v1(app.operation_receipts,uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.record_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.record_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.reconcile_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.reconcile_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_own_request_subject_v1(uuid,uuid,jsonb,boolean)owner to postgres;
revoke all on function app.native_mixed_playoff_own_request_subject_v1(uuid,uuid,jsonb,boolean)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_own_closure_bound_v1(app.operation_receipts,uuid,uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_own_closure_bound_v1(app.operation_receipts,uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.get_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.close_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.close_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_playoff_reopen_workspace_v1(uuid,uuid,uuid,integer,integer)owner to postgres;
revoke all on function public.get_native_mixed_playoff_reopen_workspace_v1(uuid,uuid,uuid,integer,integer)from public,anon,authenticated,service_role;
alter function public.record_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.record_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.reconcile_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.reconcile_native_mixed_playoff_reopen_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.get_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.close_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.close_native_mixed_playoff_own_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_row_bound_v1(uuid,text)owner to postgres;
revoke all on function app.native_mixed_playoff_row_bound_v1(uuid,text)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_progress_v1(uuid,integer,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_progress_v1(uuid,integer,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_result_bound_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_playoff_result_bound_v1(uuid)from public,anon,authenticated,service_role;
alter function app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_v1(uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_playoff_v1(uuid,uuid)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_own_v1(uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_playoff_own_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
