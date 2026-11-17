-- CLOSED LOCAL PROPOSAL. No execute grants, no activation or hosted apply.
-- Apply only atomically after reviewed terminal core + ALL pinned admissions.
begin;
create function public.get_closeout_terminal_v18(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'server_only_terminal_recovery';end if;
 return app.get_closeout_terminal_v17(actor,sid,tid,eid,op,stage,request);
end$$;
create function public.retire_closeout_operation_v18(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb,reason text)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'server_only_terminal_retirement';end if;
 return app.retire_closeout_operation_v17(actor,sid,tid,eid,op,stage,request,reason);
end$$;
alter function public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb)owner to postgres;
alter function public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)owner to postgres;
revoke all on function public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb),public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)from public,anon,authenticated,service_role;
commit;
