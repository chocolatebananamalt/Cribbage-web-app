-- LOCAL PROPOSAL ONLY. No project, fixture, receipt, result or role is seeded.
-- Install after synthetic-mixed-evidence-v1 and its eighteen-player extension.
-- One Standard Main only. All amounts are simulation records, never payments.
begin;
create table app.synthetic_mixed_finance_scopes_v1(
 tournament_id uuid primary key references app.tournaments(id),event_id uuid not null unique,
 project_ref text not null check(project_ref='nnhcnvksxgxnpvdqjgpg'),
 authorization_reference text not null check(length(trim(authorization_reference))between 1 and 500),
 roster_snapshot jsonb not null,setup_snapshot jsonb not null,source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 enrolled_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),unique(event_id,tournament_id));
create table app.synthetic_mixed_finance_bindings_v1(
 event_id uuid primary key,tournament_id uuid not null,scoring_source_sha256 text not null,
 binding_sha256 text not null check(binding_sha256~'^[a-f0-9]{64}$'),bound_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_finance_scopes_v1(event_id,tournament_id),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_fixtures_v1(event_id,tournament_id));
create table app.synthetic_mixed_main_artifacts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 kind text not null check(kind in('close','qualification','tie','playoff','cross_check')),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),payload jsonb not null,
 artifact_text text not null,sha256 text generated always as(encode(extensions.digest(artifact_text,'sha256'),'hex'))stored,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_finance_scopes_v1(event_id,tournament_id),unique(id,tournament_id,event_id));
create table app.synthetic_mixed_main_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,action text not null,request_hash text not null,
 artifact_id uuid references app.synthetic_mixed_main_artifacts_v1(id),backend_pid integer not null,transaction_id bigint not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_finance_scopes_v1(event_id,tournament_id));
create table app.synthetic_mixed_main_provenance_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 entity_table text not null,entity_id uuid not null,operation_receipt_id uuid not null,
 context_id uuid not null references app.synthetic_mixed_main_contexts_v1(id),artifact_id uuid references app.synthetic_mixed_main_artifacts_v1(id),
 action text not null,record_sha256 text not null check(record_sha256~'^[a-f0-9]{64}$'),
 actual_money_received boolean not null default false check(not actual_money_received),money_moved boolean not null default false check(not money_moved),
 fictional_paper_play_claimed boolean not null default false check(not fictional_paper_play_claimed),independent_human_play_certified boolean not null default false check(not independent_human_play_certified),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_mixed_finance_scopes_v1(event_id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(entity_table,entity_id));
create table app.synthetic_mixed_main_requests_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 action text not null,request_hash text not null,artifact_id uuid,response jsonb,native_receipt_id uuid references app.operation_receipts(id),
 context_id uuid references app.synthetic_mixed_main_contexts_v1(id),recorded_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),foreign key(event_id,tournament_id)references app.synthetic_mixed_finance_scopes_v1(event_id,tournament_id));

create function app.synthetic_mixed_finance_roster_v1(tid uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'name',r.claimed_display_name,'mode',r.scorecard_type,'preferenceVersion',r.scorecard_preference_version,
 'links',(select coalesce(jsonb_agg(jsonb_build_array(l.id,l.profile_id)order by l.id),'[]')from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id),
 'lifecycle',(select event_type from app.roster_entry_lifecycle_events life where life.roster_entry_id=r.id order by version desc limit 1))order by r.id),'[]')
 from app.tournament_roster_entries r where r.tournament_id=tid
$$;
create function app.synthetic_mixed_finance_setup_v1(tid uuid,eid uuid)returns jsonb language sql stable security definer set search_path=''as $$
 select jsonb_build_object('activation',to_jsonb(a),'event',jsonb_build_object('id',e.id,'eventType',e.event_type,'format',e.format,'scoringMethod',e.scoring_method,'rulesetId',e.ruleset_version_id),
 'setupEvent',to_jsonb(se),'regularBindings',(select jsonb_agg(to_jsonb(b)order by b.id)from app.event_prize_schedule_bindings_v1 b where b.tournament_id=tid and b.event_id=eid),
 'regularSchedules',(select jsonb_agg(to_jsonb(p)order by p.id)from app.setup_prize_schedule_versions_v1 p where p.tournament_id=tid),
 'qDefinitions',(select jsonb_agg(to_jsonb(p)order by p.id)from app.tournament_setup_q_pool_versions p where p.tournament_id=tid),
 'qPolicies',(select jsonb_agg(to_jsonb(p)order by p.id)from app.q_operating_policies_v2 p where p.tournament_id=tid),
 'sideDefinitions',(select jsonb_agg(to_jsonb(p)order by p.id)from app.event_side_pool_definition_versions p where p.tournament_id=tid),
 'sideAmounts',(select jsonb_agg(to_jsonb(p)order by p.id)from app.side_pool_graduated_policies_v2 p where p.tournament_id=tid),
 'sideRecipients',(select jsonb_agg(to_jsonb(p)order by p.id)from app.side_pool_recipient_policies_v3 p where p.tournament_id=tid))
 from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id
 join app.tournament_setup_event_versions se on se.id=a.setup_event_version_id and se.tournament_id=tid where a.tournament_id=tid and a.event_id=eid
$$;
create function app.assert_synthetic_mixed_finance_current_v1(tid uuid,eid uuid)returns void language plpgsql security definer set search_path=''as $$
begin
 if not exists(select 1 from app.synthetic_mixed_finance_scopes_v1 f where f.tournament_id=tid and f.event_id=eid
 and f.roster_snapshot=app.synthetic_mixed_finance_roster_v1(tid)and f.setup_snapshot=app.synthetic_mixed_finance_setup_v1(tid,eid))then raise exception'mixed_finance_source_changed';end if;
end$$;

-- Explicit owner-only precollection enrollment. Configuration may already be
-- disclosed, but no financial/election evidence can be retroactively adopted.
create function app.enroll_synthetic_mixed_finance_v1(tid uuid,eid uuid,project text,authorization_ref text)returns void language plpgsql security definer set search_path=''as $$
declare rs jsonb;ss jsonb;begin
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update;
 if not found or project<>'nnhcnvksxgxnpvdqjgpg'or length(trim(authorization_ref))not between 1 and 500
 or not exists(select 1 from app.synthetic_mixed_deployments_v1 where project_ref=project)
 or(select count(*)from app.events where tournament_id=tid)<>1 or(select count(*)from app.tournament_setup_activations where tournament_id=tid)<>1
 or not exists(select 1 from app.events e join app.tournament_setup_activations a on a.event_id=e.id join app.tournament_setup_event_versions se on se.id=a.setup_event_version_id
 where e.id=eid and e.tournament_id=tid and e.event_type='main'and e.format='standard_singles'and e.scoring_method='digital'and e.operational_state='active'and se.style_code='Standard'and se.game_count=12 and se.entry_fee_cents=3000)
 or exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=tid)
 or exists(select 1 from app.multi_event_finance_modes_v1 where tournament_id=tid)
 then raise exception'mixed_finance_scope_unavailable';end if;
 rs:=app.synthetic_mixed_finance_roster_v1(tid);ss:=app.synthetic_mixed_finance_setup_v1(tid,eid);
 if jsonb_array_length(rs)<>18 or(select count(*)from jsonb_array_elements(rs)x where x->>'mode'='digital'and jsonb_array_length(x->'links')=1)<>6
 or(select count(*)from jsonb_array_elements(rs)x where x->>'mode'='paper'and jsonb_array_length(x->'links')=0)<>12
 or exists(select 1 from jsonb_array_elements(rs)x where x->>'lifecycle'='withdrawn')
 or not exists(select 1 from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 p on p.id=b.schedule_version_id where b.event_id=eid and app.valid_regular_prize_schedule_v3(p.schedule_payload))
 or(select count(*)from app.tournament_setup_q_pool_versions where tournament_id=tid)<>1
 or(select count(*)from app.event_side_pools where tournament_id=tid)<>1
 or exists(select 1 from app.roster_payment_events where tournament_id=tid)
 or exists(select 1 from app.roster_payment_obligation_versions where tournament_id=tid)
 or exists(select 1 from app.tournament_expense_events where tournament_id=tid)
 or exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=tid)
 or exists(select 1 from app.q_pool_allocation_versions_v1 where tournament_id=tid)
 or exists(select 1 from app.event_side_pool_election_versions where tournament_id=tid)
 or exists(select 1 from app.card_scorelines where tournament_id=tid)
 then raise exception'mixed_finance_precollection_required';end if;
 insert into app.synthetic_mixed_finance_scopes_v1(tournament_id,event_id,project_ref,authorization_reference,roster_snapshot,setup_snapshot,source_sha256)
 values(tid,eid,project,authorization_ref,rs,ss,encode(extensions.digest(jsonb_build_array(rs,ss)::text,'sha256'),'hex'));
end$$;

create function app.bind_synthetic_mixed_finance_v1(tid uuid,eid uuid)returns void language plpgsql security definer set search_path=''as $$
declare f app.synthetic_mixed_fixtures_v1%rowtype;begin
 perform 1 from app.tournaments where id=tid for update;perform 1 from app.events where id=eid and tournament_id=tid for update;
 perform app.assert_synthetic_mixed_finance_current_v1(tid,eid);perform app.assert_synthetic_mixed_current_v1(tid,eid);
 select * into f from app.synthetic_mixed_fixtures_v1 where event_id=eid and tournament_id=tid;
 if (select count(*)from app.synthetic_mixed_games_v1 where event_id=eid)<>108 or exists(select 1 from app.score_submissions where canonical_game_id in(select game_id from app.synthetic_mixed_games_v1 where event_id=eid))
 or exists(select 1 from app.card_scorelines where event_id=eid)then raise exception'mixed_finance_binding_unavailable';end if;
 if exists(select 1 from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id
 where p.event_id=eid and p.tournament_id=tid and not exists(select 1 from jsonb_array_elements((select roster_snapshot from app.synthetic_mixed_finance_scopes_v1 where event_id=eid))x
 where x->>'rosterEntryId'=r.id::text and x->>'mode'=r.scorecard_type and x->>'preferenceVersion'=r.scorecard_preference_version::text))then raise exception'mixed_finance_binding_unavailable';end if;
 insert into app.synthetic_mixed_finance_bindings_v1(event_id,tournament_id,scoring_source_sha256,binding_sha256)
 values(eid,tid,f.source_sha256,encode(extensions.digest(jsonb_build_array(f.source_sha256,(select source_sha256 from app.synthetic_mixed_finance_scopes_v1 where event_id=eid))::text,'sha256'),'hex'));
end$$;

create function app.synthetic_mixed_complete_source_v1(tid uuid,eid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare manifest jsonb;begin
 perform app.assert_synthetic_mixed_finance_current_v1(tid,eid);perform app.assert_synthetic_mixed_current_v1(tid,eid);
 if not exists(select 1 from app.synthetic_mixed_finance_bindings_v1 b join app.synthetic_mixed_fixtures_v1 f using(event_id,tournament_id)where b.event_id=eid and b.tournament_id=tid and b.scoring_source_sha256=f.source_sha256)
 or(select count(*)from app.synthetic_mixed_games_v1 where event_id=eid and tournament_id=tid)<>108
 or(select count(*)from app.current_effective_scorelines(tid,eid))<>216
 or exists(select 1 from app.synthetic_mixed_games_v1 m join app.canonical_games g on g.id=m.game_id where m.event_id=eid and(g.state<>'verified'
 or exists(select 1 from app.device_failure_recoveries r where r.canonical_game_id=g.id)
 or exists(select 1 from app.operational_game_forfeits r where r.canonical_game_id=g.id)
 or exists(select 1 from app.game_corrections r where r.canonical_game_id=g.id)
 or exists(select 1 from app.independent_card_corrections r where r.canonical_game_id=g.id)
 or(m.pairing='DD'and((select count(*)from app.score_submissions where canonical_game_id=g.id)<>2 or(select count(*)from app.score_confirmations where canonical_game_id=g.id)<>2 or exists(select 1 from app.synthetic_mixed_artifacts_v1 where game_id=g.id)))
 or(m.pairing='PD'and((select count(*)from app.score_submissions where canonical_game_id=g.id)<>1 or exists(select 1 from app.score_confirmations where canonical_game_id=g.id)
 or not app.hybrid_game_is_approved(g.id)or(select count(*)from app.synthetic_mixed_attestations_v1 where game_id=g.id)<>1
 or(select count(*)from app.synthetic_mixed_provenance_v1 where game_id=g.id and phase in('capture','review'))<>2))
 or(m.pairing='PP'and(exists(select 1 from app.score_submissions where canonical_game_id=g.id)or exists(select 1 from app.score_confirmations where canonical_game_id=g.id)
 or not exists(select 1 from app.paper_game_completions pc where pc.canonical_game_id=g.id and app.paper_game_completion_is_approved(pc.id))or(select count(*)from app.synthetic_mixed_provenance_v1 where game_id=g.id and phase in('capture','review'))<>2))))
 then return null;end if;
 manifest:=jsonb_build_object('kind','synthetic-mixed-main-complete108-v1','financeScope',(select source_sha256 from app.synthetic_mixed_finance_scopes_v1 where event_id=eid),
 'binding',(select to_jsonb(b)from app.synthetic_mixed_finance_bindings_v1 b where b.event_id=eid),
 'games',(select jsonb_agg(jsonb_build_array(to_jsonb(g),to_jsonb(m))order by g.id)from app.synthetic_mixed_games_v1 m join app.canonical_games g on g.id=m.game_id where m.event_id=eid),
 'scorelines',(select jsonb_agg(to_jsonb(s)order by s.id)from app.card_scorelines s where s.event_id=eid),
 'submissions',(select jsonb_agg(to_jsonb(s)order by s.id)from app.score_submissions s join app.canonical_games g on g.id=s.canonical_game_id where g.event_id=eid),
 'confirmations',(select jsonb_agg(to_jsonb(s)order by s.id)from app.score_confirmations s join app.canonical_games g on g.id=s.canonical_game_id where g.event_id=eid),
 'artifacts',(select jsonb_agg(to_jsonb(a)order by a.id)from app.synthetic_mixed_artifacts_v1 a where a.event_id=eid),
 'ownAcknowledgements',(select jsonb_agg(to_jsonb(a)order by a.id)from app.synthetic_mixed_attestations_v1 a where a.event_id=eid),
 'syntheticSources',(select jsonb_agg(to_jsonb(p)order by p.operation_receipt_id)from app.synthetic_mixed_provenance_v1 p where p.event_id=eid));
 return jsonb_build_object('manifest',manifest,'sourceDigest',encode(extensions.digest(manifest::text,'sha256'),'hex'));
end$$;

create function app.synthetic_mixed_main_artifact_source_v1(actor uuid,tid uuid,eid uuid,kind_value text)returns text language plpgsql stable security definer set search_path=''as $$
declare proof jsonb;w jsonb;begin
 proof:=app.synthetic_mixed_complete_source_v1(tid,eid);if proof is null then return null;end if;
 if kind_value='playoff'then w:=public.get_standard_singles_playoff_outcome_workspace_v4(actor,tid,eid);
 elsif kind_value='tie'then w:=public.get_qualification_tie_workspace_v1(actor,tid,eid);
 elsif kind_value='cross_check'then w:=public.get_cross_check_finalization_workspace_v1(actor,tid);
 elsif kind_value='qualification'then w:=jsonb_build_object('ties',(select jsonb_agg(to_jsonb(t)order by t.id)from app.qualification_tie_resolutions_v1 t where t.event_id=eid));
 elsif kind_value='close'then w:='{}';else return null;end if;
 return encode(extensions.digest(jsonb_build_array(kind_value,proof->>'sourceDigest',w)::text,'sha256'),'hex');
end$$;
create function app.prepare_synthetic_mixed_main_artifact_v1(actor uuid,tid uuid,eid uuid,kind_value text,decision jsonb)returns uuid language plpgsql security definer set search_path=''as $$
declare source text;w jsonb;p jsonb;aid uuid;body text;begin
 perform 1 from app.tournaments where id=tid for update;perform 1 from app.events where id=eid and tournament_id=tid for update;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))
 or exists(select 1 from app.prize_accounting_finals_v9 where event_id=eid)then raise exception'mixed_main_artifact_unavailable';end if;
 source:=app.synthetic_mixed_main_artifact_source_v1(actor,tid,eid,kind_value);if source is null then raise exception'mixed_main_source_unavailable';end if;
 if kind_value='playoff'then
  w:=public.get_standard_singles_playoff_outcome_workspace_v4(actor,tid,eid);
  if jsonb_typeof(decision)is distinct from'array'or jsonb_array_length(decision)<>4
  or app.derive_five_qualifier_playoff_v4((w->>'qualificationResultVersionId')::uuid,(select jsonb_agg(x||jsonb_build_object('evidenceNote','SIMULATED mixed rehearsal series')order by n)from jsonb_array_elements(decision)with ordinality e(x,n)))is null then raise exception'mixed_main_decision_invalid';end if;
  p:=jsonb_build_object('qualificationResultVersionId',w->'qualificationResultVersionId','expectedVersion',w->'currentVersion','sourceDigest',w->'sourceDigest','series',decision);
 elsif kind_value in('close','qualification','cross_check')then if decision is distinct from'{}'::jsonb then raise exception'mixed_main_decision_invalid';end if;p:='{}';
 else raise exception'mixed_main_tie_requires_reviewed_extension';end if;
 body:='SYNTHETIC MIXED MAIN EVIDENCE'||chr(10)||'Kind: '||kind_value||chr(10)||'Source: '||source||chr(10)||'Simulated decision: '||p::text||chr(10)||'Fictional paper opponents did not play. Digital records are identity-bound; physical human play is not certified. No actual money received or moved.';
 insert into app.synthetic_mixed_main_artifacts_v1(tournament_id,event_id,kind,source_digest,payload,artifact_text)values(tid,eid,kind_value,source,p,body)returning id into aid;return aid;
end$$;

-- New explicit protocol context, not a client-settable GUC alone.
create function app.synthetic_mixed_main_allowed_table_v1(action_value text,table_value text)returns boolean language sql immutable set search_path=''as $$
 select case action_value
 when'obligation'then table_value='roster_payment_obligation_versions'
 when'receipt'then table_value='roster_payment_events'
 when'expense'then table_value='tournament_expense_events'
 when'q_membership'then table_value in('q_pool_membership_versions_v1','q_pool_allocation_versions_v1')
 when'side_election'then table_value='event_side_pool_election_versions'
 when'q_review'then table_value='q_obligation_reviews_v2'
 when'side_review'then table_value='side_pool_recipient_reviews_v3'
 when'close'then table_value='event_play_closes'
 when'qualification'then table_value='qualification_result_versions'
 when'tie'then table_value='qualification_tie_resolutions_v1'
 when'playoff'then table_value='playoff_outcome_versions_v4'
 when'cross_check'then table_value='cross_check_finalizations'
 when'draft'then table_value='prize_accounting_drafts_v9'
 when'final'then table_value='prize_accounting_finals_v9'
 else false end
$$;
create function app.assert_synthetic_mixed_main_context_v1(tid uuid,table_value text,row_value jsonb)returns app.synthetic_mixed_main_contexts_v1
language plpgsql security definer set search_path=''as $$
declare c app.synthetic_mixed_main_contexts_v1%rowtype;r app.operation_receipts%rowtype;a app.synthetic_mixed_main_artifacts_v1%rowtype;
begin
 select * into c from app.synthetic_mixed_main_contexts_v1 where id::text=current_setting('app.synthetic_mixed_main_context',true)
 and tournament_id=tid and backend_pid=pg_backend_pid()and transaction_id=txid_current();
 if not found or not app.synthetic_mixed_main_allowed_table_v1(c.action,table_value)
 or row_value?'event_id'and(row_value->>'event_id')::uuid<>c.event_id then raise exception'mixed_main_context_required';end if;
 perform app.assert_synthetic_mixed_finance_current_v1(tid,c.event_id);
 if exists(select 1 from app.prize_accounting_finals_v9 where event_id=c.event_id)and not(table_value='prize_accounting_finals_v9'and c.action='final')then raise exception'mixed_main_already_final';end if;
 select * into r from app.operation_receipts where id=(row_value->>'operation_receipt_id')::uuid and tournament_id=tid;
 if not found or r.actor_profile_id<>c.actor_id or r.client_operation_id<>c.operation_id or r.outcome<>'accepted'then raise exception'mixed_main_receipt_required';end if;
 if c.action in('draft','final')then
  if row_value->>'source_digest'is distinct from(app.prize_accounting_source_v9(c.actor_id,tid,c.event_id)->>'sourceDigest')
  or c.action='draft'and row_value->'source_manifest'->>'kind'is distinct from'synthetic-mixed-main-accounting-v1'
  or c.action='final'and not exists(select 1 from app.prize_accounting_drafts_v9 d where d.id=(row_value->>'draft_id')::uuid and d.event_id=c.event_id and d.source_manifest->>'kind'='synthetic-mixed-main-accounting-v1')then
   raise exception'mixed_main_accounting_manifest_required';
  end if;
 end if;
 if c.action in('close','qualification','tie','playoff','cross_check')then
  select * into a from app.synthetic_mixed_main_artifacts_v1 where id=c.artifact_id and tournament_id=tid and event_id=c.event_id and kind=c.action;
  if not found or a.source_digest is distinct from app.synthetic_mixed_main_artifact_source_v1(c.actor_id,tid,c.event_id,c.action)then raise exception'mixed_main_artifact_stale';end if;
 end if;
 return c;
end$$;
create function app.guard_synthetic_mixed_main_row_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare j jsonb:=to_jsonb(new);c app.synthetic_mixed_main_contexts_v1%rowtype;begin
 if not exists(select 1 from app.synthetic_mixed_finance_scopes_v1 where tournament_id=new.tournament_id)then return new;end if;
 c:=app.assert_synthetic_mixed_main_context_v1(new.tournament_id,tg_table_name,j);return new;
end$$;
create function app.annotate_synthetic_mixed_main_row_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare j jsonb:=to_jsonb(new);c app.synthetic_mixed_main_contexts_v1%rowtype;begin
 if not exists(select 1 from app.synthetic_mixed_finance_scopes_v1 where tournament_id=new.tournament_id)then return new;end if;
 -- Before guard already checked the current artifact. A qualification insert
 -- may itself change its reader; do not recompute that reader after writing.
 select * into c from app.synthetic_mixed_main_contexts_v1 where id::text=current_setting('app.synthetic_mixed_main_context',true)
 and tournament_id=new.tournament_id and backend_pid=pg_backend_pid()and transaction_id=txid_current();
 if not found or not app.synthetic_mixed_main_allowed_table_v1(c.action,tg_table_name)then raise exception'mixed_main_annotation_context_required';end if;
 insert into app.synthetic_mixed_main_provenance_v1(tournament_id,event_id,entity_table,entity_id,operation_receipt_id,context_id,artifact_id,action,record_sha256)
 values(new.tournament_id,c.event_id,tg_table_name,(j->>'id')::uuid,(j->>'operation_receipt_id')::uuid,c.id,c.artifact_id,c.action,encode(extensions.digest(j::text,'sha256'),'hex'));
 return new;
end$$;

-- Keep the original mixed-only closure denial for every unsupported scope.
-- Replace its exact body at this one audited seam; ordinary and all-paper
-- execution still follows the original expression unchanged.
do $$declare d text;anchor text:='begin'||chr(10)||' if exists(select 1 from app.synthetic_mixed_fixtures_v1';replacement text;begin
 d:=pg_get_functiondef('app.block_unreviewed_mixed_closure_v1()'::regprocedure);
 if(length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception'mixed closure guard anchor changed';end if;
 replacement:='begin'||chr(10)||' if exists(select 1 from app.synthetic_mixed_finance_scopes_v1 where tournament_id=new.tournament_id)then perform app.assert_synthetic_mixed_main_context_v1(new.tournament_id,tg_table_name,to_jsonb(new));return new;end if;'||chr(10)||' if exists(select 1 from app.synthetic_mixed_fixtures_v1';
 execute replace(d,anchor,replacement);
end$$;

create function app.synthetic_mixed_main_dispatch_v1(actor uuid,tid uuid,eid uuid,action_value text,req jsonb,op uuid,artifact uuid default null)returns jsonb
language plpgsql security definer set search_path=''as $$
declare h text;prior_setting text;prior_sub text;prior_claims text;c uuid;response jsonb;r app.operation_receipts%rowtype;
 binding app.synthetic_mixed_main_requests_v1%rowtype;a app.synthetic_mixed_main_artifacts_v1%rowtype;accepted boolean;target uuid;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'
 or actor is null or tid is null or eid is null or op is null or jsonb_typeof(req)is distinct from'object'
 or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')then return null;end if;
 if action_value not in('obligation','receipt','expense','q_membership','side_election','q_review','side_review','close','qualification','tie','playoff','cross_check','draft','final')then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0));
 h:=encode(extensions.digest(jsonb_build_array('synthetic-mixed-main-v1',actor,tid,eid,action_value,req,artifact)::text,'sha256'),'hex');
 select * into binding from app.synthetic_mixed_main_requests_v1 where actor_id=actor and operation_id=op;
 if found then if binding.tournament_id=tid and binding.event_id=eid and binding.action=action_value and binding.request_hash=h and binding.artifact_id is not distinct from artifact then return binding.response;end if;
 return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 -- Every new mixed-finance wrapper takes this additional namespace only after
 -- actor/op. Ordinary writers have no context and reject without taking it.
 perform pg_advisory_xact_lock(hashtextextended('synthetic-mixed-main:'||tid::text,0));
 perform app.assert_synthetic_mixed_finance_current_v1(tid,eid);
 if exists(select 1 from app.prize_accounting_finals_v9 where event_id=eid)then return jsonb_build_object('status','rejected','code','already_finalized');end if;
 if action_value in('close','qualification','tie','playoff','cross_check')then
  select * into a from app.synthetic_mixed_main_artifacts_v1 where id=artifact and tournament_id=tid and event_id=eid and kind=action_value;
  if not found then return jsonb_build_object('status','rejected','code','invalid_artifact');end if;
  if action_value='playoff'and(req-'reason'-'reviewed'-'series'<>a.payload-'series'
   or(select jsonb_agg(x-'evidenceNote'order by n)from jsonb_array_elements(req->'series')with ordinality e(x,n))is distinct from a.payload->'series'
   or exists(select 1 from jsonb_array_elements(req->'series')with ordinality e(x,n)where x->>'evidenceNote'is distinct from'SYNTHETIC-MIXED-MAIN-v1:'||a.id||':'||a.sha256||':'||n))then return jsonb_build_object('status','rejected','code','invalid_artifact');end if;
 elsif artifact is not null then return jsonb_build_object('status','rejected','code','invalid_artifact');end if;
 if action_value in('obligation','receipt','expense','q_membership','side_election','q_review','side_review','draft','final')
 and position('TEST ONLY SYNTHETIC:'in coalesce(req->>'reason',''))<>1 then return jsonb_build_object('status','rejected','code','simulation_reason_required');end if;
 insert into app.synthetic_mixed_main_contexts_v1(tournament_id,event_id,actor_id,operation_id,action,request_hash,artifact_id,backend_pid,transaction_id)
 values(tid,eid,actor,op,action_value,h,artifact,pg_backend_pid(),txid_current())returning id into c;
 prior_setting:=current_setting('app.synthetic_mixed_main_context',true);perform set_config('app.synthetic_mixed_main_context',c::text,true);
 -- Existing authenticated collection functions derive auth.uid. The API binds
 -- actor from its verified subject; service-only callers cannot supply SQL.
 prior_sub:=current_setting('request.jwt.claim.sub',true);prior_claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',actor)::text,true);
 if action_value='obligation'then
  response:=public.set_roster_payment_obligation_v1(tid,(req->>'rosterEntryId')::uuid,(req->>'expectedVersion')::integer,(req->>'amountMinor')::integer,req->>'reason',op);
 elsif action_value='receipt'then
  if req->>'paymentMethod'is distinct from'cash'or req->>'currency'is distinct from'USD'then raise exception'mixed_main_simulation_receipt_only';end if;
  response:=public.record_manual_roster_payment(tid,(req->>'rosterEntryId')::uuid,(req->>'expectedVersion')::integer,(req->>'amountMinor')::integer,'USD','cash',(req->>'receivedAt')::timestamptz,req->>'reason',op);
 elsif action_value='expense'then response:=public.record_tournament_expense(tid,(req->>'amountMinor')::integer,'USD',req->>'reason',op);
 elsif action_value='q_membership'then response:=public.save_q_pool_membership_v1(actor,tid,req,op);
 elsif action_value='side_election'then response:=public.save_side_pool_graduated_election_v2(actor,tid,eid,(req->>'poolId')::uuid,req-'poolId',op);
 elsif action_value='q_review'then response:=public.record_q_obligation_review_v2(actor,tid,req,op);
 elsif action_value='side_review'then response:=public.record_side_pool_recipient_review_v3(actor,tid,eid,(req->>'poolId')::uuid,req-'poolId',op);
 elsif action_value='close'then response:=public.close_event_play_v1(actor,tid,eid,'TEST ONLY SYNTHETIC: SYNTHETIC-MIXED-MAIN-v1:'||a.id||':'||a.sha256,true,op);
 elsif action_value='qualification'then response:=public.finalize_standard_singles_qualification_v1(actor,tid,eid,op);
 elsif action_value='tie'then raise exception'mixed_main_tie_requires_reviewed_extension';
 elsif action_value='playoff'then response:=public.record_standard_singles_playoff_outcomes_v4(actor,tid,eid,req,op);
 elsif action_value='cross_check'then response:=public.finalize_cross_checking_v1(actor,tid,op);
 elsif action_value='draft'then response:=public.save_prize_accounting_draft_v9(actor,tid,eid,req,op);
 elsif action_value='final'then response:=public.finalize_prize_accounting_v9(actor,tid,eid,req,op);
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
 perform set_config('app.synthetic_mixed_main_context',coalesce(prior_setting,''),true);
 accepted:=response->>'status'in('payment_obligation_saved','payment_recorded','expense_recorded','q_pool_saved','side_pool_election_saved_v2','q_obligations_recorded_v2','side_pool_recipients_reviewed_unpaid','event_play_closed','qualification_finalized','playoff_outcomes_recorded_v4','cross_checking_finalized','prize_accounting_draft_saved_v9','prize_accounting_finalized_unpaid_v9');
 select * into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op and tournament_id=tid;
 if accepted and(r.id is null or r.outcome<>'accepted'or r.response_payload is distinct from response
 or not exists(select 1 from app.synthetic_mixed_main_provenance_v1 where context_id=c and operation_receipt_id=r.id))then raise exception'mixed_main_provenance_atomicity_required';end if;
 if not coalesce(accepted,false)and exists(select 1 from app.synthetic_mixed_main_provenance_v1 where context_id=c)then raise exception'mixed_main_rejected_write_rollback_required';end if;
 insert into app.synthetic_mixed_main_requests_v1(actor_id,operation_id,tournament_id,event_id,action,request_hash,artifact_id,response,native_receipt_id,context_id)
 values(actor,op,tid,eid,action_value,h,artifact,response,r.id,c);
 return response;
end$$;

-- Explicit service-only entry points. There is no client-selected SQL function.
create function public.record_synthetic_mixed_obligation_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'obligation',req,op)$$;
create function public.record_synthetic_mixed_receipt_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'receipt',req,op)$$;
create function public.record_synthetic_mixed_expense_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'expense',req,op)$$;
create function public.save_synthetic_mixed_q_membership_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'q_membership',req,op)$$;
create function public.save_synthetic_mixed_side_election_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'side_election',req,op)$$;
create function public.review_synthetic_mixed_q_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'q_review',req,op)$$;
create function public.review_synthetic_mixed_side_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'side_review',req,op)$$;
create function public.close_synthetic_mixed_main_v1(actor uuid,tid uuid,eid uuid,artifact uuid,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'close','{}',op,artifact)$$;
create function public.qualify_synthetic_mixed_main_v1(actor uuid,tid uuid,eid uuid,artifact uuid,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'qualification','{}',op,artifact)$$;
create function public.record_synthetic_mixed_playoff_v1(actor uuid,tid uuid,eid uuid,artifact uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'playoff',req,op,artifact)$$;
create function public.crosscheck_synthetic_mixed_main_v1(actor uuid,tid uuid,eid uuid,artifact uuid,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'cross_check','{}',op,artifact)$$;
create function public.draft_synthetic_mixed_main_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'draft',req,op)$$;
create function public.finalize_synthetic_mixed_main_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language sql security definer set search_path=''as $$select app.synthetic_mixed_main_dispatch_v1(actor,tid,eid,'final',req,op)$$;

-- Preserve the exact installed canonical arithmetic/source implementation for
-- every ordinary and historical all-paper event. Only this explicit new scope
-- gets a versioned additional source manifest; no monetary kernel is cloned.
-- Clone the preserved source privately, retaining the original entry's OID so
-- already-prepared canonical callers cannot keep an obsolete resolved entry.
do $$declare d text;anchor text:='FUNCTION app.prize_accounting_source_v9(';begin
 d:=pg_get_functiondef('app.prize_accounting_source_v9(uuid,uuid,uuid)'::regprocedure);
 if(length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception'mixed accounting source clone anchor changed';end if;
 execute replace(d,anchor,'FUNCTION app.prize_accounting_source_before_mixed_main_v1(');
end$$;
create or replace function app.prize_accounting_source_v9(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare original jsonb;proof jsonb;manifest jsonb;annotations jsonb;begin
 original:=app.prize_accounting_source_before_mixed_main_v1(actor,tid,eid);
 if not exists(select 1 from app.synthetic_mixed_finance_scopes_v1 where tournament_id=tid and event_id=eid)then return original;end if;
 if original is null then return null;end if;
 proof:=app.synthetic_mixed_complete_source_v1(tid,eid);
 if proof is null then return jsonb_set(original,'{blockers}',coalesce(original->'blockers','[]')||'"mixed_source_incomplete"'::jsonb);end if;
 if not exists(select 1 from app.synthetic_mixed_main_provenance_v1 where event_id=eid and action='close')
 or not exists(select 1 from app.synthetic_mixed_main_provenance_v1 where event_id=eid and action='qualification')
 or not exists(select 1 from app.synthetic_mixed_main_provenance_v1 where event_id=eid and action='playoff')then
 return jsonb_set(original,'{blockers}',coalesce(original->'blockers','[]')||'"mixed_lifecycle_provenance_required"'::jsonb);end if;
 select coalesce(jsonb_agg(to_jsonb(p)order by p.entity_table,p.entity_id),'[]')into annotations from app.synthetic_mixed_main_provenance_v1 p
 where p.event_id=eid and p.action not in('draft','final','cross_check');
 manifest:=jsonb_build_object('kind','synthetic-mixed-main-accounting-v1','canonical',original->'manifest','complete108',proof,
 'financeScope',(select jsonb_build_object('sourceSha256',s.source_sha256,'eventId',s.event_id,'projectRef',s.project_ref)from app.synthetic_mixed_finance_scopes_v1 s where s.event_id=eid),
 'binding',(select to_jsonb(b)from app.synthetic_mixed_finance_bindings_v1 b where b.event_id=eid),'prerequisiteAnnotations',annotations,
 'actualMoneyReceived',false,'moneyMoved',false,'fictionalPaperPlayClaimed',false,'independentHumanPlayCertified',false);
 return original||jsonb_build_object('manifest',manifest,'sourceDigest',encode(extensions.digest(manifest::text,'sha256'),'hex'));
end$$;
revoke all on function app.prize_accounting_source_before_mixed_main_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function app.prize_accounting_source_v9(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.freeze_synthetic_mixed_main_source_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare j jsonb:=case when tg_op='DELETE'then to_jsonb(old)else to_jsonb(new)end;tid uuid;
begin
 tid:=case when tg_table_name='tournaments'then(j->>'id')::uuid else(j->>'tournament_id')::uuid end;
 if exists(select 1 from app.synthetic_mixed_finance_scopes_v1 s join app.prize_accounting_finals_v9 f on f.event_id=s.event_id where s.tournament_id=tid)then raise exception'mixed_main_final_source_frozen';end if;
 if tg_op='DELETE'then return old;else return new;end if;
end$$;

do $$declare tbl text;routine record;begin
 -- Current financial/lifecycle rows are all guarded and annotated. Unrelated
 -- events return immediately; mixed unknown funding/void/alternate settlements
 -- remain denied by the pre-existing mixed closure guard and frozen source.
 foreach tbl in array array['roster_payment_obligation_versions','roster_payment_events','tournament_expense_events','q_pool_membership_versions_v1','q_pool_allocation_versions_v1',
 'q_operating_policies_v2','event_side_pool_definition_versions','side_pool_graduated_policies_v2','side_pool_recipient_policies_v3','event_side_pool_election_versions',
 'q_obligation_reviews_v2','side_pool_recipient_reviews_v3','qualification_tie_resolutions_v1','event_play_closes','qualification_result_versions','playoff_outcome_versions_v4',
 'cross_check_finalizations','prize_accounting_drafts_v9','prize_accounting_finals_v9']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_synthetic_mixed_main_row_v1()','aaa_mixed_main_guard_'||tbl,tbl);
 execute format('create trigger %I after insert on app.%I for each row execute function app.annotate_synthetic_mixed_main_row_v1()','mixed_main_provenance_'||tbl,tbl);
 end loop;
 foreach tbl in array array['prize_rounding_funding_events_v8','prize_rounding_funding_events_v9','event_side_pool_payout_versions','q_cut_attestations_v2','operational_game_forfeits','playoff_absence_decisions']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_synthetic_mixed_main_row_v1()','aaa_mixed_main_deny_'||tbl,tbl);end loop;
 foreach tbl in array array['synthetic_mixed_finance_scopes_v1','synthetic_mixed_finance_bindings_v1','synthetic_mixed_main_artifacts_v1','synthetic_mixed_main_contexts_v1','synthetic_mixed_main_provenance_v1','synthetic_mixed_main_requests_v1']loop
 execute format('alter table app.%I enable row level security',tbl);execute format('alter table app.%I force row level security',tbl);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',tbl);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',tbl||'_immutable',tbl);
 end loop;
 foreach tbl in array array['tournament_roster_entries','event_participants','events','tournaments']loop
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.freeze_synthetic_mixed_main_source_v1()','mixed_main_freeze_'||tbl,tbl);end loop;
 foreach tbl in array array['roster_account_links','roster_entry_lifecycle_events','roster_scorecard_preference_events','synthetic_mixed_artifacts_v1','synthetic_mixed_attestations_v1','synthetic_mixed_provenance_v1','synthetic_mixed_main_artifacts_v1']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.freeze_synthetic_mixed_main_source_v1()','mixed_main_freeze_'||tbl,tbl);end loop;
 for routine in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and(p.proname like'%synthetic_mixed_finance%'or p.proname like'%synthetic_mixed_main%'or p.proname='synthetic_mixed_complete_source_v1')loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',routine.signature);end loop;
 for routine in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('record_synthetic_mixed_obligation_v1','record_synthetic_mixed_receipt_v1','record_synthetic_mixed_expense_v1','save_synthetic_mixed_q_membership_v1','save_synthetic_mixed_side_election_v1','review_synthetic_mixed_q_v1','review_synthetic_mixed_side_v1','close_synthetic_mixed_main_v1','qualify_synthetic_mixed_main_v1','record_synthetic_mixed_playoff_v1','crosscheck_synthetic_mixed_main_v1','draft_synthetic_mixed_main_v1','finalize_synthetic_mixed_main_v1')loop
 execute format('revoke all on function %s from public,anon,authenticated',routine.signature);execute format('grant execute on function %s to service_role',routine.signature);end loop;
end$$;
create index synthetic_mixed_main_provenance_scope_v1 on app.synthetic_mixed_main_provenance_v1(tournament_id,event_id,action);
create index synthetic_mixed_main_context_operation_v1 on app.synthetic_mixed_main_contexts_v1(actor_id,operation_id);
commit;

