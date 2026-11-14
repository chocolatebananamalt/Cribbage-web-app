-- PRIVATE DEFAULT-OFF. Full-fee late linked-Consolation receipts only.
-- Never void/rewrite a valid Main base receipt; no refunds/corrections/discounts.
begin;
create function app.consy_addon_payments_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create table app.consy_addon_payment_scopes_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,main_event_id uuid not null,
 activation_id uuid not null references app.tournament_setup_activations(id),setup_event_version_id uuid not null references app.tournament_setup_event_versions(id),fee_minor integer not null check(fee_minor>0),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(main_event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);
create table app.consy_addon_receipts_v1(
 id uuid primary key default extensions.gen_random_uuid(),charge_id uuid not null unique default extensions.gen_random_uuid(),scope_id uuid not null,tournament_id uuid not null,event_id uuid not null,roster_entry_id uuid not null,
 base_receipt_id uuid not null,amount_minor integer not null check(amount_minor>0),currency_code text not null check(currency_code='USD'),event_type text not null default 'received'check(event_type='received'),
 payment_method text not null check(payment_method in('cash','check')),payment_received_at timestamptz not null,receipt_note text not null check(length(trim(receipt_note))between 1 and 500),
 method_configuration jsonb not null,eligibility_capture jsonb not null,capture_digest text not null check(capture_digest~'^[a-f0-9]{64}$'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 check(id<>charge_id and charge_id<>base_receipt_id),unique(tournament_id,event_id,roster_entry_id),foreign key(scope_id,tournament_id,event_id)references app.consy_addon_payment_scopes_v1(id,tournament_id,event_id),
 foreign key(base_receipt_id,roster_entry_id,tournament_id)references app.roster_payment_events(id,roster_entry_id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);
create index consy_addon_base_v1 on app.consy_addon_receipts_v1(base_receipt_id);
do $$declare n text;begin foreach n in array array['consy_addon_payment_scopes_v1','consy_addon_receipts_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;
create trigger consy_addon_method_v1 before insert on app.consy_addon_receipts_v1 for each row execute function app.enforce_october_received_payment_method();
-- Preserve old function identities through explicit private delegates.
do $$declare n text;sig text;d text;c text;begin
 foreach n in array array['get_native_event_ledger_sources_v1','lock_native_ledger_sources_v1','event_qr_player_is_paid_and_enrolled','operational_event_finance_source_v1']loop
 sig:=case n when'get_native_event_ledger_sources_v1'then'uuid'when'lock_native_ledger_sources_v1'then''else'uuid,uuid,uuid'end;
 d:=pg_get_functiondef(to_regprocedure('app.'||n||'('||sig||')'));c:=replace(d,'FUNCTION app.'||n||'(','FUNCTION app.'||n||'_before_consy_addon(');if c=d then raise exception'consy_addon_delegate_anchor_changed';end if;execute c;
 execute format('alter function app.%I(%s)owner to postgres',n||'_before_consy_addon',sig);execute format('revoke all on function app.%I(%s)from public,anon,authenticated,service_role',n||'_before_consy_addon',sig);
 end loop;
end$$;
create or replace function app.lock_native_ledger_sources_v1()returns void language plpgsql security definer set search_path=''as $$begin
 perform app.lock_native_ledger_sources_v1_before_consy_addon();lock table app.consy_addon_payment_scopes_v1,app.consy_addon_receipts_v1 in share mode nowait;
end$$;
-- A new tagged contract has independent charge streams. Legacy output is exact.
create or replace function app.get_native_event_ledger_sources_v1(p_tournament_id uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare legacy jsonb;facts jsonb;receipts jsonb;bindings jsonb;history jsonb;h text;begin
 legacy:=app.get_native_event_ledger_sources_v1_before_consy_addon(p_tournament_id);if legacy->>'status'is distinct from'sources_available'then return legacy;end if;
 if not exists(select 1 from app.consy_addon_receipts_v1 where tournament_id=p_tournament_id)then return legacy;end if;
 if app.consy_addon_payments_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','consy_addon_source_disabled');end if;
 perform app.lock_native_ledger_sources_v1();legacy:=app.get_native_event_ledger_sources_v1_before_consy_addon(p_tournament_id);if legacy->>'status'is distinct from'sources_available'then return legacy;end if;
 if exists(select 1 from app.consy_addon_receipts_v1 r where r.tournament_id=p_tournament_id and(
  exists(select 1 from app.roster_payment_events p where p.id=r.id)or exists(select 1 from app.tournament_expense_events x where x.id=r.id)
  or exists(select 1 from app.native_unrestricted_income_sources_v1 i where i.physical_evidence_id=r.id)
  or exists(select 1 from app.native_unrestricted_income_records_v1 i where i.physical_evidence_id=r.id)))then return jsonb_build_object('status','blocked','code','consy_addon_physical_identity_conflict');end if;
 if exists(select 1 from app.consy_addon_receipts_v1 where tournament_id=p_tournament_id and app.consy_addon_receipt_valid_v1(id)is distinct from true)then return jsonb_build_object('status','blocked','code','consy_addon_receipt_unverified');end if;
 facts:=legacy->'facts';
 -- After an addon, the original full-Main receipt can fund ONLY that Main.
 select coalesce(jsonb_agg(case when exists(select 1 from app.consy_addon_receipts_v1 a where a.tournament_id=p_tournament_id and a.base_receipt_id=(v->>'sourceId')::uuid)
 then v||jsonb_build_object('eligibleEventIds',(select jsonb_agg(distinct s.main_event_id order by s.main_event_id)from app.consy_addon_receipts_v1 a join app.consy_addon_payment_scopes_v1 s on s.id=a.scope_id where a.tournament_id=p_tournament_id and a.base_receipt_id=(v->>'sourceId')::uuid))else v end order by v->>'sourceId'),'[]')into receipts from jsonb_array_elements(facts->'receiptEvents')v;
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',r.id,'physicalEvidenceId',r.id,'rosterEntryId',r.roster_entry_id,'amountMinor',r.amount_minor,'currency','USD','eligibleEventIds',jsonb_build_array(r.event_id))order by r.id),'[]')into bindings from app.consy_addon_receipts_v1 r where r.tournament_id=p_tournament_id;
 receipts:=receipts||bindings;
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',r.id,'chargeId',r.charge_id,'eventId',r.event_id,'rosterEntryId',r.roster_entry_id,'scopeId',r.scope_id,'mainEventId',s.main_event_id,'baseReceiptId',r.base_receipt_id,'setupEventVersionId',s.setup_event_version_id)order by r.id),'[]')into bindings from app.consy_addon_receipts_v1 r join app.consy_addon_payment_scopes_v1 s on s.id=r.scope_id where r.tournament_id=p_tournament_id;
 select coalesce(jsonb_agg(jsonb_build_object('kind','consolation_addon_receipt','sourceId',id,'ownerId',charge_id,'version',1,'state','received')order by id),'[]')into history from app.consy_addon_receipts_v1 where tournament_id=p_tournament_id;
 facts:=facts||jsonb_build_object('receiptEvents',receipts,'historyIds',(facts->'historyIds')||history,'addonBindings',bindings);
 if jsonb_array_length(facts->'receiptEvents')+jsonb_array_length(facts->'expenseEvents')>10000 or jsonb_array_length(facts->'historyIds')>20000 then return jsonb_build_object('status','blocked','code','technical_resource_bound');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-event-ledger-sources-consolation-addons-v1',p_tournament_id,facts)::text,'utf8'),'sha256'),'hex');
 return legacy||jsonb_build_object('kind','native-event-ledger-sources-consolation-addons-v1','sourceDigest',h,'facts',facts,'snapshotConsistency','locked_source_snapshot');
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
-- Legacy Main and historical Con paid checks are unchanged outside explicit scopes.
create or replace function app.event_qr_player_is_paid_and_enrolled(p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid)returns boolean language plpgsql stable security definer set search_path=''as $$
declare s app.consy_addon_payment_scopes_v1%rowtype;base_id uuid;begin
 select*into s from app.consy_addon_payment_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id;
 if s.id is null then return app.event_qr_player_is_paid_and_enrolled_before_consy_addon(p_tournament_id,p_event_id,p_roster_entry_id);end if;
 if app.consy_addon_payments_enabled_v1()is distinct from true or not exists(select 1 from app.event_participants p where p.tournament_id=p_tournament_id and p.event_id=p_event_id and p.roster_entry_id=p_roster_entry_id and p.status in('registered','checked_in'))then return false;end if;
 if not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id where a.id=s.activation_id and a.event_id=s.event_id and a.tournament_id=s.tournament_id and v.id=s.setup_event_version_id and v.entry_fee_cents=s.fee_minor)then return false;end if;
 if exists(select 1 from app.consy_addon_receipts_v1 r where r.scope_id=s.id and r.roster_entry_id=p_roster_entry_id and r.amount_minor=s.fee_minor and app.consy_addon_receipt_valid_v1(r.id))then return true;end if;
 return app.consy_prepaid_pair_current_v1(p_tournament_id,p_event_id,p_roster_entry_id);
end$$;
-- Once separately used, Main evidence cannot be voided or silently re-obligated.
create function app.guard_consy_addon_base_history_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.consy_addon_receipts_v1 r where r.tournament_id=new.tournament_id and r.roster_entry_id=new.roster_entry_id)then raise exception'consy_addon_event_scoped_correction_required';end if;return new;end$$;
create trigger consy_addon_base_payment_guard_v1 before insert on app.roster_payment_events for each row execute function app.guard_consy_addon_base_history_v1();
create trigger consy_addon_base_obligation_guard_v1 before insert on app.roster_payment_obligation_versions for each row execute function app.guard_consy_addon_base_history_v1();
-- Reciprocal physical-evidence protection includes every historical income row.
create function app.guard_consy_addon_income_identity_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 lock table app.consy_addon_receipts_v1 in share mode nowait;
 if exists(select 1 from app.consy_addon_receipts_v1 r where r.id=new.physical_evidence_id)then raise exception'consy_addon_physical_identity_conflict';end if;return new;end$$;
create trigger consy_addon_income_source_guard_v1 before insert on app.native_unrestricted_income_sources_v1 for each row execute function app.guard_consy_addon_income_identity_v1();
create trigger consy_addon_income_record_guard_v1 before insert on app.native_unrestricted_income_records_v1 for each row execute function app.guard_consy_addon_income_identity_v1();

-- A real combined prepayment must cover Main in full AND Con in full.
create function app.consy_prepaid_pair_current_v1(tid uuid,eid uuid,roster uuid)returns boolean language plpgsql stable security definer set search_path=''as $prepaid$
declare s app.consy_addon_payment_scopes_v1%rowtype;b app.roster_payment_events%rowtype;root jsonb;main_fee integer;begin
 select*into s from app.consy_addon_payment_scopes_v1 where tournament_id=tid and event_id=eid;if s.id is null then return false;end if;
 select v.entry_fee_cents into main_fee from app.tournament_setup_activations a join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id where a.tournament_id=tid and a.event_id=s.main_event_id;
 select*into b from app.roster_payment_events where tournament_id=tid and roster_entry_id=roster order by version desc limit 1;
 if main_fee is null or main_fee<=0 or b.id is null or b.event_type<>'received'or b.amount_minor::bigint<main_fee::bigint+s.fee_minor then return false;end if;
 select value into root from app.native_ledger_allocation_revisions_v1 h cross join lateral jsonb_array_elements(h.snapshot->'sources')where h.tournament_id=tid and h.version=(select max(version)from app.native_ledger_allocation_revisions_v1 where tournament_id=tid)and value->>'sourceId'=b.id::text;
 if root->>'state'is distinct from'active'or root->>'kind'is distinct from'entry_receipt'or root->>'physicalEvidenceId'is distinct from b.id::text or root->'amountMinor'is distinct from to_jsonb(b.amount_minor)or jsonb_typeof(root->'allocations')is distinct from'array'then return false;end if;
 if exists(select 1 from jsonb_array_elements(root->'allocations')p where p->>'bucket'is distinct from'regular_entry'or p->'poolId'is distinct from'null'::jsonb or p->'classificationReviewed'is distinct from'true'::jsonb or(p->>'amountMinor')::numeric<=0)then return false;end if;
 return(select sum((p->>'amountMinor')::numeric)from jsonb_array_elements(root->'allocations')p)=b.amount_minor
 and(select count(*)from jsonb_array_elements(root->'allocations')p where p->>'eventId'=s.main_event_id::text)=1
 and(select count(*)from jsonb_array_elements(root->'allocations')p where p->>'eventId'=eid::text)=1
 and exists(select 1 from jsonb_array_elements(root->'allocations')p where p->>'eventId'=s.main_event_id::text and(p->>'amountMinor')::numeric=main_fee)
 and exists(select 1 from jsonb_array_elements(root->'allocations')p where p->>'eventId'=eid::text and(p->>'amountMinor')::numeric=s.fee_minor);
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$prepaid$;

-- Shared locks: Main qualification/post-event precede tournament, then sources.
create function app.lock_consy_addon_context_v1(tid uuid,eid uuid)returns uuid language plpgsql security definer set search_path=''as $$declare m uuid;begin
 if current_setting('transaction_isolation')<>'read committed'then raise lock_not_available;end if;
 m:=app.linked_consolation_main_event_v1(tid,eid);if m is null then raise exception'consy_addon_link_required';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('qualification-finalization:'||m::text,0))or not pg_try_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||m::text,0))then raise lock_not_available;end if;
 perform 1 from app.tournaments where id=tid and status in('draft','open','pending_finalization')for update nowait;if not found then raise exception'consy_addon_tournament_unavailable';end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director')order by role for share nowait;if not found then raise exception'consy_addon_not_director';end if;
 if app.linked_consolation_main_event_v1(tid,eid)is distinct from m then raise exception'consy_addon_link_changed';end if;
 perform app.lock_native_ledger_sources_v1();perform app.lock_event_settings_playoff_sources_v1();
 lock table app.consolation_main_event_bindings_v1,app.linked_main_series_v1,app.playoff_series_matches_v1,app.playoff_series_generations_v1,app.playoff_series_results_v1,app.playoff_series_game_actions_v1,app.playoff_series_game_submissions_v1,app.playoff_series_game_confirmations_v1,app.playoff_series_verified_games_v1 in share mode nowait;
 return m;
end$$;
create function app.finish_consy_addon_operation_v1(tid uuid,eid uuid,op uuid,typ text,req jsonb,outcome jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare rid uuid;r jsonb;begin
 r:=outcome||jsonb_build_object('actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'operationId',op,'request',req,'moneyMoved',false,'bankReceiptVerified',false,'fundAvailable',false,'payoutAuthorized',false);
 insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(auth.uid(),tid,typ,eid,encode(extensions.digest(convert_to(jsonb_build_array(typ,auth.uid(),tid,eid,op,req)::text,'utf8'),'sha256'),'hex'),op,case when r->>'status'='rejected'then'rejected'else'accepted'end,r,clock_timestamp())returning id into rid;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,auth.uid(),rid,'consolation_entry_payment',eid,typ,r);
 return jsonb_build_object('operationReceiptId',rid,'result',r);
end$$;
create function app.open_consy_addon_scope_v1(tid uuid,eid uuid,req jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare op uuid;old app.operation_receipts%rowtype;m uuid;a app.tournament_setup_activations%rowtype;v app.tournament_setup_event_versions%rowtype;sid uuid:=extensions.gen_random_uuid();r jsonb;h text;begin
 if auth.uid()is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 begin op:=(req->>'operationId')::uuid;exception when invalid_text_representation then return jsonb_build_object('status','rejected','code','invalid_request');end;if op is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||op::text,0))then raise lock_not_available;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('consy_addon_scope_v1',auth.uid(),tid,eid,op,req)::text,'utf8'),'sha256'),'hex');
 select*into old from app.operation_receipts where actor_profile_id=auth.uid()and client_operation_id=op;
 if found then
 perform 1 from app.tournaments where id=tid for update nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 if old.tournament_id<>tid or old.operation_type<>'consy_addon_scope_v1'or old.request_hash<>h then return jsonb_build_object('status','rejected','code','operation_conflict');end if;return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);end if;
 m:=app.lock_consy_addon_context_v1(tid,eid);
 if app.consy_addon_payments_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if jsonb_typeof(req)is distinct from'object'or(select count(*)from jsonb_object_keys(req))<>5 or not(req?&array['kind','operationId','activationId','setupEventVersionId','confirmed'])or req->>'kind'is distinct from'consy-addon-scope-v1'or req->'confirmed'is distinct from'true'::jsonb then raise exception'consy_addon_invalid_request';end if;
 if exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)then raise exception'consy_addon_event_started';end if;
 if exists(select 1 from app.consy_addon_payment_scopes_v1 where tournament_id=tid and event_id=eid)then raise exception'consy_addon_scope_exists';end if;
 if not exists(select 1 from app.qualification_result_versions q where q.tournament_id=tid and q.event_id=m and q.version=(select max(version)from app.qualification_result_versions where tournament_id=tid and event_id=m)and app.qualification_resolution_snapshot_current_v1(q.id))then raise exception'consy_addon_main_qualification_required';end if;
 if(app.get_native_event_ledger_sources_v1(tid))#>'{facts,existingOptionalAllocationEvidence}'is distinct from'false'::jsonb then raise exception'consy_addon_optional_domain_unsupported';end if;
 if app.native_ledger_has_mixed_scope_v1(tid)is distinct from false or exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=tid)then raise exception'consy_addon_mixed_domain_unsupported';end if;
 select*into a from app.tournament_setup_activations where tournament_id=tid and event_id=eid;select*into v from app.tournament_setup_event_versions where id=a.setup_event_version_id;
 if a.id is null or a.id::text is distinct from req->>'activationId'or v.id::text is distinct from req->>'setupEventVersionId'or v.entry_fee_cents<=0 or v.event_kind<>'consolation'or v.format_code<>'standard_singles'or v.style_code<>'Standard'then raise exception'consy_addon_binding_changed';end if;
 r:=app.finish_consy_addon_operation_v1(tid,eid,op,'consy_addon_scope_v1',req,jsonb_build_object('status','scope_opened','scopeId',sid,'feeMinor',v.entry_fee_cents));
 insert into app.consy_addon_payment_scopes_v1(id,tournament_id,event_id,main_event_id,activation_id,setup_event_version_id,fee_minor,actor_id,operation_receipt_id)values(sid,tid,eid,m,a.id,v.id,v.entry_fee_cents,auth.uid(),(r->>'operationReceiptId')::uuid);
 return r->'result';
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
-- Source is per roster, not a tournament-wide current-receipt head. No money is moved.
create function app.get_consy_addon_receipt_source_v1(tid uuid,eid uuid,roster uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare m uuid;s app.consy_addon_payment_scopes_v1%rowtype;b app.roster_payment_events%rowtype;v app.tournament_setup_event_versions%rowtype;decision jsonb;part jsonb;c jsonb;config jsonb;receipt app.consy_addon_receipts_v1%rowtype;begin
 if auth.uid()is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director'))then return jsonb_build_object('status','blocked','code','not_director');end if;
 if app.consy_addon_payments_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 m:=app.lock_consy_addon_context_v1(tid,eid);select*into s from app.consy_addon_payment_scopes_v1 where tournament_id=tid and event_id=eid;
 if s.id is null then return jsonb_build_object('status','blocked','code','scope_required');end if;
 if s.main_event_id<>m or not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions sv on sv.id=a.setup_event_version_id where a.id=s.activation_id and a.event_id=eid and a.tournament_id=tid and sv.id=s.setup_event_version_id and sv.entry_fee_cents=s.fee_minor)then return jsonb_build_object('status','blocked','code','binding_changed');end if;
 if not exists(select 1 from app.event_participants where tournament_id=tid and event_id=eid and roster_entry_id=roster and status in('registered','checked_in'))then return jsonb_build_object('status','blocked','code','event_enrollment_required');end if;
 select*into receipt from app.consy_addon_receipts_v1 where scope_id=s.id and roster_entry_id=roster;
 if receipt.id is not null and app.consy_addon_receipt_valid_v1(receipt.id)is distinct from true then return jsonb_build_object('status','blocked','code','receipt_unverified');end if;
 if receipt.id is not null then return jsonb_build_object('status','recorded','receiptId',receipt.id,'chargeId',receipt.charge_id,'amountMinor',receipt.amount_minor,'baseReceiptId',receipt.base_receipt_id,'bankReceiptVerified',false,'moneyMoved',false);end if;
 if app.consy_prepaid_pair_current_v1(tid,eid,roster)then return jsonb_build_object('status','prepaid_recorded','amountMinor',s.fee_minor,'bankReceiptVerified',false,'moneyMoved',false);end if;
 if exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','event_started');end if;
 decision:=app.linked_consy_eligibility_v1(tid,eid,roster);if decision->>'status'is distinct from'eligible'then return jsonb_build_object('status','blocked','code','linked_main_eligibility_pending');end if;
 select*into b from app.roster_payment_events where tournament_id=tid and roster_entry_id=roster order by version desc limit 1;
 select sv.*into v from app.tournament_setup_activations a join app.tournament_setup_event_versions sv on sv.id=a.setup_event_version_id where a.tournament_id=tid and a.event_id=m;
 if b.id is null or b.event_type<>'received'or v.id is null or b.amount_minor<>v.entry_fee_cents or (select amount_owed_minor from app.roster_payment_obligation_versions where tournament_id=tid and roster_entry_id=roster order by version desc limit 1)is distinct from v.entry_fee_cents then return jsonb_build_object('status','blocked','code','full_main_base_receipt_required');end if;
 select value into part from app.native_ledger_allocation_revisions_v1 h cross join lateral jsonb_array_elements(h.snapshot->'sources')where h.tournament_id=tid and h.version=(select max(version)from app.native_ledger_allocation_revisions_v1 where tournament_id=tid)and value->>'sourceId'=b.id::text;
 if part->>'state'is distinct from'active'or part->>'physicalEvidenceId'is distinct from b.id::text or part->'allocations'is distinct from jsonb_build_array(jsonb_build_object('eventId',m,'bucket','regular_entry','poolId',null,'amountMinor',v.entry_fee_cents,'classificationReviewed',true))then return jsonb_build_object('status','blocked','code','main_only_classification_required');end if;
 select jsonb_build_object('version',version,'cashEnabled',cash_enabled,'checkEnabled',check_enabled)into config from app.tournament_payment_method_config_versions where tournament_id=tid order by version desc limit 1;config:=coalesce(config,jsonb_build_object('version',0,'cashEnabled',true,'checkEnabled',true));
 c:=jsonb_build_object('kind','consy-addon-receipt-source-v1','tournamentId',tid,'eventId',eid,'rosterEntryId',roster,'scopeId',s.id,'activationId',s.activation_id,'setupEventVersionId',s.setup_event_version_id,'mainEventId',m,'feeMinor',s.fee_minor,'baseReceiptId',b.id,'baseVersion',b.version,'baseAmountMinor',b.amount_minor,'baseAllocation',part->'allocations','eligibility',decision,'methodConfiguration',config);
 return jsonb_build_object('status','source_available','kind','consy-addon-receipt-source-v1','source',c,'sourceDigest',encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex'),'bankReceiptVerified',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.record_consy_addon_receipt_v1(tid uuid,eid uuid,roster uuid,req jsonb)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare op uuid;old app.operation_receipts%rowtype;m uuid;h text;src jsonb;c jsonb;r jsonb;rid uuid:=extensions.gen_random_uuid();charge uuid:=extensions.gen_random_uuid();stamp timestamptz;begin
 if auth.uid()is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 begin op:=(req->>'operationId')::uuid;exception when invalid_text_representation then return jsonb_build_object('status','rejected','code','invalid_request');end;if op is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||op::text,0))then raise lock_not_available;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('consy_addon_receipt_v1',auth.uid(),tid,eid,op,req)::text,'utf8'),'sha256'),'hex');
 select*into old from app.operation_receipts where actor_profile_id=auth.uid()and client_operation_id=op;
 if found then
 perform 1 from app.tournaments where id=tid for update nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director')order by role for share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 if old.tournament_id<>tid or old.operation_type<>'consy_addon_receipt_v1'or old.request_hash<>h or old.response_payload#>>'{request,rosterEntryId}'is distinct from roster::text then return jsonb_build_object('status','rejected','code','operation_conflict');end if;return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);end if;
 m:=app.lock_consy_addon_context_v1(tid,eid);
 if app.consy_addon_payments_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if jsonb_typeof(req)is distinct from'object'or(select count(*)from jsonb_object_keys(req))<>10 or not(req?&array['kind','operationId','rosterEntryId','sourceDigest','amountMinor','currency','paymentMethod','receivedAt','note','confirmed'])or req->>'kind'is distinct from'consy-addon-receipt-v1'or req->>'rosterEntryId'is distinct from roster::text or req->'confirmed'is distinct from'true'::jsonb or req->>'currency'is distinct from'USD'or req->>'paymentMethod'not in('cash','check')or jsonb_typeof(req->'note')is distinct from'string'or req->>'note'<>trim(req->>'note')or length(req->>'note')not between 1 and 500 or octet_length(req->>'note')>2000 then raise exception'consy_addon_invalid_request';end if;
 src:=app.get_consy_addon_receipt_source_v1(tid,eid,roster);if src->>'status'='retry_exact'then raise lock_not_available;end if;
 if src->>'status'is distinct from'source_available'then return(app.finish_consy_addon_operation_v1(tid,eid,op,'consy_addon_receipt_v1',req,jsonb_build_object('status','rejected','code',case when src->>'status'='recorded'then'already_recorded'when src->>'status'='prepaid_recorded'then'already_funded_prepaid'else coalesce(src->>'code','source_unavailable')end)))->'result';end if;
 c:=src->'source';if req->>'sourceDigest'is distinct from src->>'sourceDigest'or req->'amountMinor'is distinct from c->'feeMinor'then return(app.finish_consy_addon_operation_v1(tid,eid,op,'consy_addon_receipt_v1',req,jsonb_build_object('status','rejected','code','source_changed')))->'result';end if;
 begin stamp:=(req->>'receivedAt')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then raise exception'consy_addon_invalid_received_at';end;
 if stamp is null or stamp>clock_timestamp()then raise exception'consy_addon_invalid_received_at';end if;
 lock table app.consy_addon_receipts_v1 in share row exclusive mode nowait;lock table app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1 in share mode nowait;
 if exists(select 1 from app.roster_payment_events where id=rid)or exists(select 1 from app.tournament_expense_events where id=rid)or exists(select 1 from app.native_unrestricted_income_sources_v1 where physical_evidence_id=rid)or exists(select 1 from app.native_unrestricted_income_records_v1 where physical_evidence_id=rid)then raise exception'consy_addon_physical_identity_conflict';end if;
 r:=app.finish_consy_addon_operation_v1(tid,eid,op,'consy_addon_receipt_v1',req,jsonb_build_object('status','consolation_addon_recorded','receiptId',rid,'chargeId',charge,'rosterEntryId',roster,'amountMinor',(c->>'feeMinor')::integer));
 insert into app.consy_addon_receipts_v1(id,charge_id,scope_id,tournament_id,event_id,roster_entry_id,base_receipt_id,amount_minor,currency_code,payment_method,payment_received_at,receipt_note,method_configuration,eligibility_capture,capture_digest,actor_id,operation_receipt_id)
 values(rid,charge,(c->>'scopeId')::uuid,tid,eid,roster,(c->>'baseReceiptId')::uuid,(c->>'feeMinor')::integer,'USD',req->>'paymentMethod',stamp,req->>'note',c->'methodConfiguration',c,src->>'sourceDigest',auth.uid(),(r->>'operationReceiptId')::uuid);
 return r->'result';
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.get_consy_addon_operation_v1(tid uuid,eid uuid,op uuid)returns jsonb language sql stable security definer set search_path=''as $$select response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false) from app.operation_receipts where actor_profile_id=auth.uid()and tournament_id=tid and target_id=eid and client_operation_id=op and operation_type in('consy_addon_scope_v1','consy_addon_receipt_v1')and exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director'))$$;

-- Historical receipt validity uses captured method config, never today's options.
create function app.consy_addon_receipt_valid_v1(rid uuid)returns boolean language plpgsql stable security definer set search_path=''set timezone='UTC'as $valid$
declare r app.consy_addon_receipts_v1%rowtype;s app.consy_addon_payment_scopes_v1%rowtype;b app.roster_payment_events%rowtype;o app.operation_receipts%rowtype;c jsonb;cfg jsonb;begin
 select*into r from app.consy_addon_receipts_v1 where id=rid;if r.id is null then return false;end if;
 select*into s from app.consy_addon_payment_scopes_v1 where id=r.scope_id;select*into b from app.roster_payment_events where id=r.base_receipt_id;select*into o from app.operation_receipts where id=r.operation_receipt_id;c:=r.eligibility_capture;
 if s.id is null or b.id is null or o.id is null or r.id=r.charge_id or r.tournament_id<>s.tournament_id or r.event_id<>s.event_id or r.amount_minor<>s.fee_minor
 or b.tournament_id<>r.tournament_id or b.roster_entry_id<>r.roster_entry_id or b.event_type<>'received'or b.version<>(select max(version)from app.roster_payment_events where roster_entry_id=r.roster_entry_id)
 or r.payment_received_at>r.recorded_at or c->>'kind'is distinct from'consy-addon-receipt-source-v1'or c->>'scopeId'is distinct from s.id::text or c->>'tournamentId'is distinct from r.tournament_id::text or c->>'eventId'is distinct from r.event_id::text or c->>'rosterEntryId'is distinct from r.roster_entry_id::text
 or c->>'mainEventId'is distinct from s.main_event_id::text or c->>'baseReceiptId'is distinct from b.id::text or c->'baseVersion'is distinct from to_jsonb(b.version)or c->'baseAmountMinor'is distinct from to_jsonb(b.amount_minor)or c->'feeMinor'is distinct from to_jsonb(r.amount_minor)
 or c->>'activationId'is distinct from s.activation_id::text or c->>'setupEventVersionId'is distinct from s.setup_event_version_id::text or c#>>'{eligibility,status}'is distinct from'eligible'or c#>>'{eligibility,mainEventId}'is distinct from s.main_event_id::text
 or not exists(select 1 from app.qualification_result_versions q where q.id::text=c#>>'{eligibility,qualificationId}'and q.tournament_id=r.tournament_id and q.event_id=s.main_event_id)
 or c->'baseAllocation'is distinct from jsonb_build_array(jsonb_build_object('eventId',s.main_event_id,'bucket','regular_entry','poolId',null,'amountMinor',b.amount_minor,'classificationReviewed',true))
 or r.capture_digest is distinct from encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex')or r.method_configuration is distinct from c->'methodConfiguration'
 or o.tournament_id<>r.tournament_id or o.actor_profile_id<>r.actor_id or o.operation_type<>'consy_addon_receipt_v1'or o.outcome<>'accepted'or o.response_payload->>'status'is distinct from'consolation_addon_recorded'
 or o.response_payload->>'receiptId'is distinct from r.id::text or o.response_payload->>'chargeId'is distinct from r.charge_id::text or o.response_payload->>'rosterEntryId'is distinct from r.roster_entry_id::text or o.response_payload->'amountMinor'is distinct from to_jsonb(r.amount_minor)
 or o.response_payload#>>'{request,sourceDigest}'is distinct from r.capture_digest or o.response_payload#>>'{request,paymentMethod}'is distinct from r.payment_method or o.response_payload#>>'{request,note}'is distinct from r.receipt_note
 or o.request_hash is distinct from encode(extensions.digest(convert_to(jsonb_build_array('consy_addon_receipt_v1',r.actor_id,r.tournament_id,r.event_id,o.client_operation_id,o.response_payload->'request')::text,'utf8'),'sha256'),'hex')then return false;end if;
 if(r.method_configuration->>'version')::integer=0 then
 cfg:=jsonb_build_object('version',0,'cashEnabled',true,'checkEnabled',true);
 else select jsonb_build_object('version',version,'cashEnabled',cash_enabled,'checkEnabled',check_enabled)into cfg from app.tournament_payment_method_config_versions where tournament_id=r.tournament_id and version=(r.method_configuration->>'version')::integer;end if;
 if cfg is distinct from r.method_configuration or(r.payment_method='cash'and cfg->'cashEnabled'is distinct from'true'::jsonb)or(r.payment_method='check'and cfg->'checkEnabled'is distinct from'true'::jsonb)then return false;end if;
 if exists(select 1 from app.native_unrestricted_income_sources_v1 where physical_evidence_id=r.id)or exists(select 1 from app.native_unrestricted_income_records_v1 where physical_evidence_id=r.id)or exists(select 1 from app.tournament_expense_events where id=r.id)or exists(select 1 from app.roster_payment_events where id=r.id)then return false;end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$valid$;


-- Explicit totals: the legacy base receipt is never relabeled as all event money.
create function app.get_consy_addon_workspace_v1(tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $workspace$
declare m uuid;s app.consy_addon_payment_scopes_v1%rowtype;rows jsonb;begin
 if auth.uid()is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director'))then return null;end if;
 if app.consy_addon_payments_enabled_v1()is distinct from true then return null;end if;
 m:=app.lock_consy_addon_context_v1(tid,eid);select*into s from app.consy_addon_payment_scopes_v1 where tournament_id=tid and event_id=eid;if s.id is null then return jsonb_build_object('status','blocked','code','scope_required');end if;
 select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',p.roster_entry_id,'verificationId',p.table_seat,'displayName',r.claimed_display_name,
 'baseReceiptId',b.id,'baseReceiptMinor',case when b.event_type='received'then b.amount_minor else 0 end,'legacyBaseObligationMinor',o.amount_owed_minor,
 'thisConsolationFeeMinor',s.fee_minor,'thisConsolationPrepaidMinor',case when app.consy_prepaid_pair_current_v1(tid,eid,p.roster_entry_id)then s.fee_minor else 0 end,'thisConsolationAddonMinor',coalesce(a.amount_minor,0),'addonReceiptId',a.id,'chargeId',a.charge_id,
 'allEventAddonsMinor',tot.amount,'allRecordedReceiptMinor',case when b.event_type='received'then b.amount_minor else 0 end+tot.amount,
 'thisEventPaymentRecorded',app.event_qr_player_is_paid_and_enrolled(tid,eid,p.roster_entry_id),'bankReceiptVerified',false)
 order by p.table_seat,p.roster_entry_id),'[]')into rows from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id
 left join lateral(select*from app.roster_payment_events where tournament_id=tid and roster_entry_id=p.roster_entry_id order by version desc limit 1)b on true
 left join lateral(select*from app.roster_payment_obligation_versions where tournament_id=tid and roster_entry_id=p.roster_entry_id order by version desc limit 1)o on true
 left join app.consy_addon_receipts_v1 a on a.scope_id=s.id and a.roster_entry_id=p.roster_entry_id
 cross join lateral(select coalesce(sum(amount_minor),0)amount from app.consy_addon_receipts_v1 where tournament_id=tid and roster_entry_id=p.roster_entry_id)tot
 where p.tournament_id=tid and p.event_id=eid and p.roster_entry_id is not null;
 return jsonb_build_object('status','workspace_available','kind','consy-addon-workspace-v1','actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'scopeId',s.id,'players',rows,'legacyBaseTotalsExcludeAddons',true,'bankReceiptVerified',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$workspace$;


-- Current allocation alone must never manufacture a scoped Con's paid entry.
create or replace function app.operational_event_finance_source_v1(tid uuid,eid uuid,actor uuid)returns jsonb language plpgsql volatile security definer set search_path=''as $finance$
declare legacy jsonb;begin
 legacy:=app.operational_event_finance_source_v1_before_consy_addon(tid,eid,actor);
 if legacy->>'status'is distinct from'source_available'or not exists(select 1 from app.consy_addon_payment_scopes_v1 where tournament_id=tid and event_id=eid)then return legacy;end if;
 if app.consy_addon_payments_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','consy_addon_source_disabled');end if;
 if exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.status in('registered','checked_in')and app.event_qr_player_is_paid_and_enrolled(tid,eid,p.roster_entry_id)is distinct from true)then return jsonb_build_object('status','blocked','code','consy_event_payment_unverified');end if;
 return legacy;
end$finance$;

-- All are private; no endpoint, grant or feature activation in this proposal.
do $$declare p regprocedure;begin foreach p in array array[
 'app.consy_prepaid_pair_current_v1(uuid,uuid,uuid)'::regprocedure,'app.get_consy_addon_workspace_v1(uuid,uuid)'::regprocedure,'app.consy_addon_receipt_valid_v1(uuid)'::regprocedure,'app.consy_addon_payments_enabled_v1()'::regprocedure,'app.lock_consy_addon_context_v1(uuid,uuid)'::regprocedure,'app.finish_consy_addon_operation_v1(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure,
 'app.open_consy_addon_scope_v1(uuid,uuid,jsonb)'::regprocedure,'app.get_consy_addon_receipt_source_v1(uuid,uuid,uuid)'::regprocedure,'app.record_consy_addon_receipt_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'app.get_consy_addon_operation_v1(uuid,uuid,uuid)'::regprocedure,
 'app.operational_event_finance_source_v1(uuid,uuid,uuid)'::regprocedure,'app.lock_native_ledger_sources_v1()'::regprocedure,'app.get_native_event_ledger_sources_v1(uuid)'::regprocedure,'app.event_qr_player_is_paid_and_enrolled(uuid,uuid,uuid)'::regprocedure,
 'app.guard_consy_addon_base_history_v1()'::regprocedure,'app.guard_consy_addon_income_identity_v1()'::regprocedure]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
