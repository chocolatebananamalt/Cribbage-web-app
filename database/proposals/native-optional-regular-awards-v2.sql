-- LOCAL PRIVATE CANDIDATE. Existing reviewed V1 whole-band arithmetic and
-- verified sporting result mapping, separated from V1 Finance identities.
begin;
create function app.native_optional_regular_awards_v2(recipient jsonb,editor jsonb,fund_total numeric)returns jsonb
language plpgsql immutable set search_path=''as $$
declare settings jsonb;method text;factor_text text;factor_num numeric;factor_den numeric;dot_at integer;
 qualifier_count integer;requested integer;included_places integer;first_place integer;last_place integer;
 band_count integer:=0;all_band_count integer:=0;i integer;people integer;weight numeric;denominator numeric:=0;raw numeric;amount numeric;previous_amount numeric:=null;
 bands jsonb:='[]';groups jsonb:='[]';recipients jsonb:='[]';override_latest jsonb:='{}';ov jsonb;
 player jsonb;match_row jsonb;income_item jsonb;participant uuid;place_first integer;place_last integer;included boolean;
 final_winner uuid;final_loser uuid;loser uuid;total_awards numeric:=0;positive_places integer:=0;
begin
 if recipient is null or editor is null or jsonb_typeof(recipient)is distinct from'object'
  or jsonb_typeof(editor)is distinct from'object'
  or recipient->>'kind'is distinct from'native-optional-playoff-source-v2'
  or recipient->>'status'is distinct from'source_available'
  or jsonb_typeof(recipient#>'{playoff,players}')is distinct from'array'
  or jsonb_typeof(recipient#>'{playoff,matches}')is distinct from'array'
  or jsonb_typeof(editor->'overrideHistory')is distinct from'array'
  then return jsonb_build_object('status','blocked','code','source_shape_invalid');end if;
 if fund_total is null or fund_total<0 or fund_total>9007199254740991 or fund_total<>trunc(fund_total)then return jsonb_build_object('status','blocked','code','fund_invalid');end if;
 qualifier_count:=(recipient#>>'{playoff,qualifierCount}')::integer;
 if(qualifier_count in(4,5))is distinct from true then return jsonb_build_object('status','blocked','code','unsupported_qualifier_count');end if;
 if jsonb_array_length(recipient#>'{playoff,players}')<>qualifier_count
  or(select count(distinct value->>'participantId')from jsonb_array_elements(recipient#>'{playoff,players}'))<>qualifier_count
  or(select count(distinct value->>'profileId')from jsonb_array_elements(recipient#>'{playoff,players}'))<>qualifier_count
  or(select count(distinct value->>'tournamentPlayerId')from jsonb_array_elements(recipient#>'{playoff,players}'))<>qualifier_count
  or jsonb_array_length(recipient#>'{playoff,matches}')<>qualifier_count-1
  or(select count(distinct(value->>'slot')::integer)from jsonb_array_elements(recipient#>'{playoff,matches}')where(value->>'slot')::integer between 1 and qualifier_count-1)<>qualifier_count-1
  then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
 settings:=editor#>'{basis,settings}';method:=settings->>'method';factor_text:=settings->>'factor';
 if(factor_text~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$')is distinct from true then return jsonb_build_object('status','blocked','code','invalid_factor');end if;
 dot_at:=strpos(factor_text,'.');factor_den:=case when dot_at=0 then 1 else power(10,length(factor_text)-dot_at)end;
 factor_num:=replace(factor_text,'.','')::numeric;
 if factor_num<factor_den or factor_num>1000*factor_den then return jsonb_build_object('status','blocked','code','factor_outside_technical_domain');end if;
 if method='graduated_all_qualifiers'then requested:=qualifier_count;
 elsif method='custom_top_paid'then requested:=(settings->>'paidPlaces')::integer;
 elsif method='custom_paid_ratio'then return jsonb_build_object('status','blocked','code','custom_ratio_paid_count_policy_unresolved');
 else return jsonb_build_object('status','blocked','code','invalid_settings');end if;
 if requested is null or requested<1 or requested>qualifier_count then return jsonb_build_object('status','blocked','code','invalid_paid_places');end if;
 first_place:=1;
 while first_place<=qualifier_count loop
  last_place:=least(qualifier_count,case when first_place=1 then 1 else(first_place-1)*2 end);
  if requested between first_place and last_place then included_places:=last_place;end if;
  bands:=bands||jsonb_build_array(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',last_place-first_place+1));
  first_place:=case when first_place=1 then 2 else first_place*2-1 end;
 end loop;
 all_band_count:=jsonb_array_length(bands);band_count:=0;
 for i in 0..all_band_count-1 loop
  if(bands->i->>'lastPlace')::integer<=included_places then band_count:=band_count+1;end if;
 end loop;
 for i in 0..band_count-1 loop
  weight:=power(factor_num,band_count-1-i)*power(factor_den,i);
  denominator:=denominator+weight*((bands->i->>'people')::integer);
 end loop;
 for ov in select value from jsonb_array_elements(editor->'overrideHistory')loop
  if jsonb_typeof(ov)is distinct from'object'
   or jsonb_typeof(ov->'voided')is distinct from'boolean'
   or((ov->>'firstPlace')~'^[1-9][0-9]*$')is distinct from true
   or((ov->>'lastPlace')~'^[1-9][0-9]*$')is distinct from true
   or(not(ov->>'voided')::boolean and(jsonb_typeof(ov->'perPersonMinor')is distinct from'number'
    or((ov->>'perPersonMinor')~'^[0-9]+$')is distinct from true))
   then return jsonb_build_object('status','blocked','code','override_shape_invalid');end if;
  override_latest:=jsonb_set(override_latest,array[(ov->>'firstPlace')||':'||(ov->>'lastPlace')],ov,true);
 end loop;
 for i in 0..all_band_count-1 loop
  first_place:=(bands->i->>'firstPlace')::integer;last_place:=(bands->i->>'lastPlace')::integer;people:=last_place-first_place+1;
  included:=last_place<=included_places;
  if included then
   weight:=power(factor_num,band_count-1-i)*power(factor_den,i);raw:=fund_total*weight;
   amount:=div(raw*2+denominator*500,denominator*1000)*500;
   ov:=override_latest->(first_place||':'||last_place);
   if ov is not null and not(ov->>'voided')::boolean then amount:=(ov->>'perPersonMinor')::numeric;end if;
   if amount is null or amount<=0 or amount%500<>0 then return jsonb_build_object('status','blocked','code','award_amount_invalid');end if;
   if previous_amount is not null and amount>previous_amount then return jsonb_build_object('status','blocked','code','award_rank_order_invalid');end if;
   previous_amount:=amount;
   total_awards:=total_awards+amount*people;positive_places:=positive_places+people;
  else amount:=0;end if;
  groups:=groups||jsonb_build_array(jsonb_build_object('firstPlace',first_place,'lastPlace',last_place,'people',people,
   'included',included,'perPersonMinor',amount::bigint,'groupTotalMinor',(amount*people)::bigint));
 end loop;
 if total_awards is distinct from fund_total then return jsonb_build_object('status','blocked','code','recorded_fund_imbalance');end if;
 -- Placement is reconstructed only from the verified native series results.
 for match_row in select value from jsonb_array_elements(recipient#>'{playoff,matches}')loop
  if(match_row->>'slot')::integer=qualifier_count-1 then
   final_winner:=(match_row#>>'{result,winnerId}')::uuid;final_loser:=(match_row#>>'{result,loserId}')::uuid;
  end if;
 end loop;
 if final_winner is null or final_loser is null or final_winner=final_loser then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
 for player in select value from jsonb_array_elements(recipient#>'{playoff,players}')loop
  participant:=(player->>'participantId')::uuid;
  if participant=final_winner then place_first:=1;place_last:=1;
  elsif participant=final_loser then place_first:=2;place_last:=2;
  else
   place_first:=null;place_last:=null;
   for match_row in select value from jsonb_array_elements(recipient#>'{playoff,matches}')loop
    loser:=(match_row#>>'{result,loserId}')::uuid;
    if loser=participant then
     if(match_row->>'round')='semifinal'then place_first:=3;place_last:=4;
     elsif qualifier_count=5 and(match_row->>'slot')::integer=1 then place_first:=5;place_last:=5;end if;
    end if;
   end loop;
  end if;
  if place_first is null then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
  ov:=null;
  for income_item in select value from jsonb_array_elements(groups)loop
   if(income_item->>'firstPlace')::integer=place_first and(income_item->>'lastPlace')::integer=place_last then ov:=income_item;exit;end if;
  end loop;
  if ov is null then return jsonb_build_object('status','blocked','code','recipient_band_missing');end if;
  recipients:=recipients||jsonb_build_array(jsonb_build_object(
   'participantId',participant,'profileId',(player->>'profileId')::uuid,
   'displayName',player->>'displayName','tournamentPlayerId',player->>'tournamentPlayerId',
   'firstPlace',place_first,'lastPlace',place_last,'included',(ov->>'included')::boolean,
   'amountMinor',(ov->>'perPersonMinor')::bigint
  ));
 end loop;
 if jsonb_array_length(recipients)<>qualifier_count then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
 if(select sum((value->>'amountMinor')::numeric)from jsonb_array_elements(recipients))is distinct from fund_total
  or exists(select 1 from jsonb_array_elements(groups)g where(select count(*)from jsonb_array_elements(recipients)r where r->>'firstPlace'=g->>'firstPlace'and r->>'lastPlace'=g->>'lastPlace')<>(g->>'people')::integer)
  then return jsonb_build_object('status','blocked','code','recipient_mapping_incomplete');end if;
 return jsonb_build_object('status','calculated','requestedPaidPlaces',requested,'includedPaidPlaces',included_places,'positiveAwardPlaces',positive_places,'groups',groups,'recipients',recipients,'totalMinor',total_awards::bigint);
exception when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return jsonb_build_object('status','blocked','code','source_shape_invalid');
end$$;
alter function app.native_optional_regular_awards_v2(jsonb,jsonb,numeric)owner to postgres;
revoke all on function app.native_optional_regular_awards_v2(jsonb,jsonb,numeric)from public,anon,authenticated,service_role;
commit;
