-- LOCAL ONLY. Explicit paid-card recipient policy; no disbursement or combined finalization.
-- Existing v2 amount schedules, legacy payouts and v8 accounting remain untouched.
begin;
create table app.side_pool_recipient_policies_v3(
 id uuid primary key default extensions.gen_random_uuid(),pool_id uuid not null unique,tournament_id uuid not null,event_id uuid not null,
 amount_policy_id uuid not null,method text not null check(method='paid-qualifying-cards-no-cutoff-v3'),
 disclosure_reference text not null check(length(trim(disclosure_reference))between 1 and 500),actor_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,published_at timestamptz not null default clock_timestamp(),
 foreign key(pool_id,tournament_id,event_id)references app.event_side_pools(id,tournament_id,event_id),
 foreign key(amount_policy_id,tournament_id,event_id)references app.side_pool_graduated_policies_v2(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(id,tournament_id,event_id));
alter table app.side_pool_recipient_policies_v3 enable row level security;
alter table app.side_pool_recipient_policies_v3 force row level security;
revoke all on app.side_pool_recipient_policies_v3 from public,anon,authenticated,service_role;
create trigger side_pool_recipient_policies_v3_immutable before update or delete on app.side_pool_recipient_policies_v3 for each row execute function app.reject_immutable_history();
create index side_pool_recipient_policies_v3_actor_idx on app.side_pool_recipient_policies_v3(actor_id);
create index side_pool_recipient_policies_v3_receipt_idx on app.side_pool_recipient_policies_v3(operation_receipt_id,tournament_id);
create index side_pool_recipient_policies_v3_amount_idx on app.side_pool_recipient_policies_v3(amount_policy_id,tournament_id,event_id);
create table app.side_pool_recipient_reviews_v3(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,pool_id uuid not null,
 policy_id uuid not null,recipient_policy_id uuid not null,qualification_id uuid not null,version integer not null check(version between 1 and 256),
 supersedes_id uuid references app.side_pool_recipient_reviews_v3(id),source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 source_manifest jsonb not null,obligations jsonb not null check(jsonb_typeof(obligations)='array'),
 status text not null default 'unpaid' check(status='unpaid'),reason text not null check(length(trim(reason))between 1 and 500),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(pool_id,tournament_id,event_id)references app.event_side_pools(id,tournament_id,event_id),
 foreign key(policy_id,tournament_id,event_id)references app.side_pool_graduated_policies_v2(id,tournament_id,event_id),
 foreign key(recipient_policy_id,tournament_id,event_id)references app.side_pool_recipient_policies_v3(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(pool_id,version),unique(pool_id,source_digest));
alter table app.side_pool_recipient_reviews_v3 enable row level security;
alter table app.side_pool_recipient_reviews_v3 force row level security;
revoke all on app.side_pool_recipient_reviews_v3 from public,anon,authenticated,service_role;
create trigger side_pool_recipient_reviews_v3_immutable before update or delete on app.side_pool_recipient_reviews_v3 for each row execute function app.reject_immutable_history();
create index side_pool_recipient_reviews_v3_actor_idx on app.side_pool_recipient_reviews_v3(actor_id);
create index side_pool_recipient_reviews_v3_receipt_idx on app.side_pool_recipient_reviews_v3(operation_receipt_id,tournament_id);
create index side_pool_recipient_reviews_v3_qualification_idx on app.side_pool_recipient_reviews_v3(qualification_id,tournament_id,event_id);
create index side_pool_recipient_reviews_v3_policy_idx on app.side_pool_recipient_reviews_v3(policy_id,tournament_id,event_id);
create index side_pool_recipient_reviews_v3_recipient_policy_idx on app.side_pool_recipient_reviews_v3(recipient_policy_id,tournament_id,event_id);
create index side_pool_recipient_reviews_v3_previous_idx on app.side_pool_recipient_reviews_v3(supersedes_id);

create function app.side_pool_recipient_source_v3(tid uuid,eid uuid,pool uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare s jsonb;q app.qualification_result_versions%rowtype;policy app.side_pool_recipient_policies_v3%rowtype;cards jsonb;blocks jsonb;manifest jsonb;obligations jsonb:='[]';begin
 s:=app.side_pool_graduated_source_v2(tid,eid,pool);if s is null then return null;end if;
 blocks:=s->'blockers';
 select*into policy from app.side_pool_recipient_policies_v3 where tournament_id=tid and event_id=eid and pool_id=pool;
 if policy.id is null or policy.amount_policy_id::text is distinct from s->'policy'->>'id' then blocks:=blocks||jsonb_build_array('recipient_policy_required');end if;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null or app.qualification_resolution_snapshot_current_v1(q.id)is distinct from true then blocks:=blocks||jsonb_build_array('current_finalized_qualification_required');end if;
 -- Complete paid set, never filtered by playoff qualification or arbitrary UUID order.
 select coalesce(jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'gamePoints',r.game_points,'gamesWon',r.games_won,'plusPoints',r.plus_points,'qualified',r.qualification_status='qualified')order by r.game_points desc,r.games_won desc,r.plus_points desc),'[]')into cards
 from app.qualification_result_rows r join jsonb_array_elements(s->'entries')e on e->>'participantId'=r.participant_id::text
 where r.result_version_id=q.id and e->>'elected'='true' and(e->>'receivedMinor')::bigint=(s->>'feeMinor')::bigint and(e->>'dueMinor')::bigint=(s->>'feeMinor')::bigint;
 if jsonb_array_length(cards)<>(s->>'paidCount')::integer then blocks:=blocks||jsonb_build_array('paid_card_missing');end if;
 if exists(select 1 from jsonb_array_elements(cards)c group by c->'gamePoints',c->'gamesWon',c->'plusPoints' having count(*)>1)then blocks:=blocks||jsonb_build_array('cash_tie_policy_unresolved');end if;
 if jsonb_array_length(blocks)=0 then
  select coalesce(jsonb_agg(jsonb_build_object('participantId',c->'participantId','displayName',c->'displayName','poolRank',i,'qualified',c->'qualified','amountMinor',(s->'calculation'->'awardsMinor')->((i-1)::integer),'status','unpaid')order by i),'[]')into obligations
  from jsonb_array_elements(cards)with ordinality x(c,i)where i<=(s->'calculation'->>'recipientCount')::integer;
  if jsonb_array_length(obligations)<>(s->'calculation'->>'recipientCount')::integer or(select coalesce(sum((o->>'amountMinor')::bigint),0)from jsonb_array_elements(obligations)o)<>(s->'calculation'->>'fundMinor')::bigint then blocks:=blocks||jsonb_build_array('non_conserving_pool');obligations:='[]';end if;
 end if;
 manifest:=jsonb_build_object('version','side-paid-card-unpaid-v3','amountSource',s,'recipientPolicy',to_jsonb(policy),'qualification',to_jsonb(q),'cards',cards,'blockers',blocks);
 return jsonb_build_object('eventId',eid,'poolId',pool,'policyId',s->'policy'->'id','recipientPolicyId',policy.id,'feeMinor',s->'feeMinor','ratio',s->'policy'->'ratio','recipientPolicy',case when policy.id is null then null else jsonb_build_object('id',policy.id,'method',policy.method,'amountPolicyId',policy.amount_policy_id,'disclosureReference',policy.disclosure_reference,'publishedAt',policy.published_at)end,'qualificationId',q.id,'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'fundMinor',s->'calculation'->'fundMinor','obligations',obligations,'moneyMoved',false);
end$$;
revoke all on function app.side_pool_recipient_source_v3(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function public.publish_side_pool_recipient_policy_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare r app.operation_receipts%rowtype;p app.side_pool_graduated_policies_v2%rowtype;h text;response jsonb;code text;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or p_operation_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open')for update;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')for update;if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('event-start:'||p_event_id::text,0));
 perform 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id for update;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_recipient_policy_v3',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then if r.tournament_id=p_tournament_id and r.target_id=p_pool_id and r.operation_type='side_pool_recipient_policy_v3'and r.request_hash=h then return r.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 begin
  if jsonb_typeof(p_request)is distinct from'object'or(select count(*)from jsonb_object_keys(p_request))<>4 or not(p_request?&array['amountPolicyId','method','disclosureReference','disclosed'])or p_request->>'method'is distinct from'paid-qualifying-cards-no-cutoff-v3'or p_request->'disclosed'is distinct from'true'::jsonb or jsonb_typeof(p_request->'disclosureReference')is distinct from'string'or length(trim(p_request->>'disclosureReference'))not between 1 and 500 or p_request->>'disclosureReference'<>trim(p_request->>'disclosureReference')or p_request->>'disclosureReference'~'[[:cntrl:]]'then raise exception'invalid_request';end if;
  select*into p from app.side_pool_graduated_policies_v2 where pool_id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id;
  if p.id is null or p.id::text is distinct from p_request->>'amountPolicyId'then raise exception'amount_policy_required';end if;
  if exists(select 1 from app.side_pool_recipient_policies_v3 where pool_id=p_pool_id)then raise exception'policy_frozen';end if;
  if app.event_play_state_v1(p_event_id)in('in_progress','completed','finalized')or exists(select 1 from app.event_side_pool_election_versions where pool_id=p_pool_id)then raise exception'collection_or_play_started';end if;
  response:=jsonb_build_object('status','side_pool_recipient_policy_frozen','policyId',rid,'poolId',p_pool_id,'moneyMoved',false);
 exception when raise_exception then code:=case when sqlerrm in('invalid_request','amount_policy_required','policy_frozen','collection_or_play_started')then sqlerrm else'invalid_request'end;response:=jsonb_build_object('status','rejected','code',code);end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,p_tournament_id,p_actor_id,'side_pool_recipient_policy_v3',p_pool_id,h,p_operation_id,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then insert into app.side_pool_recipient_policies_v3(id,pool_id,tournament_id,event_id,amount_policy_id,method,disclosure_reference,actor_id,operation_receipt_id)values(rid,p_pool_id,p_tournament_id,p_event_id,p.id,'paid-qualifying-cards-no-cutoff-v3',p_request->>'disclosureReference',p_actor_id,oid);end if;return response;
end$$;

create function public.get_side_pool_recipient_workspace_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare s jsonb;history jsonb;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 s:=app.side_pool_recipient_source_v3(p_tournament_id,p_event_id,p_pool_id);if s is null then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'sourceDigest',r.source_digest,'current',r.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0,'obligations',r.obligations,'status',r.status,'reason',r.reason,'recordedAt',r.recorded_at)order by r.version desc),'[]')into history from app.side_pool_recipient_reviews_v3 r where r.tournament_id=p_tournament_id and r.event_id=p_event_id and r.pool_id=p_pool_id;
 return(s-'manifest')||jsonb_build_object('tournamentId',p_tournament_id,'history',history);
end$$;

create function public.record_side_pool_recipient_review_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.operation_receipts%rowtype;s jsonb;h text;response jsonb;code text;v integer;previous uuid;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or p_operation_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||p_event_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('open','pending_finalization')for update;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')for update;if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('event-start:'||p_event_id::text,0));
 perform 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id for update;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_recipient_review_v3',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then if prior.tournament_id=p_tournament_id and prior.target_id=p_pool_id and prior.operation_type='side_pool_recipient_review_v3'and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 begin
  if jsonb_typeof(p_request)is distinct from'object'or(select count(*)from jsonb_object_keys(p_request))<>4 or not(p_request?&array['expectedVersion','sourceDigest','reason','reviewed'])or p_request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(p_request->'expectedVersion')is distinct from'number'or p_request->>'expectedVersion'!~'^(0|[1-9][0-9]*)$'or(p_request->>'expectedVersion')::numeric>255 or coalesce(p_request->>'sourceDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(p_request->'reason')is distinct from'string'or length(trim(p_request->>'reason'))not between 1 and 500 or p_request->>'reason'<>trim(p_request->>'reason')or p_request->>'reason'~'[[:cntrl:]]'then raise exception'invalid_request';end if;
  if exists(select 1 from app.prize_accounting_finals_v8 where event_id=p_event_id)then raise exception'accounting_already_finalized';end if;
  s:=app.side_pool_recipient_source_v3(p_tournament_id,p_event_id,p_pool_id);
  if s is null or jsonb_array_length(s->'blockers')<>0 then raise exception'source_blocked';end if;
  if s->>'sourceDigest'is distinct from p_request->>'sourceDigest'then raise exception'source_changed';end if;
  select version,id into v,previous from app.side_pool_recipient_reviews_v3 where pool_id=p_pool_id order by version desc limit 1;
  if coalesce(v,0)<>(p_request->>'expectedVersion')::integer then raise exception'stale_version';end if;
  if exists(select 1 from app.side_pool_recipient_reviews_v3 where pool_id=p_pool_id and source_digest=s->>'sourceDigest')then raise exception'already_reviewed';end if;
  response:=jsonb_build_object('status','side_pool_recipients_reviewed_unpaid','reviewId',rid,'poolId',p_pool_id,'version',coalesce(v,0)+1,'sourceDigest',s->>'sourceDigest','obligations',s->'obligations','moneyMoved',false);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','accounting_already_finalized','source_blocked','source_changed','stale_version','already_reviewed')then sqlerrm else'invalid_request'end;response:=jsonb_build_object('status','rejected','code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,p_tournament_id,p_actor_id,'side_pool_recipient_review_v3',p_pool_id,h,p_operation_id,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then
  insert into app.side_pool_recipient_reviews_v3(id,tournament_id,event_id,pool_id,policy_id,recipient_policy_id,qualification_id,version,supersedes_id,source_digest,source_manifest,obligations,reason,actor_id,operation_receipt_id)values(rid,p_tournament_id,p_event_id,p_pool_id,(s->>'policyId')::uuid,(s->>'recipientPolicyId')::uuid,(s->>'qualificationId')::uuid,coalesce(v,0)+1,previous,s->>'sourceDigest',s->'manifest',s->'obligations',p_request->>'reason',p_actor_id,oid);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,oid,'side_pool_recipient_review',rid,'side_pool_recipients_reviewed_unpaid',response);
 end if;return response;
end$$;

create function public.get_side_pool_recipient_reconciliation_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare r app.operation_receipts%rowtype;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))or not exists(select 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id)then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_recipient_review_v3',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)::text,'utf8'),'sha256'),'hex');select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 return jsonb_build_object('authorized',true,'result',case when r.id is null then null when r.tournament_id=p_tournament_id and r.target_id=p_pool_id and r.operation_type='side_pool_recipient_review_v3'and r.request_hash=h then r.response_payload else jsonb_build_object('status','rejected','code','idempotency_conflict')end);
end$$;
revoke all on function public.get_side_pool_recipient_workspace_v3(uuid,uuid,uuid,uuid),public.record_side_pool_recipient_review_v3(uuid,uuid,uuid,uuid,jsonb,uuid),public.get_side_pool_recipient_reconciliation_v3(uuid,uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.publish_side_pool_recipient_policy_v3(uuid,uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.publish_side_pool_recipient_policy_v3(uuid,uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.get_side_pool_recipient_workspace_v3(uuid,uuid,uuid,uuid),public.record_side_pool_recipient_review_v3(uuid,uuid,uuid,uuid,jsonb,uuid),public.get_side_pool_recipient_reconciliation_v3(uuid,uuid,uuid,uuid,jsonb,uuid)to service_role;
commit;
