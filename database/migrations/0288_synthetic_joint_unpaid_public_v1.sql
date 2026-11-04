-- LOCAL ONLY. Enables the reviewed synthetic joint unpaid workflow after the
-- source-backed structured lifecycle proof. No payment or physical attestation.
begin;
create or replace function public.save_multi_event_unpaid_draft_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid) returns jsonb
language sql volatile security definer set search_path='' as $$select app.write_multi_event_unpaid_draft_candidate_v1(actor,tid,eid,req,op)$$;
create or replace function public.close_synthetic_event_crosscheck_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid) returns jsonb
language sql volatile security definer set search_path='' as $$select app.close_synthetic_event_crosscheck_candidate_v1(actor,tid,eid,req,op)$$;
create or replace function public.finalize_multi_event_unpaid_v1(actor uuid,tid uuid,req jsonb,op uuid) returns jsonb
language sql volatile security definer set search_path='' as $$select app.write_multi_event_joint_final_candidate_v1(actor,tid,req,op)$$;
create function public.get_multi_event_joint_final_v1(actor uuid,tid uuid) returns jsonb
language sql stable security definer set search_path='' as $$select app.get_multi_event_joint_final_candidate_v1(actor,tid)$$;
create function public.get_multi_event_joint_final_workspace_v1(actor uuid,tid uuid) returns jsonb
language sql stable security definer set search_path='' as $$select app.multi_event_joint_final_candidate_workspace_v1(actor,tid)$$;
create function public.get_synthetic_event_crosscheck_readiness_v1(actor uuid,tid uuid,eid uuid) returns jsonb
language sql stable security definer set search_path='' as $$select app.synthetic_event_crosscheck_readiness_candidate_v1(actor,tid,eid)$$;
create function public.get_multi_event_unpaid_event_workspace_v1(actor uuid,tid uuid,eid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d app.multi_event_unpaid_drafts_v1%rowtype;c app.synthetic_event_crosscheck_closures_v1%rowtype;begin
 if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director') or not exists(select 1 from app.events where tournament_id=tid and id=eid) then return null;end if;
 select * into d from app.multi_event_unpaid_drafts_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 select * into c from app.synthetic_event_crosscheck_closures_v1 where tournament_id=tid and event_id=eid;
 return jsonb_build_object('tournamentId',tid,'eventId',eid,'currentDraftVersion',coalesce(d.version,0),'draft',case when d.id is null then null else jsonb_build_object('id',d.id,'version',d.version,'sourceDigest',d.source_digest) end,'closure',case when c.id is null then null else jsonb_build_object('id',c.id,'sourceDigest',c.source_digest) end,'readiness',app.synthetic_event_crosscheck_readiness_candidate_v1(actor,tid,eid));
end$$;
revoke all on function public.get_multi_event_joint_final_v1(uuid,uuid),public.get_multi_event_joint_final_workspace_v1(uuid,uuid),public.get_synthetic_event_crosscheck_readiness_v1(uuid,uuid,uuid),public.get_multi_event_unpaid_event_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_multi_event_joint_final_v1(uuid,uuid),public.get_multi_event_joint_final_workspace_v1(uuid,uuid),public.get_synthetic_event_crosscheck_readiness_v1(uuid,uuid,uuid),public.get_multi_event_unpaid_event_workspace_v1(uuid,uuid,uuid) to service_role;
commit;
