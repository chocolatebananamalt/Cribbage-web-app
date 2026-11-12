import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-linked-order-fresh',db='fixture_linked_order_fresh';
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
 for(let n=237;n<=289;n++){
 const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);sql('set role postgres;'+fs.readFileSync('database/migrations/'+file,'utf8'),db);
 }
 console.log('PASS restored empty baseline and applied0237-0289 locally');
 const legacyActor='a2900000-0000-4000-8000-000000000010',legacyTid='b2900000-0000-4000-8000-000000000010',legacyOp='d2900000-0000-4000-8000-000000000010';
 const {qSetupPrizeWorkspace:legacyWorkspaceFactory}=await import('./fixtures/q-setup-prize-workspace.mjs');
 const legacyPayload=structuredClone(legacyWorkspaceFactory(legacyActor).current);for(const k of ['revisionId','version','createdAt'])delete legacyPayload[k];
 legacyPayload.events=legacyPayload.events.map(({sourceStatus,sidePools,...e})=>({...e,gameCount:12,entryFeeCents:0,freeEntry:true}));
 const legacyLiteral=`'${JSON.stringify(legacyPayload).replaceAll("'","''")}'::jsonb`;
 sql(`set role postgres;insert into auth.users(id,email)values('${legacyActor}','legacy-director@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${legacyTid}','${legacyActor}','TEST ONLY historic replay','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${legacyTid}','${legacyActor}','director');`,db);
 const legacyCall=`set role authenticated;set request.jwt.claim.sub='${legacyActor}';set request.jwt.claim.role='authenticated';select public.save_tournament_setup_version('${legacyTid}',0,${legacyLiteral},'${legacyOp}');`;
 const legacyBefore=sql(legacyCall,db).trim();if(JSON.parse(legacyBefore).status!=='setup_draft_saved')throw Error('Legacy seed failed');
 const legacyDigestSql=`select md5(coalesce(jsonb_agg(to_jsonb(r)order by version)::text,''))from app.tournament_setup_revisions r where tournament_id='${legacyTid}'and version=1;`;
 const legacyDigest=sql('set role postgres;'+legacyDigestSql,db).trim();
 sql('set role postgres;'+fs.readFileSync('database/proposals/setup-event-links-v1.sql','utf8'),db);
 sql('set role postgres;'+fs.readFileSync('database/proposals/setup-event-links-activation-v1.sql','utf8'),db);
 sql('set role postgres;'+fs.readFileSync('database/proposals/linked-main-playoff-evidence-v1.sql','utf8'),db);
 sql('set role postgres;'+fs.readFileSync('tests/linked-main-playoff-evidence-v1.sql','utf8'),db);
 if(sql(legacyCall,db).trim()!==legacyBefore||sql('set role postgres;'+legacyDigestSql,db).trim()!==legacyDigest)throw Error('Historical replay or source row changed');
 console.log('PASS pre-migration legacy accepted save replay byte-identical; historical revision digest unchanged');
 const promotedPayload=structuredClone(legacyPayload);for(const event of promotedPayload.events)event.sidePools=[];
 const promoteEnvelope={kind:'setup-event-links-v1',request:{expectedVersion:1,payload:promotedPayload,idempotencyKey:'d2900000-0000-4000-8000-000000000011'},choices:[{mainClientRowId:promotedPayload.events[0].clientRowId,consolationClientRowIds:[]}]};
 const promoteLiteral=`'${JSON.stringify(promoteEnvelope).replaceAll("'","''")}'::jsonb`;
 const promoted=JSON.parse(sql(`set role authenticated;set request.jwt.claim.sub='${legacyActor}';set request.jwt.claim.role='authenticated';select public.save_linked_tournament_setup_v1('${legacyTid}',${promoteLiteral});`,db).trim());if(promoted.status!=='linked_setup_saved')throw Error('Legacy draft promotion failed '+JSON.stringify(promoted));
 if(sql(legacyCall,db).trim()!==legacyBefore||sql('set role postgres;'+legacyDigestSql,db).trim()!==legacyDigest)throw Error('Historical request or source changed after linked promotion');
 console.log('PASS existing legacy draft promotes explicitly; original accepted operation and revision remain unchanged');
 console.log('PASS linked setup save/activation and playoff candidates applied');
 const actor='a2900000-0000-4000-8000-000000000001',tid='b2900000-0000-4000-8000-000000000001';
 const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
 const q=(query,who=actor,role='authenticated')=>sql(`set role ${role};set request.jwt.claim.sub='${who}';set request.jwt.claim.role='${role}';set request.jwt.claims='{"role":"${role}","sub":"${who}"}';`+query,db).trim();
 const read=(query,who=actor,role='authenticated')=>{const raw=q(query,who,role).split('\n').filter(Boolean).at(-1);return raw===undefined?null:JSON.parse(raw)};
 sql(`set role postgres;insert into auth.users(id,email)values('${actor}','director@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY links','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`,db);
 const {qSetupPrizeWorkspace}=await import('./fixtures/q-setup-prize-workspace.mjs');const ws=qSetupPrizeWorkspace(actor);const {revisionId,version,createdAt,...base}=ws.current;
 base.events=Array.from({length:4},(_,i)=>({...structuredClone(base.events[0]),clientRowId:`c2900000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,eventKind:i%2===0?'main':'consolation',displayName:`TEST ONLY ${i%2===0?'Main':'Consolation'} ${Math.floor(i/2)+1}`,gameCount:i%2===0?12:8,sourceStatus:undefined,entryFeeCents:0,freeEntry:true}));
 for(const e of base.events)delete e.sourceStatus;
 base.events[0].sidePools=[{poolTypeCode:'TEST ONLY Side',entryFeeCents:1000,note:'',payoutType:'graduated-1-in-4'}];
 const team={...structuredClone(base.events[0]),clientRowId:'c2900000-0000-4000-8000-000000000005',eventKind:'satellite',displayName:'TEST ONLY Doubles',styleCode:'Doubles',formatCode:'doubles',gameCount:6,sidePools:[]};
 base.events.push(team);
 const choices=[{mainClientRowId:base.events[0].clientRowId,consolationClientRowIds:[base.events[1].clientRowId]},{mainClientRowId:base.events[2].clientRowId,consolationClientRowIds:[base.events[3].clientRowId]}];
 base.events=[base.events[2],base.events[3],base.events[0],base.events[1],base.events[4]]; // canonical grouping retains explicit parents
 const envelope={kind:'setup-event-links-v1',request:{expectedVersion:0,payload:base,idempotencyKey:'d2900000-0000-4000-8000-000000000001'},choices};
 const saved=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(envelope)});`);if(saved?.status!=='linked_setup_saved')throw Error('Linked save '+JSON.stringify(saved));
 const {isLinkedSetupSaveResult}=await import('../src/lib/api/setup-event-links.ts');if(!isLinkedSetupSaveResult(saved,envelope))throw Error('Linked SQL response failed codec '+JSON.stringify(saved));
 const replay=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(envelope)});`);if(JSON.stringify(replay)!==JSON.stringify(saved))throw Error('Replay changed response');
 const reconciled=read(`select public.reconcile_linked_setup_save_v1('${tid}',${literal(envelope)});`);if(JSON.stringify(reconciled)!==JSON.stringify(saved))throw Error('Exact read-only reconciliation failed');
 const graphMismatch=structuredClone(envelope);graphMismatch.choices[0].consolationClientRowIds=[];
 if(read(`select public.reconcile_linked_setup_save_v1('${tid}',${literal(graphMismatch)});`)!==null)throw Error('Graph mismatch reconciled');
 const head=read(`select public.get_setup_event_links_v1('${tid}');`);if(head?.current?.complete!==true)throw Error('Incomplete graph');
 const modified=structuredClone(envelope);modified.choices[0].consolationClientRowIds=[];const conflict=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(modified)});`);if(conflict?.code!=='idempotency_conflict')throw Error('Changed graph reused operation');
 const counts=read(`select jsonb_build_object('revisions',(select count(*)from app.tournament_setup_revisions where tournament_id='${tid}'),'events',(select count(*)from app.tournament_setup_event_versions where tournament_id='${tid}'),'edges',(select count(*)from app.setup_event_link_edges_v1 where tournament_id='${tid}'));`,actor,'postgres');
 if(counts.revisions!==1||counts.events!==5||counts.edges!==2)throw Error('Counts '+JSON.stringify(counts));
 console.log('PASS twoMain/twoConsolation atomic save, exact replay, changed graph rejection, SQL→codec');
 const oldAttempt=read(`select public.activate_tournament_setup_v2('${actor}','${tid}','${saved.result.revisionId}',1,'d2900000-0000-4000-8000-000000000002');`,actor,'service_role');if(oldAttempt?.code!=='association_pin_required')throw Error('Old activation bypass '+JSON.stringify(oldAttempt));
 const activationRequest={setupRevisionId:saved.result.revisionId,expectedVersion:1,confirmed:true,idempotencyKey:'d2900000-0000-4000-8000-000000000003'};
 const activationEnvelope={request:activationRequest,associationHash:saved.links.associationHash};
 // Fail after core activation, pool materialization and team promotion; all must roll back.
 sql(`set role postgres;create function app.fixture_reject_link_binding()returns trigger language plpgsql as $$begin raise exception 'linked_activation_rejected:fixture_failure';end$$;create trigger fixture_reject_binding before insert on app.consolation_main_event_bindings_v1 for each row execute function app.fixture_reject_link_binding();`,db);
 const failed=read(`select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${literal(activationEnvelope)});`,actor,'service_role');if(failed?.code!=='fixture_failure')throw Error('Injected failure not returned');
 const rolled=read(`select jsonb_build_object('activations',(select count(*)from app.tournament_setup_activations where tournament_id='${tid}'),'events',(select count(*)from app.events where tournament_id='${tid}'),'links',(select count(*)from app.setup_event_link_activation_versions_v1 where tournament_id='${tid}'),'registration',(select registration_status from app.tournaments where id='${tid}'));`,actor,'postgres');
 if(rolled.activations||rolled.events||rolled.links||rolled.registration!=='closed')throw Error('Partial activation survived '+JSON.stringify(rolled));
 sql(`set role postgres;drop trigger fixture_reject_binding on app.consolation_main_event_bindings_v1;drop function app.fixture_reject_link_binding();`,db);
 activationRequest.idempotencyKey='d2900000-0000-4000-8000-000000000004';
 console.log('PASS injected late activation failure rolls back core events, promotion, links and registration');
 const activated=read(`select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${literal(activationEnvelope)});`,actor,'service_role');if(activated?.status!=='linked_setup_activated')throw Error('Linked activation '+JSON.stringify(activated));
 const {isLinkedSetupActivationResult}=await import('../src/lib/api/setup-event-links.ts');if(!isLinkedSetupActivationResult(activated,activationRequest,saved.links.associationHash))throw Error('Activation SQL response failed codec');
 const activatedReplay=read(`select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${literal(activationEnvelope)});`,actor,'service_role');if(JSON.stringify(activatedReplay)!==JSON.stringify(activated))throw Error('Activation replay changed');
 const bindings=read(`select jsonb_agg(jsonb_build_object('child',c.name,'main',m.name)order by c.name)from app.consolation_main_event_bindings_v1 b join app.events c on c.id=b.consolation_event_id join app.events m on m.id=b.main_event_id where b.tournament_id='${tid}';`,actor,'postgres');
 if(bindings.length!==2||bindings[0].main!=='TEST ONLY Main 1'||bindings[1].main!=='TEST ONLY Main 2')throw Error('Wrong parent bindings '+JSON.stringify(bindings));
 const lateSave=structuredClone(envelope);lateSave.request.expectedVersion=1;lateSave.request.idempotencyKey='d2900000-0000-4000-8000-000000000005';
 const late=read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(lateSave)});`);if(late?.code!=='setup_lifecycle_closed')throw Error('Post-activation edit accepted '+JSON.stringify(late));
 if(JSON.stringify(read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(envelope)});`))!==JSON.stringify(saved))throw Error('Historical exact save replay failed after activation');
 const teamEvent=activated.result.events.find(e=>e.format==='doubles');if(!teamEvent||teamEvent.scoringMethod!=='digital')throw Error('Team not promoted');
 console.log('PASS typed Side materialization and Doubles promotion atomic; lifecycle closed, historical save replay retained');
 console.log('PASS canonical activation explicit parents, old activation blocked, exact activation replay, SQL→codec');
 const raceTid='b2900000-0000-4000-8000-000000000002';
 sql(`set role postgres;insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${raceTid}','${actor}','TEST ONLY links race','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${raceTid}','${actor}','director');`,db);
 const session=(query,label)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.write(`set application_name='${label}';set statement_timeout='15s';`+query+'\n');return{child,done,out:()=>out};};
 const wait=async(f,label)=>{const end=Date.now()+10000;while(Date.now()<end){if(f())return;await new Promise(r=>setTimeout(r,50));}throw Error('Race barrier '+label);};
 const gate=session(`begin;select id from app.tournaments where id='${raceTid}'for update;select 'HELD';`,'linked_save_gate');await wait(()=>gate.out().includes('HELD'),'held');
 const raceA=structuredClone(envelope),raceB=structuredClone(envelope);raceA.request.idempotencyKey='d2900000-0000-4000-8000-000000000006';raceB.request.idempotencyKey='d2900000-0000-4000-8000-000000000007';
 const call=e=>`set role authenticated;set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';select public.save_linked_tournament_setup_v1('${raceTid}',${literal(e)});`;
 const a=session(call(raceA),'linked_save_a'),b=session(call(raceB),'linked_save_b');a.child.stdin.end();b.child.stdin.end();
 try{await wait(()=>q("select count(*)from pg_stat_activity where application_name in('linked_save_a','linked_save_b')and wait_event_type='Lock';",actor,'postgres')==='2','both waiting');}finally{gate.child.stdin.end('rollback;');await gate.done;}
 const raced=(await Promise.all([a.done,b.done])).map(x=>JSON.parse(x.trim().split('\n').findLast(y=>y.startsWith('{'))));
 if(raced.filter(x=>x.status==='linked_setup_saved').length!==1||raced.filter(x=>x.status==='rejected').length!==1)throw Error('Concurrent saves '+JSON.stringify(raced));
 if(read(`select to_jsonb(count(*))from app.tournament_setup_revisions where tournament_id='${raceTid}';`,actor,'postgres')!==1)throw Error('Concurrent revision duplication');
 console.log('PASS held-lock two-session same-version save race: one accepted, one rejected, one revision');
 console.log('FIXTURE_RESULT_JSON '+JSON.stringify({stage:'linked_activation',counts,bindings,hash:saved.links.associationHash}));
}finally{sql('select 1');}




