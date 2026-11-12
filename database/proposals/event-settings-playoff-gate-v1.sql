-- UNEXECUTED PRIVATE PROPOSAL. Requires operational settings bindings and the
-- bounded rule assessment proposal. No grants, bracket publication or exposed play API.
-- Original field derives from OFFICIAL native play-start evidence, not paid
-- entries, remaining qualifiers, a checkbox or a director-entered override.
begin;
create table app.event_settings_playoff_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),event_id uuid not null,
 request_payload jsonb not null,request_hash text not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-playoff-gate-v1',actor_id,tournament_id,event_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.event_settings_playoff_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 settings_binding_id uuid not null references app.event_settings_operational_bindings_v1(id),
 context_review_id uuid not null references app.event_rule_context_reviews_v1(id),
 play_start_id uuid not null,schedule_publication_id uuid not null,qualification_id uuid not null,
 original_entrants integer not null check(original_entrants between 2 and 10000),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_capture jsonb not null,
 actor_id uuid not null,operation_id uuid not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),unique(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.event_settings_playoff_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(play_start_id,tournament_id,event_id)references app.event_play_starts(id,tournament_id,event_id),
 foreign key(schedule_publication_id,tournament_id,event_id)references app.event_schedule_publications(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id)
);
create index event_settings_playoff_reviews_source_v1 on app.event_settings_playoff_reviews_v1(tournament_id,event_id,qualification_id,source_digest);
create table app.event_settings_playoff_starts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version>0),prior_start_id uuid,gate_review_id uuid not null,
 qualification_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 actor_id uuid not null,operation_id uuid not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),unique(id,tournament_id,event_id),unique(tournament_id,event_id,version),
 foreign key(prior_start_id,tournament_id,event_id)references app.event_settings_playoff_starts_v1(id,tournament_id,event_id),
 foreign key(gate_review_id,tournament_id,event_id)references app.event_settings_playoff_reviews_v1(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.event_settings_playoff_operations_v1(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin
 foreach n in array array['event_settings_playoff_operations_v1','event_settings_playoff_reviews_v1','event_settings_playoff_starts_v1']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;

-- Conservative cross-tournament table reservations cover the existing native
-- qualification currentness helper's score, correction, recovery, tie and name
-- inputs. This is a contention/scalability acceptance gate, not a claim that
-- uncoordinated writers already share a per-event lock protocol.
create function app.lock_event_settings_playoff_sources_v1()returns void
language plpgsql security definer set search_path=''as $$begin
 lock table app.events,app.ruleset_versions,app.tournament_setup_activations,
 app.event_settings_operational_bindings_v1,app.event_rule_context_reviews_v1,
 app.event_play_starts,app.event_schedule_publications,app.qualification_result_versions,
 app.qualification_result_rows,app.qualification_tie_resolutions_v1,
 app.event_participants,app.tournament_roster_entries,app.profiles,app.canonical_games,
 app.card_scorelines,app.score_submissions,app.score_confirmations,
 app.paper_game_completion_evidence,app.paper_game_completion_reviews,
 app.independent_card_corrections,app.independent_card_correction_projections,
 app.independent_card_correction_lifecycles,app.independent_card_correction_state_events,
 app.independent_card_correction_claims,app.game_corrections,app.correction_state_events,
 app.device_failure_recoveries,app.device_failure_recovery_evidence,
 app.device_failure_recovery_state_events,app.device_failure_recovery_projections,
 app.event_disputes,app.event_dispute_state_events,app.rule12_affected_player_notices,
 app.event_game_standings_eligibility_versions,app.operational_game_forfeits,
 app.event_publication_states,app.event_settlement_finals_v2,
 app.standard_singles_settlement_final_versions,app.q_accounting_finals_v6,
 app.no_q_accounting_finals_v7,app.prize_accounting_finals_v8,
 app.prize_accounting_finals_v9,app.multi_event_joint_finals_v1,
 app.multi_event_unpaid_finals_v1 in share mode nowait;
end$$;
create function app.event_settings_playoff_lifecycle_open_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.tournaments where id=tid and status='open')
 and exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active')
 and not exists(select 1 from app.event_settlement_finals_v2 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.standard_singles_settlement_final_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.q_accounting_finals_v6 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.prize_accounting_finals_v8 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.prize_accounting_finals_v9 where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.multi_event_joint_finals_v1 where tournament_id=tid)
 and not exists(select 1 from app.multi_event_unpaid_finals_v1 where tournament_id=tid and event_id=eid);
$$;
create function app.event_settings_playoff_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare b app.event_settings_operational_bindings_v1%rowtype;a app.tournament_setup_activations%rowtype;
 p app.event_play_starts%rowtype;s app.event_schedule_publications%rowtype;q app.qualification_result_versions%rowtype;
 assessment jsonb;final_format jsonb;capture_value jsonb;h text;
begin
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;
 perform app.lock_event_settings_playoff_sources_v1();
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','blocked','code','settings_binding_required');end if;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid and setup_event_version_id=b.setup_event_version_id;
 if not found or not exists(select 1 from app.events where id=eid and tournament_id=tid and operational_state='active'and format='standard_singles'and ruleset_version_id=a.ruleset_version_id)then return jsonb_build_object('status','blocked','code','operational_source_changed');end if;
 select*into p from app.event_play_starts where tournament_id=tid and event_id=eid;
 select*into s from app.event_schedule_publications where tournament_id=tid and event_id=eid;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if p.id is null or s.id is null or q.id is null or p.start_source<>'official'or p.operation_receipt_id is null
 or p.schedule_publication_id<>s.id or q.schedule_publication_id<>s.id or q.ruleset_version_id<>a.ruleset_version_id
 or p.participant_count<>s.participant_count or q.participant_count<>p.participant_count
 or q.qualifier_count<>(q.participant_count+3)/4
 or not exists(select 1 from app.operation_receipts where id=p.operation_receipt_id and tournament_id=tid and outcome='accepted')
 or not exists(select 1 from app.operation_receipts where id=q.operation_receipt_id and tournament_id=tid and outcome='accepted')
 then return jsonb_build_object('status','blocked','code','native_original_field_unavailable');end if;
 if not app.qualification_resolution_snapshot_current_v1(q.id)then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
 assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);
 if assessment->>'status'is distinct from'eligible'then return jsonb_build_object('status','blocked','code','series_rules_unresolved');end if;
 final_format:=app.resolve_event_series_format_v1(case b.draft->>'finalMode'when'same'then b.draft#>'{series,regular}'else b.draft#>'{series,final}'end);
 if b.context->'sanctioned'='true'::jsonb and b.context->>'eventKind'='main'and(b.context->>'durationDays')::integer=2 and p.participant_count>=257
 and final_format is distinct from jsonb_build_object('winsRequired',4,'maximumGames',7)
 then return jsonb_build_object('status','blocked','code','two_day_main_large_final');end if;
 capture_value:=jsonb_build_object('settingsBinding',to_jsonb(b),'activation',to_jsonb(a),'playStart',to_jsonb(p),'schedule',to_jsonb(s),'qualification',to_jsonb(q),'qualificationFingerprint',app.qualification_tie_source_v1(tid,eid),'originalEntrants',p.participant_count);
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-playoff-source-v1',tid,eid,capture_value)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','sourceDigest',h,'source',capture_value,'settingsBindingId',b.id,'reviewId',b.review_id,'playStartId',p.id,'schedulePublicationId',s.id,'qualificationId',q.id,'originalEntrants',p.participant_count,'playStartAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.finish_event_settings_playoff_review_v1(tid uuid,eid uuid,op uuid,v jsonb,outcome jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();h text;response jsonb;
begin
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-playoff-gate-v1',a,tid,eid,op,v)::text,'utf8'),'sha256'),'hex');
 response:=outcome||jsonb_build_object('actorId',a,'tournamentId',tid,'eventId',eid,'operationId',op,'request',v,'playStartAllowed',false,'officialApprovalClaimed',false,'moneyMoved',false);
 insert into app.event_settings_playoff_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash,result)values(a,op,tid,eid,v,h,response);return response;
end$$;
create function app.review_event_settings_playoffs_v1(tid uuid,eid uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;old app.event_settings_playoff_operations_v1%rowtype;src jsonb;rid uuid;response jsonb;k text;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>9 or not(v?&array['kind','operationId','sourceDigest','settingsBindingId','reviewId','playStartId','schedulePublicationId','qualificationId','reason'])or v->>'kind'is distinct from'event-settings-playoff-gate-v1'
 or jsonb_typeof(v->'sourceDigest')is distinct from'string'or(v->>'sourceDigest')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(v->'reason')is distinct from'string'or v->>'reason'<>app.custom_payout_classification_text_v2(v->>'reason')or app.event_settings_js_text_length_v3(v->>'reason')not between 1 and 500 or(v->>'reason')~U&'[\0001-\001F\007F]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 foreach k in array array['operationId','settingsBindingId','reviewId','playStartId','schedulePublicationId','qualificationId']loop
  if jsonb_typeof(v->k)is distinct from'string'or(v->>k)!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 end loop;
 op:=(v->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-playoff-gate-v1',a,tid,eid,op,v)::text,'utf8'),'sha256'),'hex');
 select*into old from app.event_settings_playoff_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id<>tid or old.event_id<>eid or old.request_hash<>h or old.request_payload<>v then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return old.result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid)then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 src:=app.event_settings_playoff_source_v1(tid,eid);
 if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if not app.event_settings_playoff_lifecycle_open_v1(tid,eid)then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','playoff_lifecycle_closed'));end if;
 if src->>'status'is distinct from'source_available'then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code',coalesce(src->>'code','source_unavailable')));end if;
 foreach k in array array['sourceDigest','settingsBindingId','reviewId','playStartId','schedulePublicationId','qualificationId']loop
  if v->>k is distinct from src->>k then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','source_changed'));end if;
 end loop;
 rid:=extensions.gen_random_uuid();response:=app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','playoff_rules_reviewed','gateReviewId',rid,'sourceDigest',src->>'sourceDigest','originalEntrants',src->'originalEntrants'));
 insert into app.event_settings_playoff_reviews_v1(id,tournament_id,event_id,settings_binding_id,context_review_id,play_start_id,schedule_publication_id,qualification_id,original_entrants,source_digest,source_capture,actor_id,operation_id,reason)
 values(rid,tid,eid,(src->>'settingsBindingId')::uuid,(src->>'reviewId')::uuid,(src->>'playStartId')::uuid,(src->>'schedulePublicationId')::uuid,(src->>'qualificationId')::uuid,(src->>'originalEntrants')::integer,src->>'sourceDigest',src->'source',a,op,v->>'reason');
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.start_event_settings_playoffs_v1(tid uuid,eid uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;old app.event_settings_playoff_operations_v1%rowtype;
 head app.event_settings_playoff_starts_v1%rowtype;review app.event_settings_playoff_reviews_v1%rowtype;src jsonb;rid uuid;response jsonb;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or(select count(*)from jsonb_object_keys(v))<>7 or not(v?&array['kind','operationId','sourceDigest','gateReviewId','expectedStartId','confirmed','reason'])
 or v->>'kind'is distinct from'event-settings-playoff-start-v1'or v->'confirmed'is distinct from'true'::jsonb
 or jsonb_typeof(v->'operationId')is distinct from'string'or(v->>'operationId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'gateReviewId')is distinct from'string'or(v->>'gateReviewId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or not(v->'expectedStartId'='null'::jsonb or(jsonb_typeof(v->'expectedStartId')='string'and(v->>'expectedStartId')~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
 or jsonb_typeof(v->'sourceDigest')is distinct from'string'or(v->>'sourceDigest')!~'^[a-f0-9]{64}$'
 or jsonb_typeof(v->'reason')is distinct from'string'or v->>'reason'<>app.custom_payout_classification_text_v2(v->>'reason')or app.event_settings_js_text_length_v3(v->>'reason')not between 1 and 500 or(v->>'reason')~U&'[\0001-\001F\007F]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(v->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-playoff-gate-v1',a,tid,eid,op,v)::text,'utf8'),'sha256'),'hex');
 select*into old from app.event_settings_playoff_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id<>tid or old.event_id<>eid or old.request_hash<>h or old.request_payload<>v then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  return old.result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if not exists(select 1 from app.events where id=eid and tournament_id=tid)then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 src:=app.event_settings_playoff_source_v1(tid,eid);if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if not app.event_settings_playoff_lifecycle_open_v1(tid,eid)then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','playoff_lifecycle_closed'));end if;
 if src->>'status'is distinct from'source_available'or src->>'sourceDigest'is distinct from v->>'sourceDigest'then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','playoff_source_changed'));end if;
 select*into review from app.event_settings_playoff_reviews_v1 where id=(v->>'gateReviewId')::uuid and tournament_id=tid and event_id=eid and source_digest=src->>'sourceDigest'and qualification_id=(src->>'qualificationId')::uuid;
 if not found then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','current_playoff_review_required'));end if;
 select*into head from app.event_settings_playoff_starts_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.id::text,'')<>coalesce(v->>'expectedStartId','')then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','playoff_start_changed'));end if;
 if head.id is not null and head.source_digest=src->>'sourceDigest'then return app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','rejected','code','already_started'));end if;
 rid:=extensions.gen_random_uuid();response:=app.finish_event_settings_playoff_review_v1(tid,eid,op,v,jsonb_build_object('status','playoff_start_recorded','playoffStartId',rid,'gateReviewId',review.id,'sourceDigest',src->>'sourceDigest','playoffStartRecorded',true));
 insert into app.event_settings_playoff_starts_v1(id,tournament_id,event_id,version,prior_start_id,gate_review_id,qualification_id,source_digest,actor_id,operation_id,reason)
 values(rid,tid,eid,coalesce(head.version,0)+1,head.id,review.id,review.qualification_id,src->>'sourceDigest',a,op,v->>'reason');
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_event_settings_playoff_operation_v1(tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.event_settings_playoff_operations_v1%rowtype;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into r from app.event_settings_playoff_operations_v1 where actor_id=a and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','unknown','actorId',a,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 return r.result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.require_event_settings_playoff_start_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare src jsonb;head app.event_settings_playoff_starts_v1%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_settings_playoff_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 perform 1 from app.tournament_roles where tournament_id=new.tournament_id and profile_id=new.actor_id and role in('director','co_director')order by role for share nowait;if not found then raise exception'event_settings_playoff_actor_required';end if;
 src:=app.event_settings_playoff_source_v1(new.tournament_id,new.event_id);
 if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if not app.event_settings_playoff_lifecycle_open_v1(new.tournament_id,new.event_id)then raise exception'event_settings_playoff_lifecycle_closed';end if;
 if src->>'status'is distinct from'source_available'or src->>'sourceDigest'is distinct from new.source_digest or src->>'qualificationId'is distinct from new.qualification_id::text then raise exception'event_settings_playoff_source_changed';end if;
 if not exists(select 1 from app.event_settings_playoff_reviews_v1 where id=new.gate_review_id and tournament_id=new.tournament_id and event_id=new.event_id and qualification_id=new.qualification_id and source_digest=new.source_digest)then raise exception'event_settings_playoff_review_required';end if;
 select*into head from app.event_settings_playoff_starts_v1 where tournament_id=new.tournament_id and event_id=new.event_id order by version desc limit 1;
 if new.version<>coalesce(head.version,0)+1 or new.prior_start_id is distinct from head.id then raise exception'event_settings_playoff_start_changed';end if;
 return new;
end$$;
create trigger aa_event_settings_playoff_start_v1 before insert on app.event_settings_playoff_starts_v1 for each row execute function app.require_event_settings_playoff_start_v1();

-- Old result/series writers cannot turn a configured event into a playoff
-- outcome before its CURRENT native field-size/rule review has been recorded.
create function app.require_event_settings_playoff_gate_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare qid uuid;src jsonb;actor uuid;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_settings_playoff_isolation_not_supported';end if;
 if not exists(select 1 from app.event_settings_operational_bindings_v1 where tournament_id=new.tournament_id and event_id=new.event_id)then return new;end if;
 if tg_table_name='linked_main_series_v1'then qid:=new.qualification_id;actor:=new.reviewed_by;
 elsif tg_table_name='standard_singles_playoff_result_versions'then qid:=new.qualification_result_version_id;actor:=new.recorded_by_profile_id;
 else qid:=new.qualification_result_version_id;actor:=new.recorded_by;end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 perform 1 from app.tournament_roles where tournament_id=new.tournament_id and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then raise exception'event_settings_playoff_actor_required';end if;
 src:=app.event_settings_playoff_source_v1(new.tournament_id,new.event_id);
 if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if not app.event_settings_playoff_lifecycle_open_v1(new.tournament_id,new.event_id)then raise exception'event_settings_playoff_lifecycle_closed';end if;
 if src->>'status'is distinct from'source_available'or src->>'qualificationId'is distinct from qid::text then raise exception'event_settings_playoff_source_changed';end if;
 if not exists(select 1 from app.event_settings_playoff_starts_v1 st join app.event_settings_playoff_reviews_v1 r on r.id=st.gate_review_id and r.tournament_id=st.tournament_id and r.event_id=st.event_id
 where st.tournament_id=new.tournament_id and st.event_id=new.event_id and st.version=(select max(version)from app.event_settings_playoff_starts_v1 where tournament_id=new.tournament_id and event_id=new.event_id)and st.qualification_id=qid and st.source_digest=src->>'sourceDigest'and r.settings_binding_id=(src->>'settingsBindingId')::uuid and r.source_digest=src->>'sourceDigest')then raise exception'event_settings_playoff_start_required';end if;
 -- These four historical APIs carry aggregate winner/loser evidence, not the
 -- new configured first-to-N game evidence. A stored start is not that proof.
 -- Preserve legacy/unbound early return, but never invent per-game wins.
 raise exception'configured_series_game_evidence_required';
end$$;
create trigger aa_event_settings_playoff_gate_v1 before insert on app.standard_singles_playoff_result_versions for each row execute function app.require_event_settings_playoff_gate_v1();
create trigger aa_event_settings_playoff_gate_v1 before insert on app.playoff_outcome_versions_v3 for each row execute function app.require_event_settings_playoff_gate_v1();
create trigger aa_event_settings_playoff_gate_v1 before insert on app.playoff_outcome_versions_v4 for each row execute function app.require_event_settings_playoff_gate_v1();
create trigger aa_event_settings_playoff_gate_v1 before insert on app.linked_main_series_v1 for each row execute function app.require_event_settings_playoff_gate_v1();
-- Catalog presence is internal backstop availability, not runtime acceptance or
-- public capability. Every exposed route/grant remains absent in this proposal.
create function app.event_settings_playoff_guard_available_v1()returns boolean
language sql stable security definer set search_path=''as $$
 select(select count(*)=4 from pg_catalog.pg_trigger t where t.tgname='aa_event_settings_playoff_gate_v1'and t.tgenabled='O'and t.tgfoid='app.require_event_settings_playoff_gate_v1()'::regprocedure
 and t.tgrelid=any(array['app.standard_singles_playoff_result_versions'::regclass,'app.playoff_outcome_versions_v3'::regclass,'app.playoff_outcome_versions_v4'::regclass,'app.linked_main_series_v1'::regclass]))
 and exists(select 1 from pg_catalog.pg_trigger t where t.tgname='aa_event_settings_playoff_start_v1'and t.tgenabled='O'and t.tgfoid='app.require_event_settings_playoff_start_v1()'::regprocedure and t.tgrelid='app.event_settings_playoff_starts_v1'::regclass);
$$;
create function app.event_settings_game_result_recording_available_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
alter function app.lock_event_settings_playoff_sources_v1()owner to postgres;
alter function app.event_settings_playoff_lifecycle_open_v1(uuid,uuid)owner to postgres;
alter function app.event_settings_playoff_source_v1(uuid,uuid)owner to postgres;
alter function app.finish_event_settings_playoff_review_v1(uuid,uuid,uuid,jsonb,jsonb)owner to postgres;
alter function app.review_event_settings_playoffs_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.require_event_settings_playoff_gate_v1()owner to postgres;
alter function app.start_event_settings_playoffs_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.require_event_settings_playoff_start_v1()owner to postgres;
alter function app.get_event_settings_playoff_operation_v1(uuid,uuid,uuid)owner to postgres;
alter function app.event_settings_playoff_guard_available_v1()owner to postgres;
alter function app.event_settings_game_result_recording_available_v1()owner to postgres;
revoke all on function app.lock_event_settings_playoff_sources_v1(),app.event_settings_playoff_lifecycle_open_v1(uuid,uuid),app.event_settings_playoff_source_v1(uuid,uuid),app.finish_event_settings_playoff_review_v1(uuid,uuid,uuid,jsonb,jsonb),app.review_event_settings_playoffs_v1(uuid,uuid,jsonb),app.start_event_settings_playoffs_v1(uuid,uuid,jsonb),app.get_event_settings_playoff_operation_v1(uuid,uuid,uuid),app.require_event_settings_playoff_start_v1(),app.require_event_settings_playoff_gate_v1(),app.event_settings_playoff_guard_available_v1(),app.event_settings_game_result_recording_available_v1()from public,anon,authenticated,service_role;
commit;
