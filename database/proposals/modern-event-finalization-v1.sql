-- PRIVATE / DEFAULT OFF. Unified immutable approval of already-completed
-- unpaid journals. Does not create another liability, payment or ACC award.
begin;
create function app.modern_event_finalization_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.modern_event_final_operations_v1(actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,session_id uuid not null,request jsonb not null,request_hash text not null,primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('modern-event-final-request-v1',actor_id,tournament_id,event_id,operation_id,request)::text,'utf8'),'sha256'),'hex')));
create table app.modern_event_final_snapshots_v1(id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 qualification_id uuid not null,ownership_revision_id uuid not null,prize_revision_id uuid not null,fund_review_id uuid not null,regular_award_set_id uuid not null,pool_proposal_id uuid not null,pool_final_id uuid not null,
 source_digest text not null,source_capture jsonb not null,reason text not null,status text not null default'approved_unpaid_snapshot'check(status='approved_unpaid_snapshot'),approved_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.modern_event_final_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id),
 foreign key(prize_revision_id,tournament_id,event_id)references app.playoff_prize_proposal_revisions_v2(id,tournament_id,event_id),
 foreign key(fund_review_id,tournament_id,event_id)references app.selected_step_fund_reviews_v3(id,tournament_id,event_id),
 foreign key(regular_award_set_id,tournament_id,event_id)references app.selected_step_award_sets_v3(id,tournament_id,event_id),
 foreign key(pool_proposal_id,tournament_id,event_id)references app.selected_step_pool_revisions_v3(id,tournament_id,event_id),
 foreign key(pool_final_id,tournament_id,event_id)references app.selected_step_pool_finals_v3(id,tournament_id,event_id),
 check(source_digest~'^[a-f0-9]{64}$'and source_capture->>'sourceDigest'=source_digest)
);
create table app.modern_event_final_outcomes_v1(actor_id uuid not null,operation_id uuid not null,result jsonb not null,primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.modern_event_final_operations_v1(actor_id,operation_id));
create function app.current_modern_event_final_source_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare s jsonb;p jsonb;f app.selected_step_pool_finals_v3%rowtype;a app.manual_pool_final_authorizations_v1%rowtype;receipt jsonb;original_receipt jsonb;c jsonb;digest text;begin
 if app.modern_event_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 s:=app.current_manual_pool_final_source_v1(actor,sid,tid,eid);if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code',coalesce(s->>'code','current_manual_financial_source_required'));end if;
 p:=app.current_manual_pool_result_v1(actor,sid,tid,eid);if p->>'status'='retry_exact'then return p;end if;
 if p->>'status'is distinct from'source_available'or p->'currentSourceVerified'is distinct from'true'::jsonb or p->'historicalOnly'is distinct from'false'::jsonb or p->'sourceCapture'is distinct from s->'poolSource'
 then return jsonb_build_object('status','blocked','code','current_completed_pool_journal_required');end if;
 select*into f from app.selected_step_pool_finals_v3 where id=(p->>'finalId')::uuid and tournament_id=tid and event_id=eid;
 select*into a from app.manual_pool_final_authorizations_v1 where actor_id=f.actor_id and operation_id=f.operation_id and tournament_id=tid and event_id=eid;
 select result into receipt from app.manual_pool_final_outcomes_v1 where actor_id=f.actor_id and operation_id=f.operation_id;
 select result into original_receipt from app.selected_step_pool_outcomes_v3 where actor_id=f.actor_id and operation_id=f.operation_id;
 if f.id is null or a.operation_id is null or a.source_capture is distinct from s or a.source_digest is distinct from s->>'sourceDigest'
  or receipt->>'status'is distinct from'accepted'or receipt->>'poolFinalId'is distinct from f.id::text or receipt->'innerReceipt'is distinct from original_receipt
  or original_receipt->>'status'is distinct from'awards_recorded_unpaid'or original_receipt->>'finalId'is distinct from f.id::text
  or f.proposal_revision_id::text is distinct from s->>'poolProposalRevisionId'
 then return jsonb_build_object('status','blocked','code','current_manual_pool_approval_required');end if;
 c:=jsonb_build_object('kind','modern-event-final-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'qualificationId',s->'qualificationId','ownershipRevisionId',s->'ownershipRevisionId','prizeRevisionId',s->'prizeRevisionId','fundReviewId',s->'fundReviewId',
  'regularAwardSetId',s->'regularAwardSetId','poolProposalRevisionId',s->'poolProposalRevisionId','poolFinalId',f.id,
  'regularMinor',s#>'{regularRecord,totalMinor}','qMinor',f.q_minor,'sideMinor',f.side_minor,
  'capture',jsonb_build_object('financialSource',s,'poolResults',p,'poolApproval',jsonb_build_object('actorId',a.actor_id,'operationId',a.operation_id,'requestHash',a.request_hash,'sourceDigest',a.source_digest,'approvedAt',a.created_at)),
  'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false,'accSubmissionPerformed',false,'registrationOverridesBlocking',false);
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 digest:=encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex');return c||jsonb_build_object('status','source_available','sourceDigest',digest);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.guard_modern_event_final_snapshot_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare o app.modern_event_final_operations_v1%rowtype;s jsonb;begin
 select*into o from app.modern_event_final_operations_v1 where actor_id=new.actor_id and operation_id=new.operation_id and tournament_id=new.tournament_id and event_id=new.event_id;
 if o.operation_id is null or o.request->'approved'is distinct from'true'::jsonb then raise exception'modern_event_approval_required';end if;
 s:=app.current_modern_event_final_source_v1(o.actor_id,o.session_id,o.tournament_id,o.event_id);
 if s->>'status'is distinct from'source_available'or s is distinct from new.source_capture or s->>'sourceDigest'is distinct from new.source_digest or o.request->>'expectedSourceDigest'is distinct from new.source_digest
  or new.qualification_id::text is distinct from s->>'qualificationId'or new.ownership_revision_id::text is distinct from s->>'ownershipRevisionId'or new.prize_revision_id::text is distinct from s->>'prizeRevisionId'
  or new.fund_review_id::text is distinct from s->>'fundReviewId'or new.regular_award_set_id::text is distinct from s->>'regularAwardSetId'or new.pool_proposal_id::text is distinct from s->>'poolProposalRevisionId'or new.pool_final_id::text is distinct from s->>'poolFinalId'
  or o.request->>'qualificationId'is distinct from new.qualification_id::text or o.request->>'ownershipRevisionId'is distinct from new.ownership_revision_id::text or o.request->>'prizeRevisionId'is distinct from new.prize_revision_id::text or o.request->>'fundReviewId'is distinct from new.fund_review_id::text or o.request->>'regularAwardSetId'is distinct from new.regular_award_set_id::text or o.request->>'poolProposalRevisionId'is distinct from new.pool_proposal_id::text or o.request->>'poolFinalId'is distinct from new.pool_final_id::text
  or new.reason is distinct from o.request->>'reason'or new.status is distinct from'approved_unpaid_snapshot'
 then raise exception'modern_event_final_insert_source_changed';end if;return new;end$$;
create trigger current_source before insert on app.modern_event_final_snapshots_v1 for each row execute function app.guard_modern_event_final_snapshot_v1();
create function app.record_modern_event_final_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare prior app.modern_event_final_operations_v1%rowtype;s jsonb;h text;r jsonb;final_id uuid:=extensions.gen_random_uuid();k text;begin
 if app.modern_event_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_unsupported');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array['kind','expectedSourceDigest','qualificationId','ownershipRevisionId','prizeRevisionId','fundReviewId','regularAwardSetId','poolProposalRevisionId','poolFinalId','approved','reason'])is distinct from true
  or request->>'kind'is distinct from'modern-event-finalize-v1'or request->'approved'is distinct from'true'::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->'reason')is distinct from true
  or jsonb_typeof(request->'expectedSourceDigest')is distinct from'string'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 foreach k in array array['qualificationId','ownershipRevisionId','prizeRevisionId','fundReviewId','regularAwardSetId','poolProposalRevisionId','poolFinalId']loop if jsonb_typeof(request->k)is distinct from'string'or coalesce(request->>k,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;end loop;
 if not pg_try_advisory_xact_lock(hashtextextended('modern-event-final:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('modern-event-final-request-v1',actor,tid,eid,op,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.modern_event_final_operations_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
  select result into r from app.modern_event_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end if;
 if exists(select 1 from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','event_finalization_already_recorded');end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)or exists(select 1 from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 s:=app.current_modern_event_final_source_v1(actor,sid,tid,eid);if s->>'status'='retry_exact'then return s;end if;
 if s->>'status'is distinct from'source_available'then return jsonb_build_object('status','rejected','code',coalesce(s->>'code','current_source_required'));end if;
 if s->>'sourceDigest'is distinct from request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','review_source_changed');end if;
 foreach k in array array['qualificationId','ownershipRevisionId','prizeRevisionId','fundReviewId','regularAwardSetId','poolProposalRevisionId','poolFinalId']loop if s->k is distinct from request->k then return jsonb_build_object('status','rejected','code','review_source_changed');end if;end loop;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.modern_event_final_operations_v1 values(actor,op,tid,eid,sid,request,h);
 insert into app.modern_event_final_snapshots_v1(id,tournament_id,event_id,actor_id,operation_id,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,pool_proposal_id,pool_final_id,source_digest,source_capture,reason)
 values(final_id,tid,eid,actor,op,(s->>'qualificationId')::uuid,(s->>'ownershipRevisionId')::uuid,(s->>'prizeRevisionId')::uuid,(s->>'fundReviewId')::uuid,(s->>'regularAwardSetId')::uuid,(s->>'poolProposalRevisionId')::uuid,(s->>'poolFinalId')::uuid,s->>'sourceDigest',s,request->>'reason');
 r:=jsonb_build_object('kind','modern-event-final-receipt-v1','status','accepted','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'requestHash',h,'snapshotId',final_id,'sourceDigest',s->'sourceDigest','historicalReceipt',true,'currentSourceVerified',false,
  'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false,'accSubmissionPerformed',false,'registrationOverridesBlocking',false);
 insert into app.modern_event_final_outcomes_v1 values(actor,op,r);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'modern_event_final_v1',final_id,'approved_unpaid_snapshot',r||jsonb_build_object('sessionId',sid));
 return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function public.get_modern_event_final_workspace_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare s jsonb;r app.modern_event_final_snapshots_v1%rowtype;begin
 if app.modern_event_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 s:=app.current_modern_event_final_source_v1(actor,sid,tid,eid);if s->>'status'='retry_exact'then return s;end if;
 select*into r from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid;
 if s->>'status'is distinct from'source_available'or(r.id is not null and(r.source_capture is distinct from s or r.source_digest is distinct from s->>'sourceDigest'))then return jsonb_build_object('status','held','code',case when r.id is not null then'final_snapshot_source_changed'else coalesce(s->>'code','current_source_required')end,'historicalSnapshotId',r.id,'currentSourceVerified',false);end if;
 return jsonb_build_object('kind','modern-event-final-workspace-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'status',case when r.id is null then'review'else'recorded'end,'source',s,'record',case when r.id is null then null else to_jsonb(r)end,'currentSourceVerified',true,'moneyMoved',false,'officialMrpAwarded',false);exception when raise_exception then
 if sqlerrm<>'playoff_prize_proposal_head_inconsistent'then raise;end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 select*into r from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid;
 return jsonb_build_object('status','held','code',case when r.id is null then'proposal_source_integrity_review_required'else'final_snapshot_source_changed'end,'historicalSnapshotId',r.id,'currentSourceVerified',false);
end$$;
create function public.get_modern_event_final_operation_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare o app.modern_event_final_operations_v1%rowtype;r jsonb;begin
 if app.modern_event_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 select*into o from app.modern_event_final_operations_v1 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if o.tournament_id<>tid or o.event_id<>eid or o.request is distinct from request then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 select result into r from app.modern_event_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object('status','retry_exact','code','operation_incomplete'));end$$;
create function public.record_modern_event_final_provider_v1(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language sql security definer set search_path=''as $$select app.record_modern_event_final_v1(actor,sid,tid,eid,op,request)$$;
do $security$declare t text;r record;begin
 foreach t in array array['modern_event_final_operations_v1','modern_event_final_snapshots_v1','modern_event_final_outcomes_v1']loop
  execute format('alter table app.%I owner to postgres',t);execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',t);execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',t);
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='app'and p.proname in('modern_event_finalization_enabled_v1','current_modern_event_final_source_v1','guard_modern_event_final_snapshot_v1','record_modern_event_final_v1'))or(n.nspname='public'and p.proname in('get_modern_event_final_workspace_v1','get_modern_event_final_operation_v1','record_modern_event_final_provider_v1'))loop execute format('alter function %s owner to postgres',r.signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;
end$security$;
commit;
