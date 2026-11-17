-- Required persistent normal-RPC targets; an environment flag is not the data guard.
-- App roles still get no direct execution. Real public wrappers/ACL attestation remain an activation gate.
begin;
create function identity_adoption_v8.guard_v5_mutation(actor uuid,sid uuid,tid uuid)returns void language plpgsql security invoker set search_path='' as $$begin
perform identity_adoption_v8.lock_scope(actor,sid,tid);
if exists(select 1 from identity_adoption_v8.reviews where tournament_id=tid and coverage='incomplete_reviewed')then raise exception'legacy_coverage_review_required';end if;
end$$;
create function identity_adoption_v8.write_v5_checked(actor uuid,sid uuid,tid uuid,op uuid,q jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$begin
perform identity_adoption_v8.guard_v5_mutation(actor,sid,tid);return identity_trial_v4.write_player(actor,sid,tid,op,q);end$$;
create function identity_adoption_v8.prepare_v5_checked(actor uuid,sid uuid,tid uuid,e jsonb,a jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$begin
perform identity_adoption_v8.guard_v5_mutation(actor,sid,tid);return identity_trial_v4.preflight(actor,sid,tid,e,a);end$$;
revoke all on all functions in schema identity_adoption_v8 from public,anon,authenticated,service_role;
commit;
