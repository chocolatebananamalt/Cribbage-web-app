-- LOCAL/default off. Apply after native/manual linked-loss adapters.
-- ACC scoring.asp links points.asp?games=12&min=16&scale=3 (checked 2026-11-12).
-- 0278/0292 copied only the 7/8/9/10 schedules; twelve is already supported
-- by setup and the current MRP reference. No qualifying-count rule changes.
begin;
create function app.linked_consolation_twelve_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
revoke all on function app.linked_consolation_twelve_enabled_v1()from public,anon,authenticated,service_role;
do $patch$declare sig text;d text;old text:='threshold:=case games when 7 then 9 when 8 then 11 when 9 then 12 when 10 then 13 end;';replacement text;begin
 if current_user<>'postgres' then raise exception 'postgres owner required';end if;
 replacement:='if games=12 and app.linked_consolation_twelve_enabled_v1()is distinct from true then return null;end if; '||replace(old,'when 10 then 13 end','when 10 then 13 when 12 then 16 end');
 foreach sig in array array['app.linked_consolation_four_qualifier_source_v2_before_native_loss(uuid,uuid,uuid)','app.derive_linked_consolation_four_qualifier_v2(uuid,jsonb)']loop
  if not exists(select 1 from pg_proc where oid=to_regprocedure(sig)and proowner='postgres'::regrole and prosecdef)then raise exception 'consolation_twelve_trusted_prerequisite_missing';end if;
  d:=pg_get_functiondef(to_regprocedure(sig));
  if strpos(d,old)=0 or length(d)-length(replace(d,old,''))<>length(old)then raise exception 'consolation_twelve_anchor_changed';end if;
  execute replace(d,old,replacement);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',sig);
 end loop;
end$patch$;
commit;
