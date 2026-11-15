-- UNEXECUTED source candidate. No grants/activation. Depends on manual journal,
-- 0113 identities and 0240 canonical v3 four-qualifier results.
-- A determination is a NEW explicit documentary verification, never an implicit
-- promotion of notes, current lookup, expiration/grace arithmetic or absence.
-- Documentary review ONLY. Typed references/intervals are NOT verified facts;
-- this store cannot feed the verified-evidence RPC or authorize MRP awards.
begin;
create function app.mrp_event_determinations_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create table app.mrp_event_determinations_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,roster_entry_id uuid not null,
 version integer not null check(version>0),prior_id uuid,journal_head_id uuid not null,
 qualification_id uuid not null,playoff_id uuid not null,starts_on date not null,ends_on date not null,
 verified_from date not null,verified_through date not null,
 event_record_reference text not null check(length(trim(event_record_reference))between 1 and 500),
 membership_record_reference text not null check(length(trim(membership_record_reference))between 1 and 500),
 reason text not null check(length(trim(reason))between 1 and 500),
 actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,
 operation_id uuid not null,request jsonb not null,recorded_at timestamptz not null,
 operation_receipt_id uuid not null,
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(journal_head_id,tournament_id,event_id,roster_entry_id)references app.mrp_membership_manual_reviews_v1(id,tournament_id,event_id,roster_entry_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(playoff_id,tournament_id,event_id)references app.playoff_outcome_versions_v3(id,tournament_id,event_id),
 unique(event_id,roster_entry_id,version),unique(actor_id,operation_id),unique(id,tournament_id,event_id,roster_entry_id),
 foreign key(prior_id,tournament_id,event_id,roster_entry_id)references app.mrp_event_determinations_v1(id,tournament_id,event_id,roster_entry_id),
 check((version=1)=(prior_id is null)),check(starts_on<=ends_on),check(verified_from<=verified_through)
);
alter table app.mrp_event_determinations_v1 enable row level security;
alter table app.mrp_event_determinations_v1 force row level security;
revoke all on app.mrp_event_determinations_v1 from public,anon,authenticated,service_role;
create trigger mrp_event_determinations_immutable before update or delete on app.mrp_event_determinations_v1 for each row execute function app.reject_immutable_history();

-- Coarse source locks deliberately cover inserts as well as existing rows.
-- No claim of scalable locking; a future release needs measured runtime proof.
create function app.lock_event_mrp_sources_v1()returns void language plpgsql security definer set search_path=''as $$begin
 lock table app.qualification_result_versions,app.qualification_result_rows,app.playoff_outcome_versions_v3,
 app.standard_singles_playoff_result_versions,app.event_participants,app.tournament_roster_entries,
 app.mrp_membership_manual_reviews_v1,app.tournament_setup_activations,app.tournament_setup_event_versions in share mode nowait;
end$$;

create function public.record_event_mrp_determination_v1(tid uuid,eid uuid,operation uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;entry uuid;old app.mrp_event_determinations_v1%rowtype;head app.mrp_event_determinations_v1%rowtype;
 journal app.mrp_membership_manual_reviews_v1%rowtype;qid uuid;pid uuid;rid uuid;k text;source jsonb;receipt uuid;h text;response jsonb;
begin
 if app.mrp_event_determinations_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','read_committed_required');end if;
 actor:=app.mrp_manual_review_actor_v1(tid);if actor is null then return jsonb_build_object('status','blocked','code','not_authorized');end if;
 if operation is null or jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>13
 or not(request?&array['rosterEntryId','expectedHeadId','journalHeadId','qualificationId','playoffId','startsOn','endsOn','verifiedFrom','verifiedThrough','eventRecordReference','membershipRecordReference','reason','confirmed'])
 or request->'confirmed'is distinct from'true'::jsonb then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 foreach k in array array['rosterEntryId','journalHeadId','qualificationId','playoffId']loop
 if coalesce(request->>k,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','blocked','code','invalid_request');end if;end loop;
 if request->'expectedHeadId'<>'null'::jsonb and coalesce(request->>'expectedHeadId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 foreach k in array array['eventRecordReference','membershipRecordReference','reason']loop
 if jsonb_typeof(request->k)is distinct from'string'or length(request->>k)not between 1 and 500 or request->>k<>trim(request->>k)or request->>k~'[[:cntrl:]]'then return jsonb_build_object('status','blocked','code','invalid_request');end if;end loop;
 foreach k in array array['startsOn','endsOn','verifiedFrom','verifiedThrough']loop
 if coalesce(request->>k,'')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'or to_char((request->>k)::date,'YYYY-MM-DD')<>request->>k then return jsonb_build_object('status','blocked','code','invalid_request');end if;end loop;
 if(request->>'startsOn')::date>(request->>'endsOn')::date or(request->>'verifiedFrom')::date>(request->>'verifiedThrough')::date then return jsonb_build_object('status','blocked','code','invalid_dates');end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||operation::text,0));
 select*into old from app.mrp_event_determinations_v1 where actor_id=actor and operation_id=operation;
 if found then if old.tournament_id=tid and old.event_id=eid and old.request=request then return jsonb_build_object('status','determination_recorded','id',old.id,'version',old.version,'historicalReceipt',true,'mrpWritten',false);end if;return jsonb_build_object('status','blocked','code','operation_conflict');end if;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=operation)then return jsonb_build_object('status','blocked','code','operation_conflict');end if;
 -- Serialize all determination inserts, before taking source SHARE locks.
 lock table app.mrp_event_determinations_v1 in share row exclusive mode nowait;
 perform app.lock_event_mrp_sources_v1();entry:=(request->>'rosterEntryId')::uuid;
 perform 1 from app.event_participants where event_id=eid and tournament_id=tid and roster_entry_id=entry;if not found then return jsonb_build_object('status','blocked','code','identity_unavailable');end if;
 select*into head from app.mrp_event_determinations_v1 where tournament_id=tid and event_id=eid and roster_entry_id=entry order by version desc limit 1;
 if head.id is distinct from(request->>'expectedHeadId')::uuid then return jsonb_build_object('status','blocked','code','head_changed');end if;
 select*into journal from app.mrp_membership_manual_reviews_v1 where tournament_id=tid and event_id=eid and roster_entry_id=entry order by version desc limit 1;
 if journal.id is null or journal.id is distinct from(request->>'journalHeadId')::uuid then return jsonb_build_object('status','blocked','code','journal_changed');end if;
 select id into qid from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 select id into pid from app.playoff_outcome_versions_v3 where tournament_id=tid and event_id=eid and qualification_result_version_id=qid order by version desc limit 1;
 source:=jsonb_build_object('kind','playoff_outcome_v3','resultId',pid,'qualificationResultVersionId',qid);
 if qid is null or pid is null or qid is distinct from(request->>'qualificationId')::uuid or pid is distinct from(request->>'playoffId')::uuid
 or app.canonical_settlement_mrp_v5(tid,eid,source)->>'status'is distinct from'available'
 or exists(select 1 from app.standard_singles_playoff_result_versions where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','result_unavailable');end if;
 rid:=extensions.gen_random_uuid();receipt:=extensions.gen_random_uuid();
 h:=encode(extensions.digest(convert_to(jsonb_build_array('mrp_event_documentary_review_v1',tid,eid,request)::text,'UTF8'),'sha256'),'hex');
 response:=jsonb_build_object('status','determination_recorded','id',rid,'version',coalesce(head.version,0)+1,'historicalReceipt',false,'eligibility','review_pending','mrpWritten',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt,tid,actor,'mrp_event_documentary_review_v1',eid,h,operation,'accepted',response,clock_timestamp());
 insert into app.mrp_event_determinations_v1 values(rid,tid,eid,entry,coalesce(head.version,0)+1,head.id,journal.id,qid,pid,
 (request->>'startsOn')::date,(request->>'endsOn')::date,(request->>'verifiedFrom')::date,(request->>'verifiedThrough')::date,
 request->>'eventRecordReference',request->>'membershipRecordReference',request->>'reason',actor,(auth.jwt()->>'session_id')::uuid,operation,request,clock_timestamp(),receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt,'mrp_event_determination',rid,'documentary_event_membership_review',jsonb_build_object('request',request,'journalHeadId',journal.id,'eligibility','review_pending','mrpWritten',false));
 return response;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('status','blocked','code','invalid_request');
end$$;

-- Private documentary recovery, deliberately NOT named verified-evidence.
create function public.get_event_mrp_determination_v1(tid uuid,eid uuid,entry uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;head app.mrp_event_determinations_v1%rowtype;jid uuid;qid uuid;pid uuid;begin
 if app.mrp_event_determinations_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','read_committed_required');end if;
 actor:=app.mrp_manual_review_actor_v1(tid);if actor is null then return jsonb_build_object('status','blocked','code','not_authorized');end if;
 lock table app.mrp_event_determinations_v1 in share mode nowait;
 perform app.lock_event_mrp_sources_v1();
 if not exists(select 1 from app.event_participants where tournament_id=tid and event_id=eid and roster_entry_id=entry)then return jsonb_build_object('status','blocked','code','identity_unavailable');end if;
 select*into head from app.mrp_event_determinations_v1 where tournament_id=tid and event_id=eid and roster_entry_id=entry order by version desc limit 1;
 select id into jid from app.mrp_membership_manual_reviews_v1 where tournament_id=tid and event_id=eid and roster_entry_id=entry order by version desc limit 1;
 select id into qid from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 select id into pid from app.playoff_outcome_versions_v3 where tournament_id=tid and event_id=eid and qualification_result_version_id=qid order by version desc limit 1;
 return jsonb_build_object('status','documentary_review_available','tournamentId',tid,'eventId',eid,'rosterEntryId',entry,
 'head',case when head.id is null then null else jsonb_build_object('id',head.id,'version',head.version,'priorId',head.prior_id,'request',head.request,'recordedBy',head.actor_id,'recordedAt',head.recorded_at)end,
 'stale',head.id is not null and(head.journal_head_id is distinct from jid or head.qualification_id is distinct from qid or head.playoff_id is distinct from pid),
 'eligibility','review_pending','officialEligibilityDetermined',false,'mrpWritten',false);
end$$;

alter table app.mrp_event_determinations_v1 owner to postgres;
alter function app.mrp_event_determinations_enabled_v1()owner to postgres;
alter function app.lock_event_mrp_sources_v1()owner to postgres;
alter function public.record_event_mrp_determination_v1(uuid,uuid,uuid,jsonb)owner to postgres;
alter function public.get_event_mrp_determination_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.mrp_event_determinations_enabled_v1(),app.lock_event_mrp_sources_v1(),public.record_event_mrp_determination_v1(uuid,uuid,uuid,jsonb),public.get_event_mrp_determination_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
