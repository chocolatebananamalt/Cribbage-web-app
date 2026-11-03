-- Disposable local proof: one shared expense may have distinct conserved event slices.
begin;
do $$declare id text:='e2790000-0000-4000-8000-000000000001';exp jsonb;classes jsonb;result jsonb;begin
 exp:=jsonb_build_array(jsonb_build_object('id',id,'amountMinor',6000));
 classes:=jsonb_build_array(jsonb_build_object('sourceId',id,'category','sanctioning','amountMinor',6000));
 result:=app.classify_multi_event_expenses_v1(exp,classes,6000);
 if result->>'status'<>'classified'or result->>'benefitMinor'<>'6000'or result->>'operatingMinor'<>'0'then raise exception 'Main classification failed %',result;end if;
 result:=app.classify_multi_event_expenses_v1(jsonb_build_array(jsonb_build_object('id',id,'amountMinor',1400)),jsonb_build_array(jsonb_build_object('sourceId',id,'category','sanctioning','amountMinor',1400)),1400);
 if result->>'status'<>'classified'or result->>'expenseMinor'<>'1400'then raise exception 'Separate event slice incorrectly reused full shared expense %',result;end if;
 exp:=jsonb_build_array(jsonb_build_object('id',id,'amountMinor',10000));
 classes:=jsonb_build_array(jsonb_build_object('sourceId',id,'category','sanctioning','amountMinor',6000),jsonb_build_object('sourceId',id,'category','operating','amountMinor',4000));
 result:=app.classify_multi_event_expenses_v1(exp,classes,6000);
 if result->>'status'<>'classified'or result->>'expenseMinor'<>'10000'or result->>'benefitMinor'<>'6000'or result->>'operatingMinor'<>'4000'then raise exception 'Split classification failed %',result;end if;
 if app.classify_multi_event_expenses_v1(exp,classes||jsonb_build_array(jsonb_build_object('sourceId',id,'category','operating','amountMinor',1)),6000)->>'code'<>'duplicate_expense_classification'then raise exception 'Duplicate accepted';end if;
 if app.classify_multi_event_expenses_v1(exp,classes,6001)->>'code'<>'sanctioning_allocation_unfunded'then raise exception 'Unfunded sanction accepted';end if;
 if app.classify_multi_event_expenses_v1(exp,classes-1,6000)->>'code'<>'expense_allocation_unbalanced'then raise exception 'Omitted operating portion accepted';end if;
 if app.classify_multi_event_expenses_v1(exp,jsonb_build_array(jsonb_build_object('sourceId',id,'category','player_benefit','amountMinor',10000)),6000)->>'code'<>'sanctioning_allocation_unfunded'then raise exception 'Generic benefit masqueraded as sanctioning';end if;
 if app.classify_multi_event_expenses_v1(exp,jsonb_build_array(jsonb_build_object('sourceId',id,'category','operating','amountMinor',-1)),0)->>'code'<>'invalid_expense_classification'then raise exception 'Negative accepted';end if;
 if app.classify_multi_event_expenses_v1(exp,jsonb_build_array(jsonb_build_object('sourceId','e2790000-0000-4000-8000-000000000002','category','operating','amountMinor',10000)),0)->>'code'<>'invalid_expense_classification'then raise exception 'Foreign source accepted';end if;
 if app.classify_multi_event_expenses_v1(exp,jsonb_build_array(jsonb_build_object('sourceId',id,'category','operating','amountMinor',10000,'implicit',true)),0)->>'code'<>'invalid_expense_classification'then raise exception 'Unexpected key accepted';end if;
 if app.classify_multi_event_expenses_v1(exp||exp,classes,6000)->>'code'<>'duplicate_expense_source'then raise exception 'Duplicate source accepted';end if;
 if app.classify_multi_event_expenses_v1('[]','[]',0)->>'status'<>'classified'then raise exception 'True zero assessment failed';end if;
 if app.classify_multi_event_expenses_v1('[]','[]',1)->>'code'<>'sanctioning_allocation_unfunded'then raise exception 'No expense but assessment funded';end if;
 if has_function_privilege('authenticated','public.review_multi_event_expenses_v1(uuid,uuid,uuid,jsonb,uuid)','execute')then raise exception 'Browser execute grant';end if;
end$$;
rollback;
