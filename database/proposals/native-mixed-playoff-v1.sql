-- PRIVATE / DEFAULT-OFF LOCAL CANDIDATE. Separate synthetic five-player playoffs.
-- Does not create ordinary qualification, canonical games, genuine series,
-- MRPs, prize liabilities, receipts for money, or payments. No application grants.
begin;
create function app.native_mixed_playoff_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

-- Keep the actual caller subject and every existing root/funding/game check.
-- Only sporting Director authority comes from the exact immutable Start row.
do $clone$
declare original text;candidate text;old text;replacement text;
begin
 original:=replace(pg_get_functiondef('app.native_mixed_qualification_review_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 if encode(extensions.digest(original,'sha256'),'hex')<>'e326b89c4d21a982a324e04c5a9a229f016350e9f666234debdccaf5c7ac2bdd' then raise exception 'mixed playoff review definition changed';end if;
 old:=E' perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor\n  and role in(''director'',''co_director'')for share nowait;';
 replacement:=E' perform 1 from app.tournament_roles role_row join app.native_mixed_simulation_starts_v1 start_row\n  on start_row.id=sid and start_row.tournament_id=tid and start_row.event_id=eid\n  where role_row.tournament_id=tid and role_row.profile_id=start_row.actor_id and role_row.role=''director''\n  for share of role_row,start_row nowait;';
 if (length(original)-length(replace(original,old,'')))/length(old)<>1 then raise exception 'mixed playoff caller-role anchor changed';end if;
 candidate:=replace(original,'FUNCTION app.native_mixed_qualification_review_v1(','FUNCTION app.native_mixed_playoff_review_v1(');
 if candidate=original then raise exception 'mixed playoff review name anchor changed';end if;
 candidate:=replace(candidate,old,replacement);execute candidate;
 execute 'alter function app.native_mixed_playoff_review_v1(uuid,uuid,uuid)owner to postgres';
 execute 'revoke all on function app.native_mixed_playoff_review_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role';
 if replace(pg_get_functiondef('app.native_mixed_playoff_review_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n')<>candidate
  or replace(pg_get_functiondef('app.native_mixed_qualification_review_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n')<>original
 then raise exception 'mixed playoff clone postcondition changed';end if;
end$clone$;

create table app.native_mixed_playoff_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 start_id uuid not null,actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 receipt_id uuid not null unique,request_payload jsonb not null,request_hash text not null,
 source_capture jsonb not null,source_digest text not null,context_digest text not null,response_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(start_id)references app.native_mixed_simulation_starts_v1(id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(source_digest=app.native_mixed_simulation_hash_v1(source_capture)),
 check(context_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',id,tournament_id,event_id,start_id,source_digest)))
);
create table app.native_mixed_playoff_evidence_v1(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 slot integer not null check(slot between 1 and 4),game_number integer not null check(game_number between 1 and 2500),
 sequence integer not null check(sequence between 1 and 6),actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,operation_id uuid not null,
 receipt_id uuid not null unique,request_payload jsonb not null,request_hash text not null,
 match_digest text not null,entry jsonb not null,authority_capture jsonb not null,entry_digest text not null,response_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(context_id,slot,game_number,sequence),unique(actor_id,operation_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(entry_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',id,context_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,request_payload,match_digest,entry,authority_capture)))
);
create table app.native_mixed_playoff_results_v1(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 slot integer not null check(slot between 1 and 4),receipt_id uuid not null unique,
 match_digest text not null,source_capture jsonb not null,result_digest text not null,
 winner_id uuid not null,loser_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(context_id,slot),unique(id,context_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(winner_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(loser_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(winner_id<>loser_id),check(result_digest=app.native_mixed_simulation_hash_v1(source_capture))
);
create table app.native_mixed_playoff_completions_v1(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null unique,tournament_id uuid not null,event_id uuid not null,
 receipt_id uuid not null unique,source_capture jsonb not null,source_digest text not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(source_digest=app.native_mixed_simulation_hash_v1(source_capture))
);
do $security$declare n text;begin foreach n in array array['native_mixed_playoff_contexts_v1','native_mixed_playoff_evidence_v1','native_mixed_playoff_results_v1','native_mixed_playoff_completions_v1']loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_playoff_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare st app.native_mixed_simulation_starts_v1%rowtype;b app.event_settings_operational_bindings_v1%rowtype;
 a app.tournament_setup_activations%rowtype;s app.event_settings_snapshots_v3%rowtype;
 review jsonb;roster jsonb;seeds jsonb;series jsonb;capture jsonb;assessment jsonb;
begin
 select*into st from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid for share nowait;if st.id is null then return null;end if;
 review:=app.native_mixed_playoff_review_v1(tid,eid,st.id);
 if review->>'status'is distinct from'review_available'or review->'qualificationReady'is distinct from'true'::jsonb
  or review->'tieReviewRequired'is distinct from'false'::jsonb or review->'entrantCount'is distinct from'18'::jsonb or review->'qualifyingCount'is distinct from'5'::jsonb
 then return null;end if;
 lock table app.event_settings_operational_bindings_v1,app.event_settings_snapshots_v3,app.tournament_setup_activations,
 app.roster_account_links,app.event_participants,app.tournament_roster_entries in share mode nowait;
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid;
 select*into s from app.event_settings_snapshots_v3 where id=b.settings_snapshot_id and tournament_id=tid;
 if b.id is null or a.id is null or s.id is null or a.setup_event_version_id<>b.setup_event_version_id
  or b.context->>'eventKind'is distinct from'main'or not exists(select 1 from app.events where id=eid and tournament_id=tid and format='standard_singles'and operational_state='active'and ruleset_version_id=a.ruleset_version_id)
 then return null;end if;
 -- Existing setup assessor expects its original nullable setup context. The
 -- verified review separately proves the actual original field is exactly 18.
 assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);
 if assessment->>'status'is distinct from'eligible'then return null;end if;
 series:=jsonb_build_object('regular',app.resolve_event_series_format_v1(b.draft#>'{series,regular}'),
  'final',app.resolve_event_series_format_v1(case b.draft->>'finalMode'when'same'then b.draft#>'{series,regular}'else b.draft#>'{series,final}'end));
 if series#>>'{regular,winsRequired}'is null or series#>>'{final,winsRequired}'is null
  or(series#>>'{regular,maximumGames}')::integer>2500 or(series#>>'{final,maximumGames}')::integer>2500 then return null;end if;
 select jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,'profileId',p.profile_id,'mode',r.scorecard_type,'fixedTournamentId',x->'fixedId')order by p.id)
 into roster from jsonb_array_elements(st.source_capture->'fixedAssignments')x
 join app.event_participants p on p.id=(x->>'participantId')::uuid and p.event_id=eid and p.tournament_id=tid
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 where p.status='registered'and(r.scorecard_type='paper'and p.profile_id is null or r.scorecard_type='digital'and p.profile_id is not null and exists(select 1 from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id and l.profile_id=p.profile_id));
 if jsonb_array_length(roster)is distinct from 18 or(select count(*)from jsonb_array_elements(roster)x where x->>'mode'='digital')<>6
  or(select count(distinct x->>'participantId')from jsonb_array_elements(roster)x)<>18
  or(select count(distinct x->>'profileId')from jsonb_array_elements(roster)x where x->>'mode'='digital')<>6 then return null;end if;
 select jsonb_agg(r||jsonb_build_object('seed',(c->>'rank')::integer,'gamePoints',c->'gamePoints')order by(c->>'rank')::integer)into seeds
 from jsonb_array_elements(review->'cards')c join jsonb_array_elements(roster)r on r->>'participantId'=c->>'participantId'and r->'fixedTournamentId'=c->'fixedTournamentId'
 where(c->>'rank')::integer between 1 and 5 and c->'tieCount'='1'::jsonb;
 if jsonb_array_length(seeds)is distinct from 5 or(select array_agg((x->>'seed')::integer order by(x->>'seed')::integer)from jsonb_array_elements(seeds)x)is distinct from array[1,2,3,4,5]then return null;end if;
 capture:=jsonb_build_object('kind','native-mixed-playoff-source-v1','tournamentId',tid,'eventId',eid,'startId',st.id,
  'review',review,'settingsBinding',to_jsonb(b),'activation',to_jsonb(a),'settingsSnapshot',to_jsonb(s),'series',series,'roster',roster,'seeds',seeds,
  'ordinaryQualificationRecorded',false,'mrpAwarded',false,'actualMoneyReceived',false,'moneyMoved',false);
 return jsonb_build_object('status','source_available','capture',capture,'sourceDigest',app.native_mixed_simulation_hash_v1(capture));
end$$;

-- Verify immutable rows against the global operation-receipt and audit journal.
create function app.native_mixed_playoff_row_bound_v1(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare v jsonb;r app.operation_receipts%rowtype;q jsonb;d jsonb;expected_entry jsonb;artifact jsonb;prior_history jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;begin
 if kind='context'then select to_jsonb(x)into v from app.native_mixed_playoff_contexts_v1 x where id=row_id;
 elsif kind='evidence'then select to_jsonb(x)into v from app.native_mixed_playoff_evidence_v1 x where id=row_id;else return false;end if;
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
  select coalesce(jsonb_agg(entry order by sequence),'[]')into prior_history from app.native_mixed_playoff_evidence_v1
   where context_id=c.id and slot=(v->>'slot')::integer and game_number=(v->>'game_number')::integer and sequence<(v->>'sequence')::integer;
  if jsonb_array_length(prior_history)<>(v->>'sequence')::integer-1 or d->>'expectedHistoryDigest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history))then return false;end if;
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

create function app.native_mixed_playoff_match_v1(context_value uuid,slot_value integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;p uuid[];parents jsonb:='[]';r1 app.native_mixed_playoff_results_v1%rowtype;r2 app.native_mixed_playoff_results_v1%rowtype;
 series jsonb;body jsonb;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;if c.id is null or slot_value not between 1 and 4 then return null;end if;
 if slot_value=1 then p:=array[(c.source_capture#>>'{seeds,3,participantId}')::uuid,(c.source_capture#>>'{seeds,4,participantId}')::uuid];
 elsif slot_value=2 then select*into r1 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1;if r1.id is null then return null;end if;
  if app.native_mixed_playoff_result_bound_v1(r1.id)is distinct from true then return null;end if;
  p:=array[(c.source_capture#>>'{seeds,0,participantId}')::uuid,r1.winner_id];parents:=jsonb_build_array(jsonb_build_object('id',r1.id,'digest',r1.result_digest));
 elsif slot_value=3 then p:=array[(c.source_capture#>>'{seeds,2,participantId}')::uuid,(c.source_capture#>>'{seeds,1,participantId}')::uuid];
 else select*into r1 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=2;select*into r2 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=3;
  if r1.id is null or r2.id is null then return null;end if;
  if app.native_mixed_playoff_result_bound_v1(r1.id)is distinct from true or app.native_mixed_playoff_result_bound_v1(r2.id)is distinct from true then return null;end if;
  p:=array[r1.winner_id,r2.winner_id];parents:=jsonb_build_array(jsonb_build_object('id',r1.id,'digest',r1.result_digest),jsonb_build_object('id',r2.id,'digest',r2.result_digest));end if;
 series:=c.source_capture#>(case when slot_value=4 then'{series,final}'::text[]else'{series,regular}'::text[]end);
 body:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'slot',slot_value,'participants',to_jsonb(p),'format',series,'parentResultPins',parents);
 return body||jsonb_build_object('matchDigest',app.native_mixed_simulation_hash_v1(body));end$$;

-- Pure verification of one stored synthetic game; no sporting or write authority.
create function app.native_mixed_playoff_game_v1(capture jsonb,participants jsonb,history jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare e jsonb;p jsonb;item jsonb;submissions jsonb:='[]';confirmed jsonb:='[]';digital jsonb;paper jsonb;capture_entry jsonb;review_entry jsonb;
 winner text;refs jsonb;own_pid text;action text;actor text;roles jsonb;begin
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
  action:=e->>'type';actor:=e->>'actorId';p:=e-'id'-'type'-'actorId';
  select x->>'participantId'into own_pid from jsonb_array_elements(capture->'roster')x where x->>'profileId'=actor and x->>'mode'='digital'and participants?(x->>'participantId');
  if action='digital-submit'then
   if not app.native_mixed_pool_exact_v1(p,array['participantId','winnerParticipantId','statement'])or p->>'statement'is distinct from'simulation-own-playoff-result-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid)
    or not(participants?(p->>'winnerParticipantId'))or(winner is not null and winner<>p->>'winnerParticipantId')or jsonb_array_length(confirmed)>0 then return null;end if;
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
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))or(winner is not null and winner<>item->>'winnerParticipantId')then return null;end if;winner:=item->>'winnerParticipantId';end loop;
   capture_entry:=e;
  elsif action='paper-review'then
   if not app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','statement'])or p->>'statement'is distinct from'fictional-playoff-paper-review-v1'
    or capture_entry is null or review_entry is not null or actor=capture_entry->>'actorId'or own_pid is not null
    or p->'captureId'is distinct from capture_entry->'id'or p->'artifactId'is distinct from capture_entry->'artifactId'or p->'artifactDigest'is distinct from capture_entry->'artifactDigest'
    or p->'reenteredClaims'is distinct from capture_entry->'claims'then return null;end if;review_entry:=e;
  else return null;end if;
 end loop;
 return jsonb_build_object('complete',winner is not null and jsonb_array_length(submissions)=jsonb_array_length(digital)
  and jsonb_array_length(confirmed)=jsonb_array_length(digital)and(jsonb_array_length(paper)=0 or review_entry is not null),'winnerId',winner);
end$$;

create function app.native_mixed_playoff_progress_v1(context_value uuid,slot_value integer,extra jsonb default null)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;history jsonb;games jsonb:='[]';g jsonb;v record;n integer:=0;last_game integer:=0;
 wins_a integer:=0;wins_b integer:=0;winner text;limit_wins integer;hd text;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;m:=app.native_mixed_playoff_match_v1(context_value,slot_value);if c.id is null or m is null then return null;end if;
 limit_wins:=(m#>>'{format,winsRequired}')::integer;
 for n in select distinct game_number from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value
  union select(extra->>'gameNumber')::integer where extra is not null order by 1 loop
  if winner is not null or n<>last_game+1 or n>(m#>>'{format,maximumGames}')::integer then return null;end if;
  for v in select id,match_digest from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value and game_number=n loop
   if v.match_digest<>m->>'matchDigest'or app.native_mixed_playoff_row_bound_v1(v.id,'evidence')is distinct from true then return null;end if;end loop;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into history from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value and game_number=n;
  if extra is not null and n=(extra->>'gameNumber')::integer then history:=history||jsonb_build_array(extra->'entry');end if;
  g:=app.native_mixed_playoff_game_v1(c.source_capture,m->'participants',history);if g is null then return null;end if;
  hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_value,n,m->>'matchDigest',history));
  games:=games||jsonb_build_array(jsonb_build_object('gameNumber',n,'revision',jsonb_array_length(history),'historyDigest',hd,'complete',g->'complete','winnerId',g->'winnerId'));
  if g->'complete'is distinct from'true'::jsonb then
   if exists(select 1 from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value and game_number>n)or(extra is not null and(extra->>'gameNumber')::integer>n)then return null;end if;
   return jsonb_build_object('match',m,'games',games,'complete',false,'winsA',wins_a,'winsB',wins_b,'nextGameNumber',n,'winnerId',null);
  end if;
  if g->>'winnerId'=m#>>'{participants,0}'then wins_a:=wins_a+1;else wins_b:=wins_b+1;end if;
  if wins_a=limit_wins or wins_b=limit_wins then winner:=g->>'winnerId';end if;last_game:=n;
 end loop;
 return jsonb_build_object('match',m,'games',games,'complete',winner is not null,'winsA',wins_a,'winsB',wins_b,'nextGameNumber',case when winner is null then last_game+1 else null end,'winnerId',winner);
end$$;

-- Parent validation is acyclic: slot 2 replays slot 1; slot 4 replays slots 2/3.
create function app.native_mixed_playoff_result_bound_v1(result_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare r app.native_mixed_playoff_results_v1%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;
 p jsonb;m jsonb;body jsonb;loser uuid;last_e app.native_mixed_playoff_evidence_v1%rowtype;begin
 select*into r from app.native_mixed_playoff_results_v1 where id=result_value;if r.id is null then return false;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=r.context_id;
 if c.id is null or r.tournament_id<>c.tournament_id or r.event_id<>c.event_id or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return false;end if;
 p:=app.native_mixed_playoff_progress_v1(c.id,r.slot);if p is null or p->'complete'is distinct from'true'::jsonb then return false;end if;m:=p->'match';
 loser:=case when p->>'winnerId'=m#>>'{participants,0}'then(m#>>'{participants,1}')::uuid else(m#>>'{participants,0}')::uuid end;
 body:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'sourceDigest',c.source_digest,'slot',r.slot,'match',m,'progress',p,'winnerId',(p->>'winnerId')::uuid,'loserId',loser,'simulationOnly',true);
 select*into last_e from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=r.slot order by game_number desc,sequence desc limit 1;
 return r.source_capture=body and r.result_digest=app.native_mixed_simulation_hash_v1(body)and r.match_digest=m->>'matchDigest'
  and r.winner_id=(p->>'winnerId')::uuid and r.loser_id=loser and last_e.receipt_id=r.receipt_id
  and app.native_mixed_playoff_row_bound_v1(last_e.id,'evidence')is true;
end$$;

create function app.native_mixed_playoff_completion_bound_v1(context_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;v app.native_mixed_playoff_completions_v1%rowtype;
 r app.native_mixed_playoff_results_v1%rowtype;body jsonb;cohorts jsonb;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;
 select*into v from app.native_mixed_playoff_completions_v1 where context_id=context_value;
 if c.id is null or v.context_id is null or v.tournament_id<>c.tournament_id or v.event_id<>c.event_id
  or(select count(*)from app.native_mixed_playoff_results_v1 where context_id=c.id)<>4 then return false;end if;
 for r in select*from app.native_mixed_playoff_results_v1 where context_id=c.id loop
  if app.native_mixed_playoff_result_bound_v1(r.id)is distinct from true then return false;end if;
 end loop;
 select*into r from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=4;
 cohorts:=jsonb_build_array(jsonb_build_object('firstPlace',1,'lastPlace',1,'participantIds',jsonb_build_array(r.winner_id)),jsonb_build_object('firstPlace',2,'lastPlace',2,'participantIds',jsonb_build_array(r.loser_id)),
  jsonb_build_object('firstPlace',3,'lastPlace',4,'participantIds',(select jsonb_agg(loser_id order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot in(2,3))),
  jsonb_build_object('firstPlace',5,'lastPlace',5,'participantIds',(select jsonb_agg(loser_id)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1)));
 body:=jsonb_build_object('contextId',c.id,'sourceDigest',c.source_digest,'finishingGroups',cohorts,'resultPins',(select jsonb_agg(jsonb_build_object('id',id,'slot',slot,'digest',result_digest)order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 return v.receipt_id=r.receipt_id and v.source_capture=body and v.source_digest=app.native_mixed_simulation_hash_v1(body);
end$$;

create function app.execute_native_mixed_playoff_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
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
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share row exclusive mode nowait;
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
  select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into history,revision from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=slot_no and game_number=game_no;
  hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_no,game_no,m->>'matchDigest',history));
  if revision<>(data->>'expectedRevision')::integer or hd<>data->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
  if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then return jsonb_build_object('status','rejected','code','playoffs_complete');end if;
  payload:=(data->'entry')-'type';
  if payload?'id'or payload?'actorId'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if typ='paper-capture'then
   if not app.native_mixed_pool_exact_v1(payload,array['artifactId','claims','statement'])or app.native_mixed_simulation_uuid_v1(payload->>'artifactId')is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'claims',payload->'claims','physicalOriginal',false,'actualPlayClaimed',false);
   payload:=payload||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
   if exists(select 1 from app.native_mixed_playoff_evidence_v1 where entry->>'artifactId'=payload->>'artifactId'and entry->>'type'='paper-capture')then return jsonb_build_object('status','rejected','code','artifact_already_used');end if;
  end if;
  authority:=jsonb_build_object('actorId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles,'paperIdentityBinding',case when typ in('paper-capture','paper-review')then to_jsonb(binding)else null end,'simulationOnly',true);
  entry_value:=jsonb_build_object('id',idv,'type',typ,'actorId',actor)||payload;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no,jsonb_build_object('gameNumber',game_no,'entry',entry_value));if progress is null then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_no,game_no,m->>'matchDigest',history));
  response:=jsonb_build_object('status','simulated_playoff_evidence_recorded','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'entryId',idv,'revision',revision+1,'historyDigest',hd,'sourceDigest',c.source_digest,'matchDigest',m->>'matchDigest','gameComplete',(progress->'games'->-1)->'complete','matchComplete',progress->'complete','winnerId',progress->'winnerId','simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  insert into app.native_mixed_playoff_evidence_v1(id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);kind:='evidence';
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

-- Official-only private read. Do not expose this source capture to players.
create function app.get_native_mixed_playoff_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;source jsonb;matches jsonb:='[]';m jsonb;i integer;response jsonb;begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')for share nowait;if not found then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
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

do $acl$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_playoff_enabled_v1()'::regprocedure,'app.native_mixed_playoff_source_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_playoff_row_bound_v1(uuid,text)'::regprocedure,'app.native_mixed_playoff_match_v1(uuid,integer)'::regprocedure,
 'app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)'::regprocedure,'app.native_mixed_playoff_progress_v1(uuid,integer,jsonb)'::regprocedure,
 'app.native_mixed_playoff_result_bound_v1(uuid)'::regprocedure,'app.native_mixed_playoff_completion_bound_v1(uuid)'::regprocedure,
 'app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'app.get_native_mixed_playoff_v1(uuid,uuid)'::regprocedure]loop
 execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;
commit;
