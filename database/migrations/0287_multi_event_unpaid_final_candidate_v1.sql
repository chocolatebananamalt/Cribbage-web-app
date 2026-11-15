-- LOCAL CANDIDATE ONLY. Public finalization remains disabled until structured
-- multi-event lifecycle, source-freeze and concurrency proof is complete.
begin;
do $$begin if current_user<>'postgres' then raise exception 'Reviewed postgres migration owner required';end if;end$$;
create table app.multi_event_joint_finals_v1(
 id uuid primary key,tournament_id uuid not null unique references app.tournaments(id),
 joint_digest text not null check(joint_digest~'^[a-f0-9]{64}$'),manifest jsonb not null,
 reason text not null,actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),unique(id,tournament_id)
);
alter table app.multi_event_joint_finals_v1 enable row level security;
alter table app.multi_event_joint_finals_v1 force row level security;
revoke all on app.multi_event_joint_finals_v1 from public,anon,authenticated,service_role;
create trigger multi_event_joint_finals_immutable_v1 before update or delete on app.multi_event_joint_finals_v1 for each row execute function app.reject_immutable_history();
create index multi_event_joint_finals_receipt_v1 on app.multi_event_joint_finals_v1(operation_receipt_id,tournament_id);
create table app.multi_event_unpaid_finals_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,joint_id uuid not null,draft_id uuid not null,closure_id uuid not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),closure_digest text not null check(closure_digest~'^[a-f0-9]{64}$'),
 financial_snapshot jsonb not null check(jsonb_typeof(financial_snapshot)='object'),
 reason text not null check(length(reason) between 21 and 500 and left(reason,20)='TEST ONLY SYNTHETIC:'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null,
 money_moved boolean not null default false check(not money_moved),human_review_claimed boolean not null default false check(not human_review_claimed),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(joint_id,tournament_id) references app.multi_event_joint_finals_v1(id,tournament_id),
 foreign key(draft_id,tournament_id,event_id) references app.multi_event_unpaid_drafts_v1(id,tournament_id,event_id),
 foreign key(closure_id,tournament_id,event_id) references app.synthetic_event_crosscheck_closures_v1(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),unique(event_id),unique(id,tournament_id,event_id)
);
alter table app.multi_event_unpaid_finals_v1 enable row level security;
alter table app.multi_event_unpaid_finals_v1 force row level security;
revoke all on app.multi_event_unpaid_finals_v1 from public,anon,authenticated,service_role;
create trigger multi_event_unpaid_finals_immutable_v1 before update or delete on app.multi_event_unpaid_finals_v1 for each row execute function app.reject_immutable_history();
create index multi_event_unpaid_finals_draft_v1 on app.multi_event_unpaid_finals_v1(draft_id,tournament_id,event_id);
create index multi_event_unpaid_finals_closure_v1 on app.multi_event_unpaid_finals_v1(closure_id,tournament_id,event_id);
create index multi_event_unpaid_finals_receipt_v1 on app.multi_event_unpaid_finals_v1(operation_receipt_id,tournament_id);

-- Pure validation of the source-backed snapshot. No amount is accepted from
-- the caller; subsidy/funding is rejected until a supported source exists.
create function app.valid_multi_event_final_totals_v1(preview jsonb,classified jsonb,assessment bigint)returns boolean
language plpgsql immutable set search_path=''as $$
declare x jsonb;regular numeric:=0;pools numeric:=0;pool_amount numeric;fund numeric;base numeric;q numeric;side numeric;expense numeric;residual numeric;begin
 if preview->>'status' is distinct from 'preview' or preview->'moneyMoved' is distinct from 'false'::jsonb or preview->'accountingAvailable' is distinct from 'false'::jsonb
 or classified->>'status' is distinct from 'available' or classified->'moneyMoved' is distinct from 'false'::jsonb or assessment is null or assessment<0
 or jsonb_typeof(preview->'regularAwards') is distinct from 'array' or jsonb_typeof(preview->'pools') is distinct from 'array' then return false;end if;
 foreach x in array array[preview->'baseIncomeMinor',preview->'qIncomeMinor',preview->'sideIncomeMinor',preview->'expenseMinor',preview->'benefitMinor',preview->'requiredFundingMinor',preview->'restrictedResidualMinor'] loop
  if jsonb_typeof(x) is distinct from 'number' or (x#>>'{}')!~'^[0-9]{1,16}$' or (x#>>'{}')::numeric>9007199254740991 then return false;end if;
 end loop;
 base:=(preview->>'baseIncomeMinor')::numeric;q:=(preview->>'qIncomeMinor')::numeric;side:=(preview->>'sideIncomeMinor')::numeric;
 expense:=(preview->>'expenseMinor')::numeric;residual:=(preview->>'restrictedResidualMinor')::numeric;
 if (preview->>'requiredFundingMinor')::numeric<>0 or residual>=500 or expense>base
  or preview->'baseIncomeMinor' is distinct from classified->'baseIncomeMinor' or preview->'qIncomeMinor' is distinct from classified->'qIncomeMinor'
  or preview->'sideIncomeMinor' is distinct from classified->'sideIncomeMinor' or preview->'expenseMinor' is distinct from classified->'classifiedExpenses'->'expenseMinor'
  or preview->'benefitMinor' is distinct from classified->'classifiedExpenses'->'benefitMinor'
  or (classified->'classifiedExpenses'->>'sanctioningMinor')::numeric is distinct from assessment::numeric then return false;end if;
 if jsonb_array_length(preview->'regularAwards') not in(4,5) then return false;end if;
 for x in select value from jsonb_array_elements(preview->'regularAwards') loop
  if coalesce(x->>'participantId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(x->'amountMinor') is distinct from 'number' or coalesce(x->>'amountMinor','')!~'^[0-9]{1,16}$'
   or (x->>'amountMinor')::numeric<0 or mod((x->>'amountMinor')::numeric,500)<>0 then return false;end if;
  regular:=regular+(x->>'amountMinor')::numeric;
 end loop;
 if (select count(distinct value->>'participantId') from jsonb_array_elements(preview->'regularAwards'))<>jsonb_array_length(preview->'regularAwards') then return false;end if;
 for x in select value from jsonb_array_elements(preview->'pools') loop
  if x->'calculation'->>'status' is distinct from 'calculated' or x->'calculation'->'moneyMoved' is distinct from 'false'::jsonb
   or jsonb_typeof(x->'calculation'->'fundMinor') is distinct from 'number' or coalesce(x->'calculation'->>'fundMinor','')!~'^[0-9]{1,16}$'
   or jsonb_typeof(x->'calculation'->'awards') is distinct from 'array' then return false;end if;
  fund:=(x->'calculation'->>'fundMinor')::numeric;pool_amount:=0;
  if exists(select 1 from jsonb_array_elements(x->'calculation'->'awards') a where coalesce(a->>'participantId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or jsonb_typeof(a->'amountMinor') is distinct from 'number' or coalesce(a->>'amountMinor','')!~'^[0-9]{1,16}$') then return false;end if;
  select coalesce(sum((a->>'amountMinor')::numeric),0) into pool_amount from jsonb_array_elements(x->'calculation'->'awards') a;
  if pool_amount<>fund then return false;end if;pools:=pools+pool_amount;
 end loop;
 return pools=q+side and base+q+side=expense+regular+pools+residual;
exception when others then return false;end$$;
revoke all on function app.valid_multi_event_final_totals_v1(jsonb,jsonb,bigint) from public,anon,authenticated,service_role;

-- All active events must be supported and ready together. This deliberately
-- avoids claiming independent finality while the source reader is global.
create function app.multi_event_joint_final_candidate_workspace_v1(actor uuid,tid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare e record;draft app.multi_event_unpaid_drafts_v1%rowtype;closure app.synthetic_event_crosscheck_closures_v1%rowtype;
 preview jsonb;classified jsonb;readiness jsonb;assessment bigint;items jsonb:='[]';manifest jsonb;count_events integer;begin
 if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director') then return null;end if;
 if not exists(select 1 from app.tournaments where id=tid and status in('open','pending_finalization')) then return jsonb_build_object('status','blocked','code','tournament_unavailable','moneyMoved',false);end if;
 if exists(select 1 from app.multi_event_joint_finals_v1 where tournament_id=tid) then return jsonb_build_object('status','blocked','code','already_finalized','moneyMoved',false);end if;
 select count(*) into count_events from app.events where tournament_id=tid and operational_state='active';
 if count_events<>2 or (select count(*) from app.events where tournament_id=tid and operational_state='active' and event_type='main')<>1
  or (select count(*) from app.events where tournament_id=tid and operational_state='active' and event_type='consolation')<>1 then return jsonb_build_object('status','blocked','code','unsupported_event_set','moneyMoved',false);end if;
 if exists(select 1 from app.events ev left join app.tournament_setup_activations a on a.event_id=ev.id and a.tournament_id=ev.tournament_id left join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id
  where ev.tournament_id=tid and ev.operational_state='active' and (a.id is null or ev.event_type not in('main','consolation') or ev.format<>'standard_singles' or s.event_kind is distinct from ev.event_type or s.format_code<>'standard_singles' or s.style_code<>'Standard' or s.entry_fee_cents<=0)) then return jsonb_build_object('status','blocked','code','unsupported_event_set','moneyMoved',false);end if;
 for e in select id from app.events where tournament_id=tid and operational_state='active' order by id loop
  select * into draft from app.multi_event_unpaid_drafts_v1 where tournament_id=tid and event_id=e.id order by version desc limit 1;
  select * into closure from app.synthetic_event_crosscheck_closures_v1 where tournament_id=tid and event_id=e.id;
  if draft.id is null or closure.id is null or closure.human_review_claimed or closure.physical_play_claimed then return jsonb_build_object('status','blocked','code','draft_or_closure_required','eventId',e.id,'moneyMoved',false);end if;
  if exists(select 1 from jsonb_array_elements_text(closure.reviewer_profile_ids) reviewer where not exists(select 1 from app.tournament_roles r where r.tournament_id=tid and r.profile_id=reviewer::uuid and r.role='cross_checker')) then return jsonb_build_object('status','blocked','code','crosschecker_role_required','eventId',e.id,'moneyMoved',false);end if;
  preview:=public.get_multi_event_award_preview_v1(actor,tid,e.id);classified:=public.get_classified_multi_event_sources_v1(actor,tid,e.id);
  readiness:=app.synthetic_event_crosscheck_readiness_candidate_v1(actor,tid,e.id);assessment:=app.settlement_assessment_v5(e.id);
  if readiness->>'status' is distinct from 'candidate_ready' or readiness->>'sourceDigest' is distinct from closure.source_digest then return jsonb_build_object('status','blocked','code','closure_stale','eventId',e.id,'moneyMoved',false);end if;
  if preview->>'status' is distinct from 'preview' or preview is distinct from draft.preview or preview->>'sourceDigest' is distinct from draft.source_digest then return jsonb_build_object('status','blocked','code','draft_stale','eventId',e.id,'moneyMoved',false);end if;
  if not app.valid_multi_event_final_totals_v1(preview,classified,assessment) then return jsonb_build_object('status','blocked','code','financial_conservation_failed','eventId',e.id,'moneyMoved',false);end if;
  items:=items||jsonb_build_array(jsonb_build_object('eventId',e.id,'draftId',draft.id,'closureId',closure.id,'closure',to_jsonb(closure),
   'reviewerRolesAtFinal',(select coalesce(jsonb_agg(jsonb_build_object('profileId',reviewer,'role','cross_checker') order by reviewer),'[]'::jsonb) from jsonb_array_elements_text(closure.reviewer_profile_ids) reviewer),
   'sourceDigest',draft.source_digest,'closureDigest',closure.source_digest,
   'preview',preview,'classifiedSource',classified,'classifiedExpenses',classified->'classifiedExpenses',
   'expenseReview',(select to_jsonb(er) from app.multi_event_expense_reviews_v1 er where er.tournament_id=tid and er.event_id=e.id and er.id::text=classified->>'expenseReviewId'),
   'assessmentMinor',assessment));
 end loop;
 manifest:=jsonb_build_object('version','synthetic-joint-unpaid-final-v1','tournamentId',tid,'finalizingDirector',jsonb_build_object('profileId',actor,'role','director'),'events',items,'moneyMoved',false,'humanReviewClaimed',false);
 return jsonb_build_object('status','candidate_ready','tournamentId',tid,'jointDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'moneyMoved',false,'humanReviewClaimed',false);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','source_invalid','moneyMoved',false);end$$;
revoke all on function app.multi_event_joint_final_candidate_workspace_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function app.write_multi_event_joint_final_candidate_v1(actor uuid,tid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.operation_receipts%rowtype;locked uuid[];event_id uuid;item jsonb;state jsonb;h text;response jsonb;code text;stamp timestamptz;tournament_status text;
 jid uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();begin
 if coalesce(auth.role(),'')<>'service_role' or actor is null or tid is null or op is null then return jsonb_build_object('status','rejected','code','invalid_request','moneyMoved',false);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into locked from app.events where tournament_id=tid and operational_state='active';
 foreach event_id in array locked loop perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:'||event_id::text,0));end loop;
 foreach event_id in array locked loop perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||event_id::text,0));end loop;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('multi-event-joint-source:'||tid::text,0)) then return jsonb_build_object('status','rejected','code','joint_finalization_in_progress','moneyMoved',false);end if;
 select status into tournament_status from app.tournaments where id=tid for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable','moneyMoved',false);end if;
 -- Hold existing scoped roles only for this transaction so the role evidence
 -- cannot be revoked between validation and snapshot. Never freeze revocation.
 begin
  perform 1 from app.tournament_roles where tournament_id=tid and (profile_id=actor and role='director' or role='cross_checker') order by profile_id,role for share nowait;
 exception when lock_not_available then return jsonb_build_object('status','rejected','code','joint_finalization_in_progress','moneyMoved',false);end;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director') then return jsonb_build_object('status','rejected','code','not_director','moneyMoved',false);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_joint_final_candidate_v1',actor,tid,req)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.target_id=tid and prior.operation_type='multi_event_joint_final_candidate_v1' and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict','moneyMoved',false);end if;
 if tournament_status not in('open','pending_finalization') then return jsonb_build_object('status','rejected','code','tournament_unavailable','moneyMoved',false);end if;
 if locked is distinct from coalesce((select array_agg(id order by id) from app.events where tournament_id=tid and operational_state='active'),'{}'::uuid[]) then return jsonb_build_object('status','rejected','code','source_changed','moneyMoved',false);end if;
 perform 1 from app.events where tournament_id=tid and id=any(locked) order by id for update;
 perform 1 from app.canonical_games g where g.tournament_id=tid and g.event_id=any(locked) order by g.event_id,g.id for update;
 begin
  if jsonb_typeof(req) is distinct from 'object' or (select count(*)from jsonb_object_keys(req))<>3 or not(req?&array['jointDigest','reason','reviewed'])
   or jsonb_typeof(req->'jointDigest') is distinct from 'string' or coalesce(req->>'jointDigest','')!~'^[a-f0-9]{64}$' or req->'reviewed' is distinct from 'true'::jsonb
   or jsonb_typeof(req->'reason') is distinct from 'string' or length(req->>'reason') not between 21 and 500 or trim(req->>'reason')<>req->>'reason' or req->>'reason'~'[[:cntrl:]]' or left(req->>'reason',20)<>'TEST ONLY SYNTHETIC:' or length(trim(substr(req->>'reason',21)))=0 then raise exception 'invalid_request';end if;
  if exists(select 1 from app.multi_event_joint_finals_v1 where tournament_id=tid) then raise exception 'already_finalized';end if;
  state:=app.multi_event_joint_final_candidate_workspace_v1(actor,tid);
  if state->>'status' is distinct from 'candidate_ready' then raise exception 'sources_not_ready';end if;
  if state->>'jointDigest' is distinct from req->>'jointDigest' then raise exception 'source_changed';end if;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','synthetic_joint_unpaid_finalized','tournamentId',tid,'jointFinalId',jid,'jointDigest',state->>'jointDigest','eventCount',jsonb_array_length(state->'manifest'->'events'),'moneyMoved',false,'humanReviewClaimed',false,'recordedAt',stamp);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','already_finalized','sources_not_ready','source_changed') then sqlerrm else 'invalid_request' end;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','rejected','code',code,'moneyMoved',false);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt,tid,actor,'multi_event_joint_final_candidate_v1',tid,h,op,case when code is null then 'accepted' else 'rejected' end,response,stamp);
 if code is null then
  insert into app.multi_event_joint_finals_v1(id,tournament_id,joint_digest,manifest,reason,actor_id,operation_receipt_id,recorded_at)values(jid,tid,state->>'jointDigest',state->'manifest',req->>'reason',actor,receipt,stamp);
  for item in select value from jsonb_array_elements(state->'manifest'->'events') loop
   insert into app.multi_event_unpaid_finals_v1(id,tournament_id,event_id,joint_id,draft_id,closure_id,source_digest,closure_digest,financial_snapshot,reason,actor_id,operation_receipt_id,recorded_at)
   values(extensions.gen_random_uuid(),tid,(item->>'eventId')::uuid,jid,(item->>'draftId')::uuid,(item->>'closureId')::uuid,item->>'sourceDigest',item->>'closureDigest',item,req->>'reason',actor,receipt,stamp);
  end loop;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'multi_event_joint_unpaid_final',case when code is null then jid else tid end,case when code is null then 'synthetic_joint_unpaid_finalized' else 'synthetic_joint_unpaid_final_rejected' end,response);
 return response;
end$$;
revoke all on function app.write_multi_event_joint_final_candidate_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;

create function app.get_multi_event_joint_final_candidate_v1(actor uuid,tid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare f app.multi_event_joint_finals_v1%rowtype;begin
 if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')) then return null;end if;
 select * into f from app.multi_event_joint_finals_v1 where tournament_id=tid;
 if f.id is null then return jsonb_build_object('status','not_finalized','tournamentId',tid,'financialClosed',false,'moneyMoved',false);end if;
 return jsonb_build_object('status','synthetic_joint_unpaid_finalized','tournamentId',tid,'jointFinalId',f.id,'jointDigest',f.joint_digest,'manifest',f.manifest,'financialClosed',true,'moneyMoved',false,'humanReviewClaimed',false,'recordedAt',f.recorded_at);
end$$;
revoke all on function app.get_multi_event_joint_final_candidate_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Only opted-in multi-event tournaments participate. A try-lock avoids a cycle
-- when an existing writer holds a source row or tournament row before this
-- trigger. Transactions touching two events may retry; no event is frozen until
-- a joint final exists, and other tournaments never take this tournament key.
create function app.guard_multi_event_joint_source_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare t uuid;begin
 for t in select distinct x from unnest(array[(to_jsonb(new)->>'tournament_id')::uuid,(to_jsonb(old)->>'tournament_id')::uuid])x where x is not null order by x loop
  if not exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=t) then continue;end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('multi-event-joint-source:'||t::text,0)) then raise exception 'joint_finalization_in_progress';end if;
  if exists(select 1 from app.multi_event_joint_finals_v1 where tournament_id=t) then raise exception 'joint_financially_closed';end if;
 end loop;
 return case when tg_op='DELETE' then old else new end;
end$$;
revoke all on function app.guard_multi_event_joint_source_v1() from public,anon,authenticated,service_role;
create function app.multi_event_joint_write_blocker_v1(tid uuid)returns text language plpgsql volatile security definer set search_path=''as $$begin
 if not exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=tid) then return null;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('multi-event-joint-source:'||tid::text,0)) then return 'joint_finalization_in_progress';end if;
 if exists(select 1 from app.multi_event_joint_finals_v1 where tournament_id=tid) then return 'joint_financially_closed';end if;return null;
end$$;
revoke all on function app.multi_event_joint_write_blocker_v1(uuid) from public,anon,authenticated,service_role;
do $$declare n text;begin foreach n in array array[
 'multi_event_finance_sources_v1','multi_event_pool_receipts_v1','multi_event_pool_disclosures_v1','multi_event_pool_elections_v1','multi_event_expense_reviews_v1','multi_event_unpaid_drafts_v1',
 'synthetic_event_crosscheck_closures_v1','synthetic_event_artifacts_v1','synthetic_event_provenance_v1','synthetic_paper_fixtures_v1','synthetic_paper_artifacts_v1','synthetic_paper_provenance_v1',
 'tournament_setup_revisions','tournament_setup_event_versions','tournament_setup_q_pool_versions','tournament_setup_side_pool_versions','tournament_setup_side_pool_materializations','tournament_setup_activations','setup_prize_schedule_versions_v2','event_prize_schedule_bindings_v2','event_sanctioning_fee_snapshots',
 'events','event_participants','tournament_roster_entries','ruleset_versions','event_side_pools','event_side_pool_definition_versions',
 'event_schedule_publications','event_schedule_games','event_play_starts','canonical_games','event_team_games','operational_game_forfeits','score_submissions','score_confirmations','card_scorelines',
 'independent_card_corrections','independent_card_correction_lifecycles','independent_card_correction_state_events','game_corrections','correction_state_events','device_failure_recoveries','device_failure_recovery_state_events',
 'event_disputes','event_dispute_state_events','hybrid_game_cases','hybrid_game_state_events','paper_game_completions','paper_game_completion_reviews','paper_game_completion_state_events',
 'paper_game_completion_evidence','paper_game_completion_reviews','event_play_closes','qualification_result_versions','qualification_result_rows','qualification_tie_resolutions_v1',
 'playoff_outcome_versions_v3','playoff_outcome_versions_v4','consolation_playoff_outcome_versions_v1'
 ] loop
 if not exists(select 1 from pg_attribute where attrelid=to_regclass('app.'||n) and attname='tournament_id' and not attisdropped) then raise exception 'joint source guard table lacks tournament_id: %',n;end if;
 if exists(select 1 from pg_trigger where tgrelid=to_regclass('app.'||n) and tgname='a0_joint_source_guard_v1' and not tgisinternal) then continue;end if;
 execute format('create trigger a0_joint_source_guard_v1 before insert or update or delete on app.%I for each row execute function app.guard_multi_event_joint_source_v1()',n);
 end loop;end$$;

-- Give normal finance writers structured outcomes after their exact replay
-- checks, while the table triggers remain the final race-safe backstop.
do $patch$declare signature text;anchor text;definition text;guard text;begin
 for signature,anchor in select * from (values
  ('public.record_multi_event_finance_source_v1(uuid,uuid,jsonb,uuid)','select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;'),
  ('public.publish_multi_event_pool_disclosure_v1(uuid,uuid,uuid,jsonb,uuid)','select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;'),
  ('public.record_multi_event_simulated_pool_election_v1(uuid,uuid,uuid,jsonb,uuid)','select * into mode from app.multi_event_finance_modes_v1 where tournament_id=tid;'),
  ('public.record_multi_event_synthetic_pool_receipt_v1(uuid,uuid,jsonb,uuid)','finance:=public.get_multi_event_finance_workspace_v1(actor,tid);'),
  ('public.review_multi_event_expenses_v1(uuid,uuid,uuid,jsonb,uuid)','source:=public.get_multi_event_synthetic_event_sources_v1(actor,tid,eid);'),
  ('app.write_multi_event_unpaid_draft_candidate_v1(uuid,uuid,uuid,jsonb,uuid)','preview:=public.get_multi_event_award_preview_v1(actor,tid,eid);'),
  ('app.close_synthetic_event_crosscheck_candidate_v1(uuid,uuid,uuid,jsonb,uuid)','readiness:=app.synthetic_event_crosscheck_readiness_candidate_v1(actor,tid,eid);')
 )x(signature,anchor) loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'joint source writer anchor changed: %',signature;end if;
  guard:='declare joint_blocker text:=app.multi_event_joint_write_blocker_v1(tid); begin if joint_blocker is not null then return jsonb_build_object(''status'',''rejected'',''code'',joint_blocker);end if; end;'||chr(10)||' '||anchor;
  execute replace(definition,anchor,guard);
 end loop;
 signature:='public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid)';anchor:='if not coalesce(app.valid_consolation_playoff_request_v1(req),false) then raise exception ''invalid_request'';end if;';
 definition:=pg_get_functiondef(signature::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'joint playoff writer anchor changed';end if;
 guard:='declare joint_blocker text:=app.multi_event_joint_write_blocker_v1(tid); begin if joint_blocker is not null then return jsonb_build_object(''status'',''rejected'',''code'',joint_blocker,''eventId'',eid);end if; end;'||chr(10)||'  '||anchor;
 execute replace(definition,anchor,guard);
end$patch$;

-- Public finalization is fail-closed pending full structured positive proof.
create function public.finalize_multi_event_unpaid_v1(actor uuid,tid uuid,req jsonb,op uuid)returns jsonb language sql immutable set search_path=''as $$select jsonb_build_object('status','rejected','code','structured_final_verification_pending','moneyMoved',false);$$;
revoke all on function public.finalize_multi_event_unpaid_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.finalize_multi_event_unpaid_v1(uuid,uuid,jsonb,uuid) to service_role;
commit;
