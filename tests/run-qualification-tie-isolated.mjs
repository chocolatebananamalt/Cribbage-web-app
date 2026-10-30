// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
import assert from 'node:assert/strict';import {foundation,actor,tid,eid,uuid}from'./fixtures/q-review-foundation.mjs';
import {isQualificationTieWorkspace,isQualificationTieOutcome,qualificationTieOutcomeMatches}from'../src/lib/api/qualification-ties.ts';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-qualification-local',db='fixture_qualification';
function docker(args,input){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(docker(['inspect',name]))[0];
if(meta.Id!==process.argv[4]||meta.State.Status!=='running'||meta.Config.Labels['codex.fixture']!==name||meta.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||meta.HostConfig.NetworkMode!=='none'||Object.keys(meta.HostConfig.PortBindings??{}).length||meta.HostConfig.Binds?.length||meta.Mounts.length||meta.HostConfig.Privileged)throw Error('Disposable isolation mismatch');
const sql=(q,d='postgres')=>docker(['exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',d,'-v','ON_ERROR_STOP=1'],q);
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Baseline mismatch');
if(sql(`select count(*)from pg_database where datname='${db}'`).trim()!=='0')throw Error('Existing database; inspect before reset');
const toc=docker(['exec','-i',name,'pg_restore','--list'],baseline);
const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
for(const owner of [...new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])]){if(!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner))throw Error('Invalid role');sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
docker(['exec',name,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);
try{
 docker(['exec','-i',name,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 for(let n=237;n<=246;n++){const f=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!f)throw Error('Missing migration '+n);sql('set role postgres;\n'+fs.readFileSync('database/migrations/'+f,'utf8'),db);}
 const oldActor=actor.replaceAll('1310000','1910000'),oldTid=tid.replaceAll('1310000','1910000'),oldEid=eid.replaceAll('1310000','1910000');
 const historical=foundation().replaceAll('1310000','1910000').replaceAll('2430000','2930000').replaceAll('2450000','2950000').replaceAll('@test.invalid','-pre0247@test.invalid');
 sql(historical,db);
 const oldSnapshotQuery=`select jsonb_build_object('result',public.get_standard_singles_qualification_result_v1('${oldActor}','${oldTid}','${oldEid}'),'versions',(select jsonb_agg(to_jsonb(x)order by id)from app.qualification_result_versions x where tournament_id='${oldTid}'),'rows',(select jsonb_agg(to_jsonb(x)order by ranking_ordinal)from app.qualification_result_rows x where tournament_id='${oldTid}'),'qSources',app.q_obligation_sources_v1('${oldActor}','${oldTid}'));`;
 const oldBefore=sql(oldSnapshotQuery,db);
 sql('set role postgres;\n'+fs.readFileSync('database/migrations/0247_qualification_tie_resolution_v1.sql','utf8'),db);
 const oldAfter=sql(oldSnapshotQuery,db);assert.equal(oldAfter,oldBefore,'pre0247 finalized snapshot/Q source changed');
 fs.writeFileSync('test-results/qualification-tie-legacy-preservation.json',JSON.stringify({status:'passed',tournamentId:oldTid,beforeSha256:crypto.createHash('sha256').update(oldBefore).digest('hex'),afterSha256:crypto.createHash('sha256').update(oldAfter).digest('hex')},null,2));
 console.log('PASS exact pre0247 finalized result/history and full Q source unchanged after migration');
 const r=spawnSync(process.execPath,['--experimental-strip-types','tests/qualification-tie-sql-acceptance.mjs'],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);console.log(r.stdout);
 // Read actual persisted backend JSON through the same strict TypeScript boundary
 // used by the app. This does not substitute for browser/API end-to-end testing.
 const bridge=JSON.parse(sql(`select jsonb_build_object('workspace',public.get_qualification_tie_workspace_v1('${actor}','${tid}','${eid}'),'receipts',(select jsonb_agg(jsonb_build_object('eventId',target_id,'outcome',outcome,'response',response_payload)order by created_at,id)from app.operation_receipts where operation_type='save_qualification_tie_resolution_v1'));`,db));
 assert.ok(isQualificationTieWorkspace(bridge.workspace,tid,eid),'real SQL workspace violates app contract');
 assert.equal(bridge.workspace.finalized,true,'backend fixture did not persist finalization');
 assert.equal(bridge.workspace.groups.length,1,'expected exact persisted two-player tie');
 assert.ok(Array.isArray(bridge.receipts)&&bridge.receipts.length>=4,'missing real accepted/rejected receipt evidence');
 for(const receipt of bridge.receipts)assert.ok(isQualificationTieOutcome(receipt.response,receipt.eventId),'real SQL operation response violates app contract');
 const accepted=bridge.receipts.filter(x=>x.outcome==='accepted'),rejected=bridge.receipts.filter(x=>x.outcome==='rejected');
 assert.ok(accepted.length>=3&&rejected.length>=1,'both accepted and rejected database outcomes are required');
 const knownRequest={expectedSourceFingerprint:bridge.workspace.sourceFingerprint,participantIds:[uuid('f243',1),uuid('f243',2)],winnerId:uuid('f243',2),method:'one_game_playoff',reason:'TEST ONLY independent synthetic playoff winner',evidenceReference:'TEST ONLY no actual match'};
 const saved=accepted.find(x=>x.eventId===eid);
 assert.ok(saved&&qualificationTieOutcomeMatches(saved.response,knownRequest),'persisted main-fixture receipt does not match exact intended decision');
 fs.writeFileSync('test-results/qualification-tie-api-contract.json',JSON.stringify({status:'passed',workspaceFingerprint:bridge.workspace.sourceFingerprint,acceptedResponses:accepted.length,rejectedResponses:rejected.length,exactRequestMatched:true},null,2));
 console.log('PASS actual persisted SQL workspace and accepted/rejected outcomes satisfy strict app contracts and exact request binding');
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable qualification database removed');}
