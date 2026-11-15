-- Versioned amount-owed records make unpaid/partial/paid/overpaid status
-- explicit without coupling payment status to check-in, seating, or scoring.
-- The existing current receipt amount is interpreted as cumulative received-to-date.

create table app.roster_payment_obligation_versions(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null,
  version integer not null check(version>0),
  amount_owed_minor integer not null check(amount_owed_minor>=0),
  reason text check(reason is null or(length(trim(reason)) between 1 and 500 and octet_length(reason)<=2000)),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id)on delete restrict,
  foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)on delete restrict,
  unique(roster_entry_id,version)
);
alter table app.roster_payment_obligation_versions enable row level security;
alter table app.roster_payment_obligation_versions force row level security;
revoke all on table app.roster_payment_obligation_versions from public,anon,authenticated;
create trigger roster_payment_obligations_immutable before update or delete on app.roster_payment_obligation_versions for each row execute function app.reject_immutable_history();
create index roster_payment_obligations_tournament_idx on app.roster_payment_obligation_versions(tournament_id,roster_entry_id,version desc);
create index roster_payment_obligations_actor_idx on app.roster_payment_obligation_versions(actor_profile_id);
create index roster_payment_obligations_receipt_idx on app.roster_payment_obligation_versions(operation_receipt_id,tournament_id);

create or replace function public.get_roster_payment_obligation_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when auth.uid() is not null and exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=auth.uid() and role.role in('director','co_director')) then
 jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object(
   'rosterEntryId',roster.id,'displayName',roster.claimed_display_name,
   'obligationVersion',coalesce(obligation.version,0),'amountOwedMinor',obligation.amount_owed_minor,
   'amountReceivedMinor',coalesce(receipt.amount_minor,0),
   'amountRemainingMinor',case when obligation.amount_owed_minor is null then null else greatest(obligation.amount_owed_minor-coalesce(receipt.amount_minor,0),0)end,
   'paymentStatus',case when obligation.amount_owed_minor is null then 'not_configured' when coalesce(receipt.amount_minor,0)=0 and obligation.amount_owed_minor>0 then 'unpaid' when coalesce(receipt.amount_minor,0)<obligation.amount_owed_minor then 'partial' when coalesce(receipt.amount_minor,0)=obligation.amount_owed_minor then 'paid' else 'overpaid' end
 )order by roster.claimed_normalized_name,roster.id)
 from app.tournament_roster_entries roster
 left join lateral(select item.version,item.amount_owed_minor from app.roster_payment_obligation_versions item where item.roster_entry_id=roster.id order by item.version desc limit 1)obligation on true
 left join lateral(select item.amount_minor from app.roster_payment_events item where item.roster_entry_id=roster.id order by item.version desc limit 1)receipt on true
 where roster.tournament_id=p_tournament_id),'[]'::jsonb)) else null end
$$;
revoke all on function public.get_roster_payment_obligation_workspace(uuid)from public,anon;
grant execute on function public.get_roster_payment_obligation_workspace(uuid)to authenticated;

create or replace function public.set_roster_payment_obligation_v1(p_tournament_id uuid,p_roster_entry_id uuid,p_expected_version integer,p_amount_owed_minor integer,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_current integer;v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_response jsonb;v_reason text:=nullif(trim(p_reason),'');
begin
 if v_actor is null or p_expected_version is null or p_expected_version<0 or p_amount_owed_minor is null or p_amount_owed_minor<0 or p_amount_owed_minor>2147483647 or length(coalesce(v_reason,''))>500 or octet_length(coalesce(v_reason,''))>2000 or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request','rosterEntryId',p_roster_entry_id);end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_roster_payment_obligation_v1',p_tournament_id::text,p_roster_entry_id::text,p_expected_version,p_amount_owed_minor,coalesce(v_reason,''),p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open','pending_finalization')for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable','rosterEntryId',p_roster_entry_id);end if;
 if not exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=v_actor and role.role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director','rosterEntryId',p_roster_entry_id);end if;
 if not exists(select 1 from app.tournament_roster_entries roster where roster.id=p_roster_entry_id and roster.tournament_id=p_tournament_id)then return jsonb_build_object('status','rejected','code','roster_entry_unavailable','rosterEntryId',p_roster_entry_id);end if;
 select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
 if found then if v_existing.request_hash=v_hash then return v_existing.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict','rosterEntryId',p_roster_entry_id);end if;
 select coalesce(max(version),0)into v_current from app.roster_payment_obligation_versions where roster_entry_id=p_roster_entry_id;
 if v_current<>p_expected_version then return jsonb_build_object('status','rejected','code','stale_obligation','rosterEntryId',p_roster_entry_id);end if;
 v_response:=jsonb_build_object('status','payment_obligation_saved','rosterEntryId',p_roster_entry_id,'obligationVersion',v_current+1,'amountOwedMinor',p_amount_owed_minor);
 insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(p_tournament_id,v_actor,'set_roster_payment_obligation_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now())returning id into v_receipt;
 insert into app.roster_payment_obligation_versions(tournament_id,roster_entry_id,version,amount_owed_minor,reason,actor_profile_id,operation_receipt_id)values(p_tournament_id,p_roster_entry_id,v_current+1,p_amount_owed_minor,v_reason,v_actor,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,v_actor,v_receipt,'roster_payment_obligation',p_roster_entry_id,'payment_obligation_saved',v_response);
 return v_response;
end $$;
revoke all on function public.set_roster_payment_obligation_v1(uuid,uuid,integer,integer,text,uuid)from public,anon;
grant execute on function public.set_roster_payment_obligation_v1(uuid,uuid,integer,integer,text,uuid)to authenticated;
