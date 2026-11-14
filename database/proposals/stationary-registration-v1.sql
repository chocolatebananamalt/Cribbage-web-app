-- Additive registration preference and immutable Director review. No seating assignment.
begin;
create function app.stationary_registration_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create table app.registration_stationary_requests_v1(
 claim_id uuid primary key references app.registration_claims(id),tournament_id uuid not null references app.tournaments(id),
 requested boolean not null,created_at timestamptz not null default clock_timestamp(),unique(claim_id,tournament_id));
create table app.registration_stationary_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),claim_id uuid not null,tournament_id uuid not null,
 revision integer not null check(revision>0),actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 decision text not null check(decision in('reviewed','not_accommodated')),reason text not null check(length(trim(reason))between 1 and 500 and octet_length(reason)<=2000),
 request_hash text not null,response jsonb not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(claim_id,tournament_id)references app.registration_stationary_requests_v1(claim_id,tournament_id),unique(claim_id,revision),unique(actor_id,operation_id));
create function app.stationary_registration_immutable_v1()returns trigger language plpgsql set search_path=''as $$begin raise exception 'stationary request and review history is immutable';end$$;
create trigger stationary_request_immutable before update or delete on app.registration_stationary_requests_v1 for each row execute function app.stationary_registration_immutable_v1();
create trigger stationary_review_immutable before update or delete on app.registration_stationary_reviews_v1 for each row execute function app.stationary_registration_immutable_v1();
alter table app.registration_stationary_requests_v1 enable row level security;
alter table app.registration_stationary_requests_v1 force row level security;
alter table app.registration_stationary_reviews_v1 enable row level security;
alter table app.registration_stationary_reviews_v1 force row level security;
revoke all on app.registration_stationary_requests_v1,app.registration_stationary_reviews_v1 from public,anon,authenticated,service_role;
create function public.submit_registration_claim_stationary_v1(p_link_id uuid,p_digest bytea,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_intended_payment_method text,p_scorecard_type text,p_client_operation_id uuid,p_stationary_requested boolean)returns jsonb
language plpgsql security definer set search_path=''as $$
declare result jsonb;c app.registration_claims%rowtype;old app.registration_stationary_requests_v1%rowtype;existed boolean;verified_tid uuid;
begin
 if auth.role()is distinct from'service_role'or app.stationary_registration_enabled_v1()is distinct from true or p_stationary_requested is null then return null;end if;
 -- The existing writer retains credential, expiry, capacity, identity, duplicate,
 -- lifecycle and exact replay guards. Both writes share this transaction.
 select tournament_id into verified_tid from app.tournament_registration_links where id=p_link_id and app.fixed_32_byte_equal(token_digest,p_digest);if not found then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:'||verified_tid::text,0));
 existed:=exists(select 1 from app.registration_claims where registration_link_id=p_link_id and client_operation_id=p_client_operation_id);
 result:=public.submit_registration_claim_v4(p_link_id,p_digest,p_first_name,p_last_name,p_email,p_acc_number,p_intended_payment_method,p_scorecard_type,p_client_operation_id);
 if result->>'status'is distinct from'received'then return result;end if;
 select*into c from app.registration_claims where registration_link_id=p_link_id and client_operation_id=p_client_operation_id for update;
 if c.id is null then raise exception 'received registration claim unavailable';end if;
 select*into old from app.registration_stationary_requests_v1 where claim_id=c.id;
 if found then if old.tournament_id<>c.tournament_id or old.requested is distinct from p_stationary_requested then raise exception 'stationary preference retry differs';end if;
 else
  -- Never retrofit a legacy replay as a fresh player preference.
  if existed then raise exception 'legacy registration requires separate preference review';end if;
  insert into app.registration_stationary_requests_v1(claim_id,tournament_id,requested)values(c.id,c.tournament_id,p_stationary_requested);
 end if;
 return result;
end$$;
create function public.get_registration_stationary_workspace_v1(p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$declare actor uuid:=auth.uid();items jsonb;begin
 if app.stationary_registration_enabled_v1()is distinct from true or actor is null then return null;end if;
 lock table app.tournament_roles in share mode;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor and role in('director','co_director'))then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('claimId',c.id,'displayName',c.display_name,'registrationStatus',c.status,
 'rosterEntryIds',(select coalesce(jsonb_agg(r.id order by r.id),'[]')from app.tournament_roster_entries r where r.tournament_id=c.tournament_id and r.source_claim_id=c.id),
 'revision',coalesce(v.revision,0),'decision',coalesce(v.decision,'pending'),'reason',v.reason)order by c.submitted_at,c.id),'[]')into items
 from app.registration_stationary_requests_v1 q join app.registration_claims c on c.id=q.claim_id and c.tournament_id=q.tournament_id
 left join lateral(select revision,decision,reason from app.registration_stationary_reviews_v1 where claim_id=c.id order by revision desc limit 1)v on true
 where q.tournament_id=p_tournament_id and q.requested;
 return jsonb_build_object('actorId',actor,'requests',items);
end$$;
create function public.review_registration_stationary_request_v1(p_tournament_id uuid,p_claim_id uuid,p_expected_revision integer,p_decision text,p_reason text,p_operation_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();old app.registration_stationary_reviews_v1%rowtype;revision integer;digest text;response jsonb;begin
 if app.stationary_registration_enabled_v1()is distinct from true or actor is null then return null;end if;
 if p_claim_id is null or p_tournament_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483647 or p_decision is null or p_decision not in('reviewed','not_accommodated')or length(trim(coalesce(p_reason,'')))not between 1 and 500 or octet_length(p_reason)>2000 then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':stationary:'||p_operation_id::text,0));
 lock table app.tournament_roles in share mode;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor and role in('director','co_director'))then return null;end if;
 digest:=encode(extensions.digest(jsonb_build_array(p_tournament_id,p_claim_id,p_expected_revision,p_decision,p_reason)::text,'sha256'),'hex');
 select*into old from app.registration_stationary_reviews_v1 where actor_id=actor and operation_id=p_operation_id;
 if found then if old.request_hash=digest then return old.response;end if;return null;end if;
 perform 1 from app.registration_stationary_requests_v1 where claim_id=p_claim_id and tournament_id=p_tournament_id and requested for update;if not found then return null;end if;
 select coalesce(max(v.revision),0)into revision from app.registration_stationary_reviews_v1 v where claim_id=p_claim_id;
 if revision>p_expected_revision then return jsonb_build_object('kind','stationary-review-superseded-v1','actorId',actor,'tournamentId',p_tournament_id,'request',jsonb_build_object('expectedActorId',actor,'claimId',p_claim_id,'expectedRevision',p_expected_revision,'decision',p_decision,'reason',p_reason,'operationId',p_operation_id),'currentRevision',revision,'noWriteCommitted',true);end if;
 if revision<p_expected_revision then return null;end if;
 response:=jsonb_build_object('kind','stationary-review-recorded-v1','actorId',actor,'tournamentId',p_tournament_id,'claimId',p_claim_id,'operationId',p_operation_id,'revision',revision+1,'decision',p_decision);
 insert into app.registration_stationary_reviews_v1(claim_id,tournament_id,revision,actor_id,operation_id,decision,reason,request_hash,response)values(p_claim_id,p_tournament_id,revision+1,actor,p_operation_id,p_decision,p_reason,digest,response);
 return response;
end$$;
revoke all on function app.stationary_registration_enabled_v1(),app.stationary_registration_immutable_v1(),public.submit_registration_claim_stationary_v1(uuid,bytea,text,text,text,text,text,text,uuid,boolean),public.get_registration_stationary_workspace_v1(uuid),public.review_registration_stationary_request_v1(uuid,uuid,integer,text,text,uuid)from public,anon,authenticated,service_role;
alter table app.registration_stationary_requests_v1 owner to postgres;
alter table app.registration_stationary_reviews_v1 owner to postgres;
alter function app.stationary_registration_enabled_v1()owner to postgres;
alter function app.stationary_registration_immutable_v1()owner to postgres;
alter function public.submit_registration_claim_stationary_v1(uuid,bytea,text,text,text,text,text,text,uuid,boolean)owner to postgres;
alter function public.get_registration_stationary_workspace_v1(uuid)owner to postgres;
alter function public.review_registration_stationary_request_v1(uuid,uuid,integer,text,text,uuid)owner to postgres;
-- Application EXECUTE is intentionally absent pending reviewed installation.
commit;
