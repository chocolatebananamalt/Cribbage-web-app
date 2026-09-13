-- Rollback-only Rule 12.2 release oracle. Run after migrations through 0140.
begin;
do $$
declare r jsonb;
begin
  r:=app.rule12_adjudication_v1('12.2a','{"outcome":"win","margin":21,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":16,"column":"minus","apparentQualifier":false}');
  if r#>>'{a,margin}'<>'16' or r#>>'{b,margin}'<>'16' then raise exception '12.2a failed'; end if;
  r:=app.rule12_adjudication_v1('12.2b','{"outcome":"win","margin":17,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":16,"column":"minus","apparentQualifier":true}');
  if r#>>'{a,margin}'<>'16' or r#>>'{b,margin}'<>'17' then raise exception '12.2b failed'; end if;
  r:=app.rule12_adjudication_v1('12.2c','{"outcome":"win","margin":21,"column":"plus","apparentQualifier":false}','{"outcome":"loss","margin":null,"column":"blank","apparentQualifier":false}');
  if r#>>'{b,margin}'<>'21' then raise exception '12.2c failed'; end if;
  r:=app.rule12_adjudication_v1('12.2d','{"outcome":"win","margin":17,"column":"plus","apparentQualifier":false}','{"outcome":"win","margin":16,"column":"minus","apparentQualifier":false}');
  if r#>>'{a,isWinner}'<>'true' or r#>>'{b,isWinner}'<>'false' then raise exception '12.2d failed'; end if;
  r:=app.rule12_adjudication_v1('12.2e','{"outcome":"win","margin":31,"column":"plus","apparentQualifier":false}','{"outcome":"win","margin":16,"column":"plus","apparentQualifier":false}');
  if r#>>'{a,isWinner}'<>'false' or r#>>'{b,isWinner}'<>'false' then raise exception '12.2e failed'; end if;
  r:=app.rule12_adjudication_v1('12.2f','{"outcome":"win","margin":31,"column":"plus","apparentQualifier":false}','{"outcome":"loss","margin":16,"column":"plus","apparentQualifier":false}');
  if r#>>'{a,isWinner}'<>'true' or r#>>'{b,isWinner}'<>'false' then raise exception '12.2f failed'; end if;
  r:=app.rule12_adjudication_v1('12.2h','{"outcome":"win","margin":15,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":20,"column":"minus","apparentQualifier":false}');
  if r#>>'{a,margin}'<>'15' or r#>>'{b,margin}'<>'20' then raise exception '12.2h failed'; end if;
  begin
    perform app.rule12_adjudication_v1('12.2h','{"outcome":"win","margin":21,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":16,"column":"minus","apparentQualifier":false}');
    raise exception '12.2h accepted the favorable 12.2a direction';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Rule 12 case does not apply' then raise; end if;
  end;
  begin
    perform app.rule12_adjudication_v1('12.2a','{"outcome":"win","margin":15,"column":"plus","apparentQualifier":true}','{"outcome":"loss","margin":20,"column":"minus","apparentQualifier":false}');
    raise exception '12.2a accepted the adverse 12.2h direction';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Rule 12 case does not apply' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.create_rule12_correction_v2(uuid,uuid,uuid,integer,integer,text,jsonb,jsonb,boolean,uuid,text,uuid)','EXECUTE') then raise exception 'writer exposed'; end if;
  if has_function_privilege('authenticated','public.propose_game_correction(uuid,uuid,integer,text,integer,text,uuid)','EXECUTE') then raise exception 'legacy writer restored'; end if;
end $$;
select 'rule12_correction_release_passed' as result;
rollback;
