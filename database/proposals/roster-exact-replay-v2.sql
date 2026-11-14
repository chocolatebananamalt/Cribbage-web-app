-- LOCAL REVIEW CANDIDATE. Exact source anchors; no historical migration or ACL edits.
BEGIN;
DO $patch$
declare target regprocedure := 'public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid)'::regprocedure;
 base regprocedure := 'public.create_manual_roster_entry_v3_before_acc_guard(uuid,uuid,text,text,text,text,text,uuid)'::regprocedure;
 source text; definition text; replacement text; before_recheck text;
begin
 select prosrc into source from pg_proc where oid=target;
 if strpos(source,chr(13))>0 then raise exception 'manual roster unsupported CRLF wrapper source';end if;
 if length(source)-length(replace(source,E'begin\n',''))<>length(E'begin\n') then raise exception 'manual roster initial insertion anchor not unique';end if;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex') <> 'ca25541990104c4b472116e777b201bbe89554bb0cc4c8e1c2a6417959f5f8e8' then raise exception 'manual roster wrapper source mismatch';end if;
 if (select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')from pg_proc where oid=base) <> '087e069d277028799d11b9f97aa380d30073eb64a128443f0815a2bebac66020' then raise exception 'manual roster receipt authority source mismatch';end if;
 if (select proowner from pg_proc where oid=target)<>(select proowner from pg_proc where oid=base) or not (select prosecdef from pg_proc where oid=target) then raise exception 'manual roster ownership/security mismatch';end if;
 if exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid in(target,base) and (pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or p.provolatile<>'v' or p.proparallel<>'u' or l.lanname<>'plpgsql' or p.proconfig is distinct from array['search_path=""']::text[] or p.prorettype<>'jsonb'::regtype)) then raise exception 'manual roster catalog metadata mismatch';end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid in(target,base) and (a.grantee not in(p.proowner,'service_role'::regrole::oid) or a.grantor<>p.proowner or a.privilege_type<>'EXECUTE' or a.is_grantable)) then raise exception 'manual roster unexpected explicit grant';end if;
 if has_function_privilege('anon',target,'EXECUTE') or has_function_privilege('authenticated',target,'EXECUTE') or not has_function_privilege('service_role',target,'EXECUTE') then raise exception 'manual roster transport permissions mismatch';end if;
 replacement:=replace(source,E'begin\n',E'begin\n'||$prefix$
  -- Service transport supplies the actor only after provider verification.
  if coalesce(auth.role(),'') <> 'service_role' then return jsonb_build_object('status','rejected','code','not_director'); end if;
  if p_actor_id is null or p_tournament_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_manual_entry'); end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director'); end if;
  -- Existing receipts are verified only by the unchanged delegate hash authority.
  if exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key) then
    return public.create_manual_roster_entry_v3_before_acc_guard(p_actor_id,p_tournament_id,p_first_name,p_last_name,p_email,p_acc_number,p_scorecard_type,p_idempotency_key);
  end if;
$prefix$);
 if replacement=source then raise exception 'manual roster initial insertion anchor mismatch';end if;
 before_recheck:=replacement;
 replacement:=replace(replacement,$outcome$v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_name,v_email,v_acc,null);$outcome$,$outcome$v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_name,v_email,v_acc,null);$outcome$||$recheck$
    -- A concurrent identical writer may have committed while identity locks waited.
    if exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key) then
      return public.create_manual_roster_entry_v3_before_acc_guard(p_actor_id,p_tournament_id,p_first_name,p_last_name,p_email,p_acc_number,p_scorecard_type,p_idempotency_key);
    end if;
$recheck$);
 if replacement=before_recheck then raise exception 'manual roster receipt recheck anchor mismatch';end if;
 definition:=pg_get_functiondef(target);
 if length(definition)-length(replace(definition,source,''))<>length(source) then raise exception 'manual roster definition anchor not unique';end if;
 execute replace(definition,source,replacement);
end $patch$;
COMMIT;
