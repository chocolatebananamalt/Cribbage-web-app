-- LOCAL ONLY. Disclosed Side Pool formula and reviewed unpaid ranked amounts.
-- No recipient ranking is invented; these are amount schedules, not payments.
begin;
create table app.side_pool_graduated_policies_v2(
 id uuid primary key default extensions.gen_random_uuid(),pool_id uuid not null unique,tournament_id uuid not null,event_id uuid not null,
 definition_version_id uuid not null,method text not null check(method='graduated-acc-weighted-largest-remainder-5usd-v2'),
 ratio integer not null check(ratio between 2 and 100),disclosure_reference text not null check(length(trim(disclosure_reference))between 1 and 500),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,published_at timestamptz not null default clock_timestamp(),
 foreign key(pool_id,tournament_id,event_id)references app.event_side_pools(id,tournament_id,event_id),
 foreign key(definition_version_id,tournament_id,event_id)references app.event_side_pool_definition_versions(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(id,tournament_id,event_id));
create table app.side_pool_amount_reviews_v2(
 id uuid primary key default extensions.gen_random_uuid(),pool_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 policy_id uuid not null,version integer not null check(version between 1 and 256),supersedes_id uuid references app.side_pool_amount_reviews_v2(id),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),source_manifest jsonb not null,calculation jsonb not null,
 status text not null default 'unpaid_amount_schedule'check(status='unpaid_amount_schedule'),reason text not null check(length(trim(reason))between 1 and 500),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(pool_id,tournament_id,event_id)references app.event_side_pools(id,tournament_id,event_id),
 foreign key(policy_id,tournament_id,event_id)references app.side_pool_graduated_policies_v2(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(pool_id,version));
do $$declare n text;begin foreach n in array array['side_pool_graduated_policies_v2','side_pool_amount_reviews_v2']loop
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id,event_id)',n||'_scope_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_receipt_idx',n);
end loop;end$$;
create index side_pool_amount_review_policy_idx on app.side_pool_amount_reviews_v2(policy_id,tournament_id,event_id);
create index side_pool_amount_review_supersedes_idx on app.side_pool_amount_reviews_v2(supersedes_id);

-- Same pool row mutex for formula adoption, old policy/election writes and
-- amount reviews. Never change or revoke existing legacy pool functionality.
create function app.guard_side_pool_graduated_v2()returns trigger language plpgsql security definer set search_path=''as $$
declare p app.side_pool_graduated_policies_v2%rowtype;begin
 perform 1 from app.event_side_pools where id=new.pool_id and tournament_id=new.tournament_id and event_id=new.event_id for update;
 select*into p from app.side_pool_graduated_policies_v2 where pool_id=new.pool_id;
 if tg_table_name='side_pool_graduated_policies_v2'then
  if exists(select 1 from app.event_side_pool_policy_versions where pool_id=new.pool_id)or exists(select 1 from app.event_side_pool_election_versions where pool_id=new.pool_id)or exists(select 1 from app.event_side_pool_team_election_versions where pool_id=new.pool_id)or exists(select 1 from app.event_side_pool_payout_versions where pool_id=new.pool_id)or exists(select 1 from app.event_side_pool_team_payout_versions where pool_id=new.pool_id)or exists(select 1 from app.event_side_pool_reconciliations where pool_id=new.pool_id)then raise exception'legacy_pool_history_preserved';end if;
 elsif p.id is not null then
  if tg_table_name='event_side_pool_election_versions'then
   if not exists(select 1 from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id and operation_type='side_pool_graduated_v2_election')then raise exception'graduated_pool_versioned_entry_required';end if;
   if new.elected and(not starts_with(new.reason,'Side policy '||p.id::text||': ')or length(trim(substr(new.reason,length('Side policy '||p.id::text||': ')+1)))=0)then raise exception'side_policy_acknowledgment_required';end if;
  else raise exception'graduated_pool_unpaid_only';end if;
 end if;return new;
end$$;
revoke all on function app.guard_side_pool_graduated_v2()from public,anon,authenticated,service_role;
do $$declare n text;begin foreach n in array array['side_pool_graduated_policies_v2','event_side_pool_policy_versions','event_side_pool_definition_versions','event_side_pool_election_versions','event_side_pool_team_election_versions','event_side_pool_payout_versions','event_side_pool_team_payout_versions','event_side_pool_reconciliations']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_side_pool_graduated_v2()',n||'_graduated_v2',n);end loop;end$$;

create function app.side_pool_graduated_source_v2(tid uuid,eid uuid,pool uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare d app.event_side_pool_definition_versions%rowtype;p app.side_pool_graduated_policies_v2%rowtype;entries jsonb;manifest jsonb;blocks jsonb:='[]';calculation jsonb;paid integer;begin
 select*into d from app.event_side_pool_definition_versions where pool_id=pool and tournament_id=tid and event_id=eid order by version desc limit 1;
 if d.id is null then return null;end if;
 select*into p from app.side_pool_graduated_policies_v2 where pool_id=pool and tournament_id=tid and event_id=eid;
 with latest as(select distinct on(participant_id)*from app.event_side_pool_election_versions where pool_id=pool and tournament_id=tid and event_id=eid order by participant_id,version desc)
 select coalesce(jsonb_agg(to_jsonb(x)order by participant_id),'[]')into entries from latest x;
 if not d.active or not exists(select 1 from app.events where id=eid and tournament_id=tid and format='standard_singles')or exists(select 1 from app.event_side_pool_team_election_versions where pool_id=pool)then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 if p.id is null then blocks:=blocks||jsonb_build_array('disclosed_policy_required');
 elsif p.definition_version_id<>d.id then blocks:=blocks||jsonb_build_array('definition_changed');end if;
 if exists(select 1 from jsonb_array_elements(entries)x where(x->>'elected'='true'and((x->>'amount_due_minor')::bigint<>d.entry_fee_minor or(x->>'amount_received_minor')::bigint<>d.entry_fee_minor or not exists(select 1 from app.event_participants ep where ep.id=(x->>'participant_id')::uuid and ep.tournament_id=tid and ep.event_id=eid and ep.status in('registered','checked_in'))))or(x->>'elected'='false'and(x->>'amount_received_minor')::bigint<>0))then blocks:=blocks||jsonb_build_array('funding_unresolved');end if;
 select count(*)into paid from jsonb_array_elements(entries)x where x->>'elected'='true' and (x->>'amount_due_minor')::bigint=d.entry_fee_minor and (x->>'amount_received_minor')::bigint=d.entry_fee_minor;
 if p.id is not null and jsonb_array_length(blocks)=0 then
  calculation:=app.calculate_graduated_pool_amounts_v2(jsonb_build_object('paidCount',paid,'feeMinor',d.entry_fee_minor,'ratio',p.ratio));
  if calculation->>'status'is distinct from'calculated'then blocks:=blocks||jsonb_build_array('unsupported_payout_domain');end if;
 end if;
 manifest:=jsonb_build_object('version','side-pool-graduated-amounts-v2','definition',to_jsonb(d),'policy',to_jsonb(p),'entries',entries,'playState',app.event_play_state_v1(eid),'blockers',blocks);
 return jsonb_build_object('definitionId',d.id,'eventId',eid,'poolId',pool,'name',d.display_name,'feeMinor',d.entry_fee_minor,'policy',case when p.id is null then null else jsonb_build_object('id',p.id,'method',p.method,'ratio',p.ratio,'disclosureReference',p.disclosure_reference,'publishedAt',p.published_at)end,
 'paidCount',paid,'entries',(select coalesce(jsonb_agg(jsonb_build_object('participantId',x->'participant_id','electionId',x->'election_id','version',x->'version','elected',x->'elected','dueMinor',x->'amount_due_minor','receivedMinor',x->'amount_received_minor')order by x->>'participant_id'),'[]')from jsonb_array_elements(entries)x),
 'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'calculation',case when jsonb_array_length(blocks)=0 then calculation else null end);
end$$;
revoke all on function app.side_pool_graduated_source_v2(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function public.get_side_pool_graduated_workspace_v2(p_actor_id uuid,p_tournament_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare pools jsonb:='[]';r record;s jsonb;reviews jsonb;legacy jsonb;participants jsonb;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 legacy:=public.get_event_side_pool_workspace_v1(p_actor_id,p_tournament_id);
 for r in select sp.id,sp.event_id from app.event_side_pools sp where tournament_id=p_tournament_id order by event_id,id loop
  s:=app.side_pool_graduated_source_v2(p_tournament_id,r.event_id,r.id);if s is null then continue;end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'version',x.version,'sourceDigest',x.source_digest,'current',x.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0,'reason',x.reason,'calculation',x.calculation,'status',x.status,'recordedAt',x.recorded_at)order by version desc),'[]')into reviews from app.side_pool_amount_reviews_v2 x where pool_id=r.id;
  select value->'participants'into participants from jsonb_array_elements(legacy->'events')where value->>'eventId'=r.event_id::text;
  pools:=pools||jsonb_build_array((s-'manifest')||jsonb_build_object('history',reviews,'participants',coalesce(participants,'[]'),'started',app.event_play_state_v1(r.event_id)in('in_progress','completed','finalized'),'canPublish',s->'policy'='null'::jsonb and app.event_play_state_v1(r.event_id)not in('in_progress','completed','finalized')and not exists(select 1 from app.event_side_pool_policy_versions where pool_id=r.id)and not exists(select 1 from app.event_side_pool_election_versions where pool_id=r.id)and not exists(select 1 from app.event_side_pool_team_election_versions where pool_id=r.id),'moneyMoved',false));
 end loop;
 return jsonb_build_object('tournamentId',p_tournament_id,'pools',pools,'moneyMoved',false,'recipientSelection','not_assigned');
end$$;

create function app.write_side_pool_graduated_v2(actor uuid,tid uuid,eid uuid,pool uuid,request jsonb,op uuid,action text)returns jsonb language plpgsql security definer set search_path=''as $$
declare h text;prior app.operation_receipts%rowtype;receipt uuid:=extensions.gen_random_uuid();rid uuid:=extensions.gen_random_uuid();s jsonb;response jsonb;code text;ver integer;previous uuid;d app.event_side_pool_definition_versions%rowtype;p app.side_pool_graduated_policies_v2%rowtype;entry_row app.event_side_pool_election_versions%rowtype;participant uuid;election uuid;received integer;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or tid is null or eid is null or pool is null or op is null or action not in('policy','election','review')then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0));
 -- Match the event-start wrapper lock order: tournament, role, then event-start.
 perform 1 from app.tournaments where id=tid for update;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')for update;if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('event-start:'||eid::text,0));
 perform 1 from app.event_side_pools where id=pool and tournament_id=tid and event_id=eid for update;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_graduated_v2',action,actor,tid,eid,pool,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.tournament_id=tid and prior.target_id=pool and prior.operation_type='side_pool_graduated_v2_'||action and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 begin
  if jsonb_typeof(request)is distinct from'object'then raise exception'invalid_request';end if;
  s:=app.side_pool_graduated_source_v2(tid,eid,pool);select*into d from app.event_side_pool_definition_versions where id=(s->>'definitionId')::uuid;
  if not d.active or not exists(select 1 from app.events where id=eid and tournament_id=tid and format='standard_singles')then raise exception'unsupported_scope';end if;
  if action='policy'then
   if(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array['method','ratio','definitionVersionId','disclosureReference','disclosed'])or request->>'method'is distinct from'graduated-acc-weighted-largest-remainder-5usd-v2'or request->'disclosed'is distinct from'true'::jsonb or jsonb_typeof(request->'ratio')is distinct from'number'or(request->>'ratio')!~'^[1-9][0-9]*$'or(request->>'ratio')::numeric not between 2 and 100 or request->>'definitionVersionId'is distinct from d.id::text or jsonb_typeof(request->'disclosureReference')is distinct from'string'or length(trim(request->>'disclosureReference'))not between 1 and 500 or request->>'disclosureReference'<>trim(request->>'disclosureReference')or request->>'disclosureReference'~'[[:cntrl:]]'then raise exception'invalid_request';end if;
   if d.entry_fee_minor not between 500 and 100000000 or mod(d.entry_fee_minor,500)<>0 then raise exception'unsupported_payout_domain';end if;
   if s->'policy'<>'null'::jsonb then raise exception'policy_frozen';end if;
   if app.event_play_state_v1(eid)in('in_progress','completed','finalized')then raise exception'entries_locked';end if;
   response:=jsonb_build_object('status','side_pool_graduated_policy_frozen','policyId',rid,'poolId',pool,'moneyMoved',false);
   insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'side_pool_graduated_v2_policy',pool,h,op,'accepted',response,clock_timestamp());
   insert into app.side_pool_graduated_policies_v2(id,pool_id,tournament_id,event_id,definition_version_id,method,ratio,disclosure_reference,actor_id,operation_receipt_id)values(rid,pool,tid,eid,d.id,'graduated-acc-weighted-largest-remainder-5usd-v2',(request->>'ratio')::integer,request->>'disclosureReference',actor,receipt);
   response:=jsonb_build_object('status','side_pool_graduated_policy_frozen','policyId',rid,'poolId',pool,'moneyMoved',false);
  elsif action='election'then
   if(select count(*)from jsonb_object_keys(request))<>9 or not(request?&array['policyId','participantId','electionId','expectedVersion','elected','receivedMinor','paymentMethod','paymentReference','reason'])
    or coalesce(request->>'policyId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'or coalesce(request->>'participantId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'or coalesce(request->>'electionId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or jsonb_typeof(request->'expectedVersion')is distinct from'number'or(request->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'or(request->>'expectedVersion')::numeric>255
    or jsonb_typeof(request->'elected')is distinct from'boolean'or jsonb_typeof(request->'receivedMinor')is distinct from'number'or(request->>'receivedMinor')!~'^(0|[1-9][0-9]*)$'or(request->>'receivedMinor')::numeric>100000000
    or request->>'paymentMethod'not in('cash','check')or jsonb_typeof(request->'paymentReference')is distinct from'string'or length(request->>'paymentReference')>100
    or jsonb_typeof(request->'reason')is distinct from'string'or length(trim(request->>'reason'))not between 1 and 400 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'then raise exception'invalid_request';end if;
   select*into p from app.side_pool_graduated_policies_v2 where pool_id=pool;
   if p.id is null or request->>'policyId'is distinct from p.id::text then raise exception'disclosed_policy_required';end if;
   if app.event_play_state_v1(eid)in('in_progress','completed','finalized')then raise exception'entries_locked';end if;
   participant:=(request->>'participantId')::uuid;election:=(request->>'electionId')::uuid;received:=(request->>'receivedMinor')::integer;
   if not exists(select 1 from app.event_participants where id=participant and event_id=eid and tournament_id=tid and status in('registered','checked_in'))then raise exception'participant_unavailable';end if;
   select*into entry_row from app.event_side_pool_election_versions where pool_id=pool and participant_id=participant order by version desc limit 1;
   if coalesce(entry_row.version,0)<>(request->>'expectedVersion')::integer then raise exception'stale_version';end if;
   if received<coalesce(entry_row.amount_received_minor,0) or (entry_row.amount_received_minor>0 and request->'elected'='false'::jsonb) then raise exception'refund_resolution_required';end if;
   if(entry_row.id is not null and entry_row.election_id<>election)or exists(select 1 from app.event_side_pool_election_versions where election_id=election and(pool_id<>pool or participant_id<>participant))then raise exception'election_identity_conflict';end if;
   if(request->'elected'='true'::jsonb and received>d.entry_fee_minor)or(request->'elected'='false'::jsonb and received<>0)then raise exception'received_exceeds_due';end if;
   ver:=coalesce(entry_row.version,0)+1;response:=jsonb_build_object('status','side_pool_election_saved_v2','poolId',pool,'participantId',participant,'electionId',election,'version',ver,'moneyMoved',false);
   insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'side_pool_graduated_v2_election',pool,h,op,'accepted',response,clock_timestamp());
   insert into app.event_side_pool_election_versions(election_id,pool_id,tournament_id,event_id,participant_id,version,elected,amount_due_minor,amount_received_minor,payment_method,payment_reference,reason,actor_profile_id,operation_receipt_id)
   values(election,pool,tid,eid,participant,ver,(request->>'elected')::boolean,case when request->'elected'='true'::jsonb then d.entry_fee_minor else 0 end,received,request->>'paymentMethod',request->>'paymentReference','Side policy '||p.id::text||': '||(request->>'reason'),actor,receipt);
  else
   if(select count(*)from jsonb_object_keys(request))<>4 or not(request?&array['expectedVersion','sourceDigest','reason','reviewed'])or request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(request->'expectedVersion')is distinct from'number'or(request->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'or(request->>'expectedVersion')::numeric>255 or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(request->'reason')is distinct from'string'or length(trim(request->>'reason'))not between 1 and 500 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'then raise exception'invalid_request';end if;
   if jsonb_array_length(s->'blockers')<>0 or s->'calculation'='null'::jsonb then raise exception'source_blocked';end if;
   if app.event_play_state_v1(eid)not in('in_progress','completed','finalized')then raise exception'entries_not_locked';end if;
   if request->>'sourceDigest'is distinct from s->>'sourceDigest'then raise exception'source_changed';end if;
   select version,id into ver,previous from app.side_pool_amount_reviews_v2 where pool_id=pool order by version desc limit 1;
   if coalesce(ver,0)<>(request->>'expectedVersion')::integer then raise exception'stale_version';end if;
   if exists(select 1 from app.side_pool_amount_reviews_v2 where pool_id=pool and source_digest=s->>'sourceDigest')then raise exception'already_reviewed';end if;
   select*into p from app.side_pool_graduated_policies_v2 where pool_id=pool;
   response:=jsonb_build_object('status','side_pool_amounts_reviewed_unpaid','reviewId',rid,'poolId',pool,'version',coalesce(ver,0)+1,'sourceDigest',s->>'sourceDigest','moneyMoved',false);
   insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'side_pool_graduated_v2_review',pool,h,op,'accepted',response,clock_timestamp());
   insert into app.side_pool_amount_reviews_v2(id,pool_id,tournament_id,event_id,policy_id,version,supersedes_id,source_digest,source_manifest,calculation,reason,actor_id,operation_receipt_id)values(rid,pool,tid,eid,p.id,coalesce(ver,0)+1,previous,s->>'sourceDigest',s->'manifest',s->'calculation',request->>'reason',actor,receipt);
   response:=jsonb_build_object('status','side_pool_amounts_reviewed_unpaid','reviewId',rid,'poolId',pool,'version',coalesce(ver,0)+1,'sourceDigest',s->>'sourceDigest','moneyMoved',false);
  end if;
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm='side_pool_election_locked'then'entries_locked'when sqlerrm in('invalid_request','unsupported_scope','unsupported_payout_domain','policy_frozen','entries_locked','legacy_pool_history_preserved','source_blocked','entries_not_locked','source_changed','stale_version','already_reviewed','disclosed_policy_required','participant_unavailable','election_identity_conflict','received_exceeds_due','refund_resolution_required')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','code',code);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'side_pool_graduated_v2_'||action,pool,h,op,'rejected',response,null);
 end;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'side_pool_graduated_v2',pool,'side_pool_graduated_'||action,response);return response;
end$$;
revoke all on function app.write_side_pool_graduated_v2(uuid,uuid,uuid,uuid,jsonb,uuid,text)from public,anon,authenticated,service_role;
create function public.save_side_pool_graduated_policy_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_side_pool_graduated_v2(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request,p_operation_id,'policy');$$;
create function public.record_side_pool_amount_review_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_side_pool_graduated_v2(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request,p_operation_id,'review');$$;
create function public.save_side_pool_graduated_election_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_side_pool_graduated_v2(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request,p_operation_id,'election');$$;
create function public.get_side_pool_graduated_reconciliation_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid,p_action text)returns jsonb language plpgsql stable security definer set search_path=''as $$declare h text;r app.operation_receipts%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or p_action not in('policy','election','review')or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_graduated_v2',p_action,p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 return jsonb_build_object('authorized',true,'result',case when r.id is null then null when r.tournament_id=p_tournament_id and r.target_id=p_pool_id and r.operation_type='side_pool_graduated_v2_'||p_action and r.request_hash=h then r.response_payload else jsonb_build_object('status','rejected','code','idempotency_conflict')end);
end$$;
revoke all on function public.get_side_pool_graduated_workspace_v2(uuid,uuid),public.save_side_pool_graduated_policy_v2(uuid,uuid,uuid,uuid,jsonb,uuid),public.record_side_pool_amount_review_v2(uuid,uuid,uuid,uuid,jsonb,uuid),public.save_side_pool_graduated_election_v2(uuid,uuid,uuid,uuid,jsonb,uuid),public.get_side_pool_graduated_reconciliation_v2(uuid,uuid,uuid,uuid,jsonb,uuid,text)from public,anon,authenticated;
grant execute on function public.get_side_pool_graduated_workspace_v2(uuid,uuid),public.save_side_pool_graduated_policy_v2(uuid,uuid,uuid,uuid,jsonb,uuid),public.record_side_pool_amount_review_v2(uuid,uuid,uuid,uuid,jsonb,uuid),public.save_side_pool_graduated_election_v2(uuid,uuid,uuid,uuid,jsonb,uuid),public.get_side_pool_graduated_reconciliation_v2(uuid,uuid,uuid,uuid,jsonb,uuid,text)to service_role;
commit;
