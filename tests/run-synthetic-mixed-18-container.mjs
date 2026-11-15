// Bounded LOCAL protocol proof. No network, ports, mounts or hosted operations.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync,spawn}from'node:child_process';
import {eighteenFixture}from'./eighteen-qualifying-local-acceptance.mjs';
import {verifySyntheticMixedEighteen}from'./synthetic-mixed-18-acceptance.mjs';
const name='cribbage-synthetic-mixed-18-local',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
function docker(args,input,allowed=false){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0&&!allowed)throw Error(String(r.stderr||r.stdout));return r;}
assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'','Existing task container: inspect before reuse');
let cid;
try{
 const startup="initdb -D /tmp/mixed-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/mixed-init.log 2>&1 && exec postgres -D /tmp/mixed-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
 cid=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',startup]).stdout.trim();assert.match(cid,/^[a-f0-9]{64}$/);
 const inspect=()=>{const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Image,image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);return m;};inspect();
 let ready=false;for(let n=0;n<60;n++){if(docker(['exec',cid,'pg_isready','-h','/tmp','-U','supabase_admin'],undefined,true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 const db='fixture_mixed_18_protocol',raw=q=>docker(['exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],q).stdout;
 const admin=q=>docker(['exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],q).stdout;
 const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'),'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc');
 const toc=String(docker(['exec','-i',cid,'pg_restore','--list'],baseline).stdout);const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
 for(const owner of new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])){assert.match(owner,/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/);admin(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
 docker(['exec',cid,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);docker(['exec','-i',cid,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 const apply=n=>{const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));assert.ok(file);raw('set role postgres;'+fs.readFileSync('database/migrations/'+file,'utf8'));};
 for(let n=237;n<=266;n++)apply(n);
 const f=eighteenFixture(),digital=[1,2,3,5,7,9],keep=new Set(digital.map(n=>f.rid(n)));
 f.setupSql=f.setupSql.replace("'Synthetic Qualification'","'TEST ONLY Mixed Protocol'").replace(`'digital','${f.actor}'`,`case when n in(${digital})then'digital'else'paper'end,'${f.actor}'`);
 const profileExpr=`('${f.uid(1).slice(0,24)}'||lpad(n::text,12,'0'))::uuid`;
 assert.ok(f.setupSql.includes(profileExpr));f.setupSql=f.setupSql.replace(profileExpr,`case when n in(${digital})then ${profileExpr} else null end`);
 f.setupSql=f.setupSql.replace(/insert into app\.roster_account_links[\s\S]*?;/g,s=>[...keep].some(id=>s.includes(id))?s:'');
 const q=(query,actor=f.actor,role='service_role')=>raw(`set role ${role==='authenticated'?'authenticated':'postgres'};set request.jwt.claim.role='${role}';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"${role}","sub":"${actor}"}';`+query).trim();
 q(f.setupSql);
 for(let n=267;n<=292;n++)apply(n);
 for(const phase of['financeSql','seatingAttendanceSql','publishSql','startSql'])q(f[phase]);
 const proposal=fs.readFileSync('database/proposals/synthetic-mixed-evidence-v1.sql','utf8');assert.equal(crypto.createHash('sha256').update(proposal).digest('hex'),'f8248a1afb60e62a563fcd0369e085c115333b6f1631a4c1d7ea774202f112a3');q(proposal);const additive=fs.readFileSync('database/proposals/synthetic-mixed-evidence-v2.sql','utf8');q(additive);console.log('PASS frozen v1 and additive v2 proposals apply on isolated current schema');
 const read=(query,actor=f.actor,role='service_role')=>{const line=q(query,actor,role).split('\n').filter(Boolean).at(-1);return line==='t'?true:line==='f'?false:line===undefined?null:JSON.parse(line);};
 const startSession=(query,actor=f.actor,role='service_role',tag='mixed18-race')=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role ${role==='authenticated'?'authenticated':'postgres'};set request.jwt.claim.role='${role}';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"${role}","sub":"${actor}"}';set application_name='${tag}';`+query);return{done,out:()=>out};};
 const proof=await verifySyntheticMixedEighteen({q,read,startSession,fixture:f});
 const result={...proof,frozenV1Sha256:crypto.createHash('sha256').update(proposal).digest('hex'),proposalV2Sha256:crypto.createHash('sha256').update(additive).digest('hex'),containerId:cid,scope:'18-player full mixed qualifying scoring; actual authenticated DB roles; normal current publication/start; not human browser acceptance, qualification or financial finalization'};
 fs.writeFileSync('test-results/synthetic-mixed-18-protocol.json',JSON.stringify(result,null,2));console.log('PASS',JSON.stringify(result));inspect();
}finally{if(cid){const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);docker(['rm','-f',cid]);assert.equal(docker(['ps','-aq','--filter',`id=${cid}`]).stdout.trim(),'');console.log('CLEANUP exact task container removed; absence verified');}}
