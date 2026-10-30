-- LOCAL proposal. New award records must use whole $5 units across old/new
-- writers. Existing rows and accepted-operation replay remain unchanged.
-- Refunds, fees, costs and voids of old awards are not rounded or reclassified.
begin;
create function app.assert_whole_five_award_array_v1(p_rows jsonb,amount_key text)returns void
language plpgsql immutable set search_path=''as $$declare r jsonb;a numeric;begin
 if jsonb_typeof(p_rows)is distinct from'array'then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
 for r in select value from jsonb_array_elements(p_rows)loop
  if jsonb_typeof(r->amount_key)is distinct from'number'then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
  a:=(r->>amount_key)::numeric;
  if a<0 or a<>trunc(a)or mod(a,500)<>0 then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
 end loop;
end$$;
create function app.assert_whole_five_q_awards_v1(obligations jsonb)returns void
language plpgsql immutable set search_path=''as $$declare p jsonb;begin
 if jsonb_typeof(obligations)is distinct from'array'then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
 for p in select value from jsonb_array_elements(obligations)loop
  if p->>'kind'='award'then perform app.assert_whole_five_award_array_v1(p->'rows','amountMinor');
  elsif p->>'kind'is distinct from'refund'then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
 end loop;
end$$;
create function app.assert_whole_five_standard_draft_v1(draft uuid,tid uuid,eid uuid)returns void
language plpgsql stable security definer set search_path=''as $$begin
 if exists(select 1 from app.standard_singles_settlement_placements p where p.settlement_draft_id=draft and p.tournament_id=tid and p.event_id=eid and mod(p.prize_amount_minor,500)<>0)
 or exists(select 1 from app.standard_singles_settlement_awards a where a.settlement_draft_id=draft and a.tournament_id=tid and a.event_id=eid and mod(a.amount_minor,500)<>0)then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
end$$;

create function app.require_whole_five_new_awards_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare record_json jsonb:=to_jsonb(new);snapshot jsonb;obligations jsonb;amount numeric;isvoid boolean;payout uuid;pv integer;kind text;begin
 case tg_table_name
 when 'standard_singles_settlement_placements'then amount:=new.prize_amount_minor;
 when 'standard_singles_settlement_awards'then amount:=new.amount_minor;
 when 'event_settlement_drafts_v5'then perform app.assert_whole_five_award_array_v1(new.request_payload->'prizeClaims','amountMinor');
 when 'event_settlement_finals_v2'then
  select d.request_payload into snapshot from app.event_settlement_drafts_v5 d where d.id=new.draft_id and d.tournament_id=new.tournament_id and d.event_id=new.event_id;
  perform app.assert_whole_five_award_array_v1(snapshot->'prizeClaims','amountMinor');
 when 'standard_singles_settlement_final_versions'then perform app.assert_whole_five_standard_draft_v1(new.settlement_draft_id,new.tournament_id,new.event_id);
 when 'q_accounting_drafts_v6'then
  perform app.assert_whole_five_award_array_v1(new.source_manifest->'regularSchedule'->'awards','totalAwardMinor');
  select q.obligations into obligations from app.q_obligation_reviews_v2 q where q.id=new.q_review_id and q.tournament_id=new.tournament_id and q.event_id=new.event_id;
  perform app.assert_whole_five_q_awards_v1(obligations);
 when 'q_accounting_finals_v6'then
  select d.source_manifest,q.obligations into snapshot,obligations from app.q_accounting_drafts_v6 d join app.q_obligation_reviews_v2 q on q.id=d.q_review_id where d.id=new.draft_id and d.tournament_id=new.tournament_id and d.event_id=new.event_id;
  perform app.assert_whole_five_award_array_v1(snapshot->'regularSchedule'->'awards','totalAwardMinor');perform app.assert_whole_five_q_awards_v1(obligations);
 when 'no_q_accounting_drafts_v7'then perform app.assert_whole_five_award_array_v1(new.source_manifest->'regularSchedule'->'awards','totalAwardMinor');
 when 'no_q_accounting_finals_v7'then
  select d.source_manifest into snapshot from app.no_q_accounting_drafts_v7 d where d.id=new.draft_id and d.tournament_id=new.tournament_id and d.event_id=new.event_id;
  perform app.assert_whole_five_award_array_v1(snapshot->'regularSchedule'->'awards','totalAwardMinor');
 when 'prize_accounting_drafts_v8'then
  perform app.assert_whole_five_award_array_v1(new.awards,'totalAwardMinor');
  if new.source_manifest->'qReview'is not null and new.source_manifest->'qReview'<>'null'::jsonb then perform app.assert_whole_five_q_awards_v1(new.source_manifest->'qReview'->'obligations');end if;
 when 'prize_accounting_finals_v8'then
  select to_jsonb(d)into snapshot from app.prize_accounting_drafts_v8 d where d.id=new.draft_id and d.tournament_id=new.tournament_id and d.event_id=new.event_id;
  perform app.assert_whole_five_award_array_v1(snapshot->'awards','totalAwardMinor');
  if snapshot->'source_manifest'->'qReview'is not null and snapshot->'source_manifest'->'qReview'<>'null'::jsonb then perform app.assert_whole_five_q_awards_v1(snapshot->'source_manifest'->'qReview'->'obligations');end if;
 when 'q_obligation_reviews_v1','q_obligation_reviews_v2'then perform app.assert_whole_five_q_awards_v1(new.obligations);
 when 'event_side_pool_policy_versions'then perform app.assert_whole_five_award_array_v1(new.posted_payout_schedule,'amountMinor');
 when 'event_side_pool_payout_versions','event_side_pool_team_payout_versions'then
  if not new.voided then amount:=new.amount_minor;end if;
 when 'event_side_pool_payout_reviews','event_side_pool_payout_review_versions'then
  if new.approved then
   payout:=(record_json->>'payout_id')::uuid;kind:=record_json->>'beneficiary_kind';pv:=(record_json->>'payout_version')::integer;
   if kind='participant'then select p.amount_minor,p.voided into amount,isvoid from app.event_side_pool_payout_versions p where p.payout_id=payout and p.tournament_id=new.tournament_id and p.event_id=new.event_id and(pv is null or p.version=pv)order by p.version desc limit 1;
   elsif kind='team_entry'then select p.amount_minor,p.voided into amount,isvoid from app.event_side_pool_team_payout_versions p where p.payout_id=payout and p.tournament_id=new.tournament_id and p.event_id=new.event_id and(pv is null or p.version=pv)order by p.version desc limit 1;
   else raise exception using errcode='P0001',message='whole_five_awards_required';end if;
   if amount is null then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
   if isvoid then amount:=null;end if;
  end if;
 when 'event_side_pool_reconciliations'then
  if exists(select 1 from(select distinct on(payout_id)amount_minor,voided from app.event_side_pool_payout_versions where pool_id=new.pool_id order by payout_id,version desc)x where not voided and mod(amount_minor,500)<>0)
  or exists(select 1 from(select distinct on(payout_id)amount_minor,voided from app.event_side_pool_team_payout_versions where pool_id=new.pool_id order by payout_id,version desc)x where not voided and mod(amount_minor,500)<>0)then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
 when 'satellite_result_versions'then
  perform app.assert_whole_five_award_array_v1(new.placements,'prizeMinor');perform app.assert_whole_five_award_array_v1(new.placements,'qPoolMinor');perform app.assert_whole_five_award_array_v1(new.placements,'sidePoolMinor');
 when 'event_team_financial_contributions'then if new.contribution_type='award'then amount:=new.amount_minor;end if;
 else raise exception 'Unexpected award denomination guard target';
 end case;
 if amount is not null and(amount<0 or amount<>trunc(amount)or mod(amount,500)<>0)then raise exception using errcode='P0001',message='whole_five_awards_required';end if;
 return new;
end$$;
revoke all on function app.assert_whole_five_award_array_v1(jsonb,text),app.assert_whole_five_q_awards_v1(jsonb),app.assert_whole_five_standard_draft_v1(uuid,uuid,uuid),app.require_whole_five_new_awards_v1()from public,anon,authenticated,service_role;
do $$declare n text;begin foreach n in array array[
 'standard_singles_settlement_placements','standard_singles_settlement_awards','standard_singles_settlement_final_versions',
 'event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6',
 'no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8',
 'q_obligation_reviews_v1','q_obligation_reviews_v2','event_side_pool_policy_versions',
 'event_side_pool_payout_versions','event_side_pool_team_payout_versions','event_side_pool_payout_reviews',
 'event_side_pool_payout_review_versions','event_side_pool_reconciliations','satellite_result_versions','event_team_financial_contributions']loop
 execute format('create trigger aa_whole_five_new_awards_v1 before insert on app.%I for each row execute function app.require_whole_five_new_awards_v1()',n);
end loop;end$$;
commit;
