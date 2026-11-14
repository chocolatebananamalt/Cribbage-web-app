-- UNEXECUTED private SQL parity candidate, NOT runtime parity evidence.
-- Depends on event-settings-transaction-v3 raw/UTF16 validators. No caller may
-- substitute pasted approval text for RC approval or a native entrant count.
begin;
create function app.resolve_event_series_format_v1(raw jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare w numeric;g numeric;choice text;
begin
 if jsonb_typeof(raw)is distinct from'object'or not(raw?&array['choice','winsText','gamesText'])or exists(select 1 from jsonb_object_keys(raw)k where k<>all(array['choice','winsText','gamesText']))
 or jsonb_typeof(raw->'choice')is distinct from'string'or jsonb_typeof(raw->'winsText')is distinct from'string'or jsonb_typeof(raw->'gamesText')is distinct from'string'then return null;end if;
 choice:=raw->>'choice';
 if choice<>'custom'then
  w:=case choice when'2-of-3'then 2 when'3-of-5'then 3 when'4-of-7'then 4 else null end;
  if w is null then return null;end if;
  return jsonb_build_object('winsRequired',w::integer,'maximumGames',(2*w-1)::integer);
 end if;
 -- Leading zeroes, decimal/exponent aliases and whitespace never normalize.
 -- A valid best-of series has games <= PostgreSQL int; >10 decimal digits
 -- cannot be valid, so reject before parsing an arbitrarily large numeric.
 if(raw->>'winsText')!~'^[1-9][0-9]*$'or(raw->>'gamesText')!~'^[1-9][0-9]*$'or length(raw->>'winsText')>10 or length(raw->>'gamesText')>10 then return null;end if;
 w:=(raw->>'winsText')::numeric;g:=(raw->>'gamesText')::numeric;
 if w<1 or g>2147483647 or g<>2*w-1 then return null;end if;
 return jsonb_build_object('winsRequired',w::integer,'maximumGames',g::integer);
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end$$;

create function app.assess_event_rule_draft_v1(draft jsonb,context jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare regular_format jsonb;final_format jsonb;format jsonb;round_name text;kind text;days numeric;sanctioned boolean;factor_text text;count_text text;deferred boolean:=false;code text:='known_rules_satisfied';wins integer;games integer;
begin
 if jsonb_typeof(context)is distinct from'object'or not(context?&array['sanctioned','eventKind','durationDays','originalEntrants'])or exists(select 1 from jsonb_object_keys(context)k where k<>all(array['sanctioned','eventKind','durationDays','originalEntrants']))
 or jsonb_typeof(context->'sanctioned')is distinct from'boolean'or jsonb_typeof(context->'eventKind')is distinct from'string'or coalesce(context->>'eventKind','')not in('main','consolation')or jsonb_typeof(context->'durationDays')is distinct from'number'
 or(context->>'durationDays')::numeric<1 or(context->>'durationDays')::numeric>2147483647 or(context->>'durationDays')::numeric<>trunc((context->>'durationDays')::numeric)or context->'originalEntrants'is distinct from'null'::jsonb then
  return jsonb_build_object('status','blocked','code','invalid_setup_context','deferredOriginalField',false,'officialApprovalClaimed',false);
 end if;
 if not app.valid_event_parameters_raw_v3(draft)then return jsonb_build_object('status','blocked','code','invalid_draft','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 factor_text:=draft->>'incrementFactorText';
 if app.event_settings_js_text_length_v3(factor_text)>16 or factor_text!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'or factor_text::numeric<1 or factor_text::numeric>1000 then return jsonb_build_object('status','blocked','code','incomplete_payout','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 if draft->>'payoutMode'in('one-in','top')then
  count_text:=case draft->>'payoutMode'when'one-in'then draft->>'oneInText'else draft->>'topText'end;
  if count_text!~'^[1-9][0-9]*$'or length(count_text)>10 or count_text::numeric>2147483647 then return jsonb_build_object('status','blocked','code','incomplete_payout','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
  -- Resolving a count is NOT authority to select ratio population/rounding.
  if draft->>'payoutMode'='one-in'then return jsonb_build_object('status','blocked','code','ratio_paid_places_policy_unresolved','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 end if;
 regular_format:=app.resolve_event_series_format_v1(draft#>'{series,regular}');
 final_format:=case draft->>'finalMode'when'same'then regular_format else app.resolve_event_series_format_v1(draft#>'{series,final}')end;
 if regular_format is null or final_format is null then return jsonb_build_object('status','blocked','code','incomplete_series','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 sanctioned:=(context->>'sanctioned')::boolean;kind:=context->>'eventKind';days:=(context->>'durationDays')::numeric;
 if not sanctioned then return jsonb_build_object('status','eligible','code','informal_settings','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 if days not in(1,2)then return jsonb_build_object('status','blocked','code','duration_not_covered','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 deferred:=kind='main'and days=2 and final_format<>jsonb_build_object('winsRequired',4,'maximumGames',7);
 foreach round_name in array array['regular','final']loop
  format:=case round_name when'regular'then regular_format else final_format end;wins:=(format->>'winsRequired')::integer;games:=(format->>'maximumGames')::integer;
  if kind='main'and days=2 then
   if round_name='regular'and(wins<>3 or games<>5)then code:=case when wins<3 then'two_day_main_minimum'else'two_day_main_custom'end;exit;end if;
   if round_name='final'and not((wins=3 and games=5)or(wins=4 and games=7))then code:='two_day_main_final_format';exit;end if;
  elsif kind='main'then
   if wins=2 and games=3 then code:='one_day_main_shorter';exit;
   elsif wins<>3 or games<>5 then code:=case when wins<3 then'one_day_main_minimum'else'one_day_main_custom'end;exit;end if;
  else
   if wins<2 then code:='consolation_minimum';exit;
   elsif not((wins=2 and games=3)or(days=2 and round_name='final'and wins=3 and games=5))then code:='consolation_custom';exit;end if;
  end if;
 end loop;
 return jsonb_build_object('status',case when code='known_rules_satisfied'then'eligible'else'blocked'end,'code',code,'deferredOriginalField',deferred,'officialApprovalClaimed',false);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','invalid_draft_or_context','deferredOriginalField',false,'officialApprovalClaimed',false);
end$$;
alter function app.resolve_event_series_format_v1(jsonb)owner to postgres;
alter function app.assess_event_rule_draft_v1(jsonb,jsonb)owner to postgres;
revoke all on function app.resolve_event_series_format_v1(jsonb),app.assess_event_rule_draft_v1(jsonb,jsonb)from public,anon,authenticated,service_role;
-- NO GRANTS and NO SQL execution in this task. Compared policy coverage is
-- bounded to the existing source-reviewed one/two-day setup assessment. Top-N
-- payout completeness is checked; this does not approve/calculates prizes.
commit;
