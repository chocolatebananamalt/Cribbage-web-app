// Local deterministic source generation only. No database, shell or network.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const gamePath='database/proposals/native-mixed-simulation-game-evidence-v1.sql';
const qualificationPath='database/proposals/native-mixed-qualification-review-v1.sql';
const outputPath='database/proposals/native-mixed-game-reopen-v1.sql';
export const basePins={
 [gamePath]:'9d52eb527b16a0cbfca958727b2214b8ecb196244d29f5348b30fa38b27657d8',
 [qualificationPath]:'ee216fee4313839e99b0176aa5be78bdd3eb163d6540805f3a43d4a0939b7459',
};
const load=p=>{const b=fs.readFileSync(p);assert.equal(hash(b),basePins[p],`Reviewed source pin: ${p}`);return b.toString('utf8').replaceAll('\r\n','\n');};
const one=(s,old,replacement)=>{assert.equal(s.split(old).length-1,1,`One exact anchor required: ${old}`);return s.replace(old,()=>replacement);};
const fn=(s,name)=>{const re=new RegExp(`create function app\\.${name}\\([\\s\\S]*?end\\$\\$;`);const m=s.match(re);assert(m,`Missing ${name}`);return one(m[0],'create function','create or replace function');};
const table='app.native_mixed_game_evidence_v1';
const all='app.native_mixed_game_all_evidence_v1()';
const active='app.native_mixed_game_active_evidence_v1(sid,gid)';
const activeHash=(s,source,h)=>s.replaceAll(`app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',sid,gid,${source},${h}))`,`app.native_mixed_game_attempt_digest_v1(sid,gid,${source},${h},app.native_mixed_game_active_attempt_v1(sid,gid))`);
const locks=s=>s.replaceAll('lock table app.native_mixed_game_evidence_v1','lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1');
export function buildReopenSQL(){
 const game=load(gamePath),qualification=load(qualificationPath),parts=[];
 let s=fn(game,'native_mixed_game_entry_bound_with_start_v1');
 s=s.replaceAll(`from ${table}`,`from ${all}`).replaceAll('from app.native_mixed_game_artifacts_v1','from app.native_mixed_game_all_artifacts_v1()');
 s=one(s,'select*into r from app.operation_receipts where id=e.operation_receipt_id;',`if app.native_mixed_game_entry_attempt_v1(e.id)is not null and app.native_mixed_game_reopen_bound_v1(app.native_mixed_game_entry_attempt_v1(e.id))is distinct from true then return false;end if;
 select*into r from app.operation_receipts where id=e.operation_receipt_id;`);
 s=one(s,'and sequence<e.sequence;','and sequence<e.sequence and app.native_mixed_game_entry_attempt_v1(id)is not distinct from app.native_mixed_game_entry_attempt_v1(e.id);');
 s=one(s,'and x.sequence<e.sequence;','and x.sequence<e.sequence and app.native_mixed_game_entry_attempt_v1(x.id)is not distinct from app.native_mixed_game_entry_attempt_v1(e.id);');
 s=s.replaceAll("app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',e.start_id,e.game_id,s.source_digest,h))","app.native_mixed_game_attempt_digest_v1(e.start_id,e.game_id,s.source_digest,h,app.native_mixed_game_entry_attempt_v1(e.id))");parts.push(s);
 s=fn(game,'native_mixed_game_entry_bound_v1').replaceAll(`join ${table}`,`join ${all}`);parts.push(s);
 s=fn(game,'native_mixed_game_complete_with_start_v1').replaceAll(`from ${table}`,`from ${active}`);parts.push(s);
 s=fn(game,'native_mixed_game_closed_receipt_v1').replaceAll(`from ${table}`,`from ${all}`);parts.push(s);
 s=fn(game,'append_native_mixed_simulation_game_evidence_v1');
 s=one(s,`from ${table} where operation_receipt_id=old.id`,`from ${all} where operation_receipt_id=old.id`);
 s=s.replaceAll(`from ${table}`,`from ${active}`);s=locks(s);s=activeHash(s,'start_digest','history');
 s=one(s,"if action_value='paper-capture'then\n  insert into app.native_mixed_game_artifacts_v1",`if action_value='paper-capture'then
  if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-artifact:'||(payload->>'artifactId'),0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
  if exists(select 1 from app.native_mixed_game_all_artifacts_v1()where id=(payload->>'artifactId')::uuid)then raise exception 'Artifact identity collision';end if;
  if app.native_mixed_game_active_attempt_v1(sid,gid)is not null then
   insert into app.native_mixed_game_attempt_artifacts_v1(attempt_id,id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256)
   values(app.native_mixed_game_active_attempt_v1(sid,gid),(payload->>'artifactId')::uuid,tid,eid,sid,gid,actor,receipt_id,artifact,artifact_digest);
  else
  insert into app.native_mixed_game_artifacts_v1`);
 s=one(s,'artifact,artifact_digest);end if;','artifact,artifact_digest);end if;end if;');
 s=one(s,'insert into app.native_mixed_game_evidence_v1 select(e).*;',`if app.native_mixed_game_active_attempt_v1(sid,gid)is null then
  insert into app.native_mixed_game_evidence_v1 select(e).*;
 else insert into app.native_mixed_game_attempt_evidence_v1 select app.native_mixed_game_active_attempt_v1(sid,gid),(e).*;end if;`);
 // A capture identity conflict is checked before receipt insertion too. The
 // post-insert check above is an invariant and raises/rolls back, never commits a
 // partial receipt on a conflict.
 s=one(s,"artifact_digest:=app.native_mixed_simulation_hash_v1(artifact);",`if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-artifact:'||(payload->>'artifactId'),0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
   if exists(select 1 from app.native_mixed_game_all_artifacts_v1()where id=(payload->>'artifactId')::uuid)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
   artifact_digest:=app.native_mixed_simulation_hash_v1(artifact);`);parts.push(s);
 s=fn(game,'get_native_mixed_simulation_game_operation_v1').replaceAll(`from ${table}`,`from ${all}`);
 s=one(s,'r app.operation_receipts%rowtype;begin','r app.operation_receipts%rowtype;active_id uuid;active_version integer;old_version integer;state_value jsonb;begin');
 s=one(s,"return r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);",`active_id:=app.native_mixed_game_active_attempt_v1(e.start_id,e.game_id);
 if active_id is not null and active_id is distinct from app.native_mixed_game_entry_attempt_v1(e.id)
  and auth.jwt()->>'sub'=actor::text
  and(case when coalesce(auth.jwt()->>'exp','')~'^[0-9]{1,12}$'then(auth.jwt()->>'exp')::bigint>extract(epoch from clock_timestamp())else false end)then
  select version into active_version from app.native_mixed_game_reopens_v1 where id=active_id;
  select coalesce((select version from app.native_mixed_game_reopens_v1 where id=app.native_mixed_game_entry_attempt_v1(e.id)),0)into old_version;
  if old_version<active_version and app.native_mixed_game_reopen_bound_v1(active_id)is true then
   state_value:=app.get_native_mixed_simulation_game_state_v1(tid,eid,e.start_id,e.game_id);
   if state_value->>'kind'='native-mixed-simulation-game-state-v1'and state_value->'currentSourceVerified'='true'::jsonb
    and state_value->>'actorId'=actor::text and state_value->>'tournamentId'=tid::text and state_value->>'eventId'=eid::text
    and state_value->>'startId'=e.start_id::text and state_value->>'gameId'=e.game_id::text
    and state_value->>'historyDigest'is distinct from r.response_payload->>'historyDigest'
    and not exists(select 1 from jsonb_array_elements(state_value->'entries')x where x->>'id'=e.id::text)then
    return jsonb_build_object('kind','native-mixed-game-superseded-v1','status','superseded','actorId',actor,'tournamentId',tid,'eventId',eid,
     'operationId',e.operation_id,'request',request,'receipt',r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false),
     'proposalId',active_id,'currentState',state_value,'currentSourceVerified',true,'simulationOnly',true,
     'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
   end if;
  end if;
 end if;
 return r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);`);parts.push(s);
 s=fn(game,'get_native_mixed_simulation_game_state_v1').replaceAll(`from ${table}`,`from ${active}`);s=locks(s);s=activeHash(s,"root->>'startSourceDigest'",'h');parts.push(s);
 s=fn(game,'resolve_native_mixed_game_operation_v1');
 s=one(s,`from ${table} where actor_id=actor and operation_id=op`,`from ${all} where actor_id=actor and operation_id=op`);
 s=s.replaceAll(`from ${table}`,`from ${active}`);s=locks(s);s=activeHash(s,"root->>'startSourceDigest'",'history');parts.push(s);
 s=fn(qualification,'native_mixed_qualification_review_v1');
 s=locks(s);
 s=one(s,`join ${table} e`,`join lateral app.native_mixed_game_active_evidence_v1(sid,(g->>'gameId')::uuid)e`);
 s=one(s,"from app.native_mixed_game_evidence_v1 where start_id=sid group by game_id",`from jsonb_array_elements(game_values)gv cross join lateral app.native_mixed_game_active_evidence_v1(sid,(gv->>'gameId')::uuid)e where e.start_id=sid group by game_id`);
 s=one(s,'app.native_mixed_simulation_hash_v1(jsonb_agg(entry order by sequence))digest',`case when app.native_mixed_game_active_attempt_v1(sid,game_id)is null then app.native_mixed_simulation_hash_v1(jsonb_agg(entry order by sequence))else app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-attempt-qualification-head-v1',app.native_mixed_game_active_attempt_v1(sid,game_id),jsonb_agg(entry order by sequence)))end digest`);parts.push(s);
 let playoff=one(s,'app.native_mixed_qualification_review_v1(','app.native_mixed_playoff_review_v1(');
 playoff=one(playoff," perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor\n  and role in('director','co_director')for share nowait;",` perform 1 from app.tournament_roles role_row join app.native_mixed_simulation_starts_v1 start_row
  on start_row.id=sid and start_row.tournament_id=tid and start_row.event_id=eid
  where role_row.tournament_id=tid and role_row.profile_id=start_row.actor_id and role_row.role='director'
  for share of role_row,start_row nowait;`);parts.push(playoff);
 const marker='-- BEGIN DERIVED FUNCTIONS: generated by tests/helpers/build-native-mixed-game-reopen-v1.mjs.';
 const prefix=fs.readFileSync(outputPath,'utf8').replaceAll('\r\n','\n').split(marker)[0]+marker+'\n';
 const pinnedPrefix=prefix.replace(/set search_path=''(?!set timezone='UTC')/g,"set search_path=''set timezone='UTC'");
 const body=pinnedPrefix+parts.join('\n\n')+'\n';
 const declarations=[...body.matchAll(/create (?:or replace )?function ((?:app|public)\.[a-z0-9_]+)\(([^)]*)\)/g)].map(m=>({name:m[1],args:m[2].split(',').filter(Boolean).map(x=>x.trim().split(/\s+/).slice(1).join(' ')).join(',')}));
 // Only explicitly declared functions; no catalog-wide mutation or grant.
 return body+'\n'+declarations.map(f=>`alter function ${f.name}(${f.args})owner to postgres;\nrevoke all on function ${f.name}(${f.args})from public,anon,authenticated,service_role;`).join('\n')+'\ncommit;\n';
}
// Fixture-only exact rollback of the ten replacements. Never applied to hosted
// data: the owned reset runner first proves every new correction table empty.
export function buildBaseRestoreSQL(){
 const game=load(gamePath),qualification=load(qualificationPath);
 const names=['native_mixed_game_entry_bound_with_start_v1','native_mixed_game_entry_bound_v1','native_mixed_game_complete_with_start_v1','native_mixed_game_closed_receipt_v1','append_native_mixed_simulation_game_evidence_v1','get_native_mixed_simulation_game_operation_v1','get_native_mixed_simulation_game_state_v1','resolve_native_mixed_game_operation_v1'];
 const parts=names.map(n=>fn(game,n));const q=fn(qualification,'native_mixed_qualification_review_v1');parts.push(q);
 let playoff=one(q,'app.native_mixed_qualification_review_v1(','app.native_mixed_playoff_review_v1(');
 playoff=one(playoff," perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor\n  and role in('director','co_director')for share nowait;",` perform 1 from app.tournament_roles role_row join app.native_mixed_simulation_starts_v1 start_row
  on start_row.id=sid and start_row.tournament_id=tid and start_row.event_id=eid
  where role_row.tournament_id=tid and role_row.profile_id=start_row.actor_id and role_row.role='director'
  for share of role_row,start_row nowait;`);parts.push(playoff);return parts.join('\n\n');
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-native-mixed-game-reopen-v1.mjs')){
 const next=buildReopenSQL();
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(outputPath,'utf8').replaceAll('\r\n','\n'),next,'Generated source drift');
 else fs.writeFileSync(outputPath,next);
 console.log(JSON.stringify({file:outputPath,sha256:hash(Buffer.from(next)),bytes:Buffer.byteLength(next)}));
}
