// Bounded LOCAL protocol proof. No network, ports, mounts or hosted operations.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync,spawn}from'node:child_process';
import {eighteenFixture}from'../eighteen-qualifying-local-acceptance.mjs';
const name='cribbage-random-seating-local',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
function docker(args,input,allowed=false){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0&&!allowed)throw Error(String(r.stderr||r.stdout));return r;}
export async function withRandomSeatingFixture(run){
assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'','Existing task container: inspect before reuse');
let cid;
try{
 const startup="initdb -D /tmp/mixed-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/mixed-init.log 2>&1 && exec postgres -D /tmp/mixed-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
 cid=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',startup]).stdout.trim();assert.match(cid,/^[a-f0-9]{64}$/);
 const inspect=()=>{const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Image,image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);return m;};inspect();
 let ready=false;for(let n=0;n<60;n++){if(docker(['exec',cid,'pg_isready','-h','/tmp','-U','supabase_admin'],undefined,true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 const db='fixture_random_seating',raw=q=>docker(['exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],q).stdout;
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
 f.setupSql=f.setupSql.replace(/insert into app\.event_participants[\s\S]*?;/g,'').replace(/do \$fixture\$declare r jsonb;begin r:=public\.save_setup_prize_schedule_v1[\s\S]*?end\$fixture\$;/g,'');
 q(f.setupSql);
 for(let n=267;n<=292;n++)apply(n);
 q(fs.readFileSync('database/proposals/random-seating-draw-v1.sql','utf8'));
 const read=(query,actor=f.actor,role='service_role')=>{const line=q(query,actor,role).split('\n').filter(Boolean).at(-1);return line==='t'?true:line==='f'?false:line===undefined?null:JSON.parse(line);};
 const startSession=(query,tag,role='service_role')=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role ${role};set request.jwt.claim.role='service_role';set application_name='${tag}';`+query);return{done,out:()=>out};};
 for(let n=1;n<=18;n++){const r=read(`select public.record_roster_check_in_event_v2('${f.tid}','${f.rid(n)}','checked_in','LOCAL disposable draw proof','a2990000-0000-4000-8000-${String(n).padStart(12,'0')}');`);assert.equal(r.status,'check_in_recorded');}
 q(`update app.tournaments set registration_status='closed'where id='${f.tid}';`);
 const result=await run({fixture:f,q,read,startSession,containerId:cid});inspect();return result;
}finally{if(cid){const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);docker(['rm','-f',cid]);assert.equal(docker(['ps','-aq','--filter',`id=${cid}`]).stdout.trim(),'');console.log('CLEANUP exact task container removed; absence verified');}}
}
