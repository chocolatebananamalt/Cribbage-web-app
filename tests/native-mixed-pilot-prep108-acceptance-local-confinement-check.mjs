import{createNativeMixedPilotDirectorHandlersV1}from'../src/lib/api/native-mixed-pilot-director-handlers-v1.ts';
import{verifyCompatibility}from'./helpers/native-mixed-populated-compatibility-local.mjs';
import{spawnSync}from'node:child_process';
import{createNativeMixedPilotDirectorExecutorV1}from'../src/lib/api/native-mixed-pilot-director-executor-v1.ts';
import fs from'node:fs';import assert from'node:assert/strict';import{randomUUID,createHash}from'node:crypto';
import{dir,actor,checker,tid,sql,read,json,quote,claims,concurrentSQL}from'./helpers/native-mixed-pilot-prep108-acceptance-db.mjs';
const eid=JSON.parse(fs.readFileSync(dir+'/activation-result.json')).binding.eventId,cache=JSON.parse(fs.readFileSync(dir+'/scoring-results.json'));
const confinementBytes=fs.readFileSync('database/proposals/native-mixed-pilot-confinement-v1.sql');fs.writeFileSync(dir+'/confinement-source.json',JSON.stringify({file:'database/proposals/native-mixed-pilot-confinement-v1.sql',sha256:createHash('sha256').update(confinementBytes).digest('hex')},null,2));sql('set role postgres;'+confinementBytes.toString('utf8'));sql('set role postgres;'+fs.readFileSync('database/proposals/native-mixed-pilot-director-session-v1.sql','utf8'));
const session=cache.sessionIds[actor],ref='nnhcnvksxgxnpvdqjgpg',checks=[];
const svc=(who=actor,project=ref)=>`set request.jwt.claim.role='service_role';set request.jwt.claims=${quote(JSON.stringify({role:'service_role',sub:who,ref:project}))};set role service_role;`;
function permit(who=actor,t=tid,e=eid,writing=false,project=ref){return read(svc(who,project)+`select to_jsonb(app.native_mixed_pilot_permitted_v1('${who}','${t}','${e}',${writing}));`);}
function check(name,fn){fn();checks.push(name);console.log('PASS',name);}
sql('set role postgres;grant usage on schema app to service_role;grant execute on function app.native_mixed_pilot_permitted_v1(uuid,uuid,uuid,boolean)to service_role;grant execute on function public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)to service_role;');
check('unconfigured fails closed',()=>assert.equal(permit(),false));
sql(`set role postgres;select app.authorize_native_mixed_pilot_deployment_v1('${ref}','fictional local approval');`);
let version=0;function scope(actors,writes,expiry='clock_timestamp()+interval\'1 hour\''){const op=randomUUID();return read(`set role postgres;select app.record_native_mixed_pilot_scope_v1('${tid}','${eid}',array[${actors.map(quote).join(',')}]::uuid[],${version++},${writes},${expiry},'fictional local approval','${op}');`);}
const digital='a1310000-0000-4000-8000-000000000002';
scope([actor,checker,digital],true);
check('approved project/event/actor permits',()=>assert.equal(permit(),true));
check('stale-snapshot isolation fails closed',()=>assert.equal(read('begin isolation level repeatable read;'+svc()+`select to_jsonb(app.native_mixed_pilot_permitted_v1('${actor}','${tid}','${eid}',false));commit;`),false));
const holder=concurrentSQL('begin;'+svc()+`select jsonb_build_object('locked',app.native_mixed_pilot_permitted_v1('${actor}','${tid}','${eid}',false));select pg_sleep(2);commit;`);await holder.first;
check('independent scoped reads overlap safely',()=>assert.equal(permit(),true));await holder.done;

check('other project denied',()=>assert.equal(permit(actor,tid,eid,false,'fnjkwymxpnsqvxtpronk'),false));
check('other event denied',()=>assert.equal(permit(actor,tid,randomUUID()),false));
check('other actor denied',()=>assert.equal(permit('a1310000-0000-4000-8000-000000000003'),false));
function dispatch(who=actor,sid=session,action='source',project=ref){return read(svc(who,project)+`select public.execute_native_mixed_pilot_director_v1('${who}','${sid}','${tid}','${eid}',${quote(action)},'{}');`);}

const originals=['native_mixed_game_transport_enabled_v1','native_mixed_game_recovery_enabled_v1','native_mixed_simulation_start_recovery_enabled_v1','native_mixed_attendance_consent_transport_enabled_v1','native_mixed_simulation_start_enabled_v1','native_mixed_game_writer_enabled_v1','native_mixed_admission_enabled_v1','native_mixed_funding_enabled_v1','native_mixed_attendance_enabled_v1','native_mixed_simulation_publication_enabled_v1'].map(n=>read(`select to_jsonb(pg_get_functiondef('app.${n}()'::regprocedure));`));
sql('set role postgres;'+originals.map(d=>d.replace('SELECT false','SELECT true').replace('select false','select true')).join(';')+`;grant execute on function public.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid)to authenticated;`);
check('Director preparation reads existing draw',()=>assert.equal(dispatch()?.status,'source_available'));
const authenticated={auth:{getUser:async()=>({data:{user:{id:actor}},error:null}),getClaims:async()=>({data:{claims:{sub:actor,session_id:session,exp:4102444800}},error:null})},rpc:async()=>({data:'director',error:null})};
const admin={rpc:async(name,a)=>{assert.equal(name,'execute_native_mixed_pilot_director_v1');return{data:read(svc()+`select public.${name}('${a.p_actor_id}','${a.p_session_id}','${a.p_tournament_id}','${a.p_event_id}',${quote(a.p_action)},${json(a.p_request)});`),error:null};}};
const executor=createNativeMixedPilotDirectorExecutorV1({enabled:()=>true,authenticated,admin,projectRef:ref,projectUrl:`https://${ref}.supabase.co`,tournamentId:tid,eventId:eid});
const executed=await executor.readSource({actor,tid,eid});check('concrete server adapter reads exact Director SQL source',()=>{assert.equal(executed.error,null);assert.equal(executed.data?.status,'source_available');});
sql('set role postgres;grant execute on function public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)to authenticated;');
function lease(who=actor,action='source',exp=4102444800){const c={role:'authenticated',sub:who,session_id:cache.sessionIds[who],iss:`https://${ref}.supabase.co/auth/v1`,exp};return read(`set request.jwt.claim.sub='${who}';set request.jwt.claim.role='authenticated';set request.jwt.claims=${quote(JSON.stringify(c))};set role authenticated;select public.get_native_mixed_pilot_director_session_v1('${tid}','${eid}',${quote(action)});`);}
const issued=lease();check('own Director lease is current bounded and exact action',()=>{assert.equal(issued.actorId,actor);assert.deepEqual(issued.allowedActions,['source']);assert(Date.parse(issued.expiresAt)>Date.now());assert(Date.parse(issued.expiresAt)-Date.now()<=300000);});
check('lease rejects coDirector unsupported action and expired token',()=>{assert.equal(lease(checker),null);assert.equal(lease(actor,'create-account'),null);assert.equal(lease(actor,'source',1),null);});
const boundaryClient={...authenticated,rpc:async(name,a)=>{if(name==='get_native_mixed_pilot_director_session_v1')return{data:lease(actor,a.p_action),error:null};assert.equal(name,'get_tournament_role');return{data:read(claims(actor,'authenticated',session)+`select to_jsonb(public.get_tournament_role('${tid}'));`),error:null};}};
let adminConstructed=0;
const boundary=createNativeMixedPilotDirectorHandlersV1({enabled:()=>true,projectRef:ref,projectUrl:`https://${ref}.supabase.co`,authenticated:async()=>boundaryClient,privileged:async()=>{adminConstructed++;return admin;},readJson:async r=>r.json(),sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:async run=>run()});
const reply=await boundary.sourceGET(new Request('https://pilot.test/rehearsal',{headers:{'x-expected-actor-id':actor}}),{params:Promise.resolve({id:tid,eventId:eid})});
check('Director HTTP boundary lease provider executor SQL source integration',()=>{assert.equal(reply.status,200,JSON.stringify(reply));assert.equal(reply.body.status,'source_available');assert.equal(adminConstructed,1);});
const beforeReplays=read(`select jsonb_build_object('receipts',(select count(*)from app.operation_receipts),'audits',(select count(*)from app.audit_events),'plans',(select count(*)from app.native_mixed_simulation_plans_v1),'draws',(select count(*)from app.native_mixed_simulation_draws_v1),'reviews',(select count(*)from app.native_mixed_simulation_reviews_v1),'publications',(select count(*)from app.native_mixed_simulation_publication_contexts_v1));`);
const prepared=JSON.parse(fs.readFileSync(dir+'/flow-results.json')),replays=[];
for(const[action,key]of[['plan','req_plan'],['draw','req_draw'],['review','req_drawReview'],['publish','req_localScheduleSave']]){
 const saved=prepared[key],operation={action,operationId:saved.operationId,request:saved};
 const response=await boundary.operationPOST(new Request('https://pilot.test/rehearsal',{method:'POST',headers:{'x-expected-actor-id':actor,'content-type':'application/json'},body:JSON.stringify(operation)}),{params:Promise.resolve({id:tid,eventId:eid})});
 replays.push({action,response});assert.equal(response.status,200,JSON.stringify(response));
}
const afterReplays=read(`select jsonb_build_object('receipts',(select count(*)from app.operation_receipts),'audits',(select count(*)from app.audit_events),'plans',(select count(*)from app.native_mixed_simulation_plans_v1),'draws',(select count(*)from app.native_mixed_simulation_draws_v1),'reviews',(select count(*)from app.native_mixed_simulation_reviews_v1),'publications',(select count(*)from app.native_mixed_simulation_publication_contexts_v1));`);
check('Director plan draw review publication exact-retry HTTP path preserves journal counts',()=>assert.deepEqual(afterReplays,beforeReplays));fs.writeFileSync(dir+'/director-http-replay-results.json',JSON.stringify({beforeReplays,afterReplays,replays},null,2));

sql('set role postgres;revoke all on function public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)from authenticated;');


function binding(issuer=`https://${ref}.supabase.co/auth/v1`,who=digital,target=eid){const c={role:'authenticated',sub:who,session_id:cache.sessionIds[who],iss:issuer,exp:4102444800};return read(`set request.jwt.claim.sub='${who}';set request.jwt.claim.role='authenticated';set request.jwt.claims=${quote(JSON.stringify(c))};set role authenticated;select public.get_native_mixed_own_player_bindings_v1('${tid}','${target}','${cache.start.startId}');`);}
const dc={role:'authenticated',sub:digital,session_id:cache.sessionIds[digital],iss:`https://${ref}.supabase.co/auth/v1`,exp:4102444800};
const diagnostic=read(`set request.jwt.claim.sub='${digital}';set request.jwt.claim.role='authenticated';set request.jwt.claims=${quote(JSON.stringify(dc))};set role postgres;select jsonb_build_object('subject',app.native_mixed_game_own_subject_v1(),'permit',app.native_mixed_pilot_permitted_v1('${digital}','${tid}','${eid}',false),'root',app.native_mixed_game_root_current_v1('${cache.start.startId}','${tid}','${eid}'),'inner',app.get_native_mixed_own_player_bindings_v1('${tid}','${eid}','${cache.start.startId}'),'unscoped',app.pilot_unscoped_get_native_mixed_own_player_bindings_v1('${tid}','${eid}','${cache.start.startId}'),'wrapper',public.get_native_mixed_own_player_bindings_v1('${tid}','${eid}','${cache.start.startId}'));`);
fs.writeFileSync(dir+'/binding-diagnostic.json',JSON.stringify(diagnostic,null,2));
const baseline=JSON.parse(fs.readFileSync('test-results/native-mixed-pilot-baseline-20261107/function-catalog.json'));
const current=read(`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identityArgs',pg_get_function_identity_arguments(p.oid),'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'acl',coalesce(to_jsonb(p.proacl),'null'::jsonb),'executableBy',array(select r from unnest(array['anon','authenticated','service_role'])r where has_function_privilege(r,p.oid,'EXECUTE')))order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public');`);
const key=p=>JSON.stringify([p.schema,p.name,p.identityArgs]),old=new Map(baseline.map(p=>[key(p),p])),fresh=current.filter(p=>!old.has(key(p))),changed=current.filter(p=>old.has(key(p))&&JSON.stringify(p.acl)!==JSON.stringify(old.get(key(p)).acl));
fs.writeFileSync(dir+'/function-privilege-difference.json',JSON.stringify({baselineCount:baseline.length,currentCount:current.length,newFunctions:fresh,changedExisting:changed},null,2));
check('actual authenticated own-binding wrapper accepts current scoped subject',()=>assert.equal(binding()?.actorId,digital,JSON.stringify({subject:diagnostic.subject,permit:diagnostic.permit,root:!!diagnostic.root,inner:!!diagnostic.inner,unscoped:!!diagnostic.unscoped,wrapper:!!diagnostic.wrapper})));

check('actual authenticated wrapper rejects wrong issuer',()=>assert.equal(binding('https://other.supabase.co/auth/v1'),null));
check('actual authenticated wrapper rejects other event',()=>assert.equal(binding(undefined,digital,randomUUID()),null));
const wrapperArgs={record_native_mixed_digital_consent_v1:'uuid,uuid,jsonb',record_native_mixed_simulation_game_evidence_v1:'uuid,uuid,jsonb',get_native_mixed_simulation_game_operation_v1:'uuid,uuid,jsonb',resolve_native_mixed_game_operation_v1:'uuid,uuid,jsonb',get_native_mixed_simulation_game_state_v1:'uuid,uuid,uuid,uuid',get_native_mixed_own_player_bindings_v1:'uuid,uuid,uuid',get_native_mixed_paper_binding_v1:'uuid,uuid,uuid,uuid'};
sql('set role postgres;'+Object.entries(wrapperArgs).map(([n,a])=>`grant execute on function public.${n}(${a})to authenticated;`).join(''));
function deniedWrappers(issuer){return Object.entries(wrapperArgs).map(([n,a])=>{const c={role:'authenticated',sub:digital,session_id:cache.sessionIds[digital],iss:issuer,exp:4102444800},tail=a==='uuid,uuid,jsonb'?"'{}'::jsonb":a==='uuid,uuid,uuid'?`'${cache.start.startId}'`:`'${cache.start.startId}','${cache.scheduleSource.canonicalGames[0].gameId}'`;return read(`set request.jwt.claim.sub='${digital}';set request.jwt.claim.role='authenticated';set request.jwt.claims=${quote(JSON.stringify(c))};set role authenticated;select public.${n}('${tid}','${eid}',${tail});`);});}
check('all seven actual authenticated wrappers reject wrong issuer',()=>assert(deniedWrappers('https://other.supabase.co/auth/v1').every(v=>v===null)));


check('coDirector cannot dispatch',()=>assert.equal(dispatch(checker,cache.sessionIds[checker]),null));
check('invalid Director session denied',()=>assert.equal(dispatch(actor,randomUUID()),null));
check('unsupported preparation action denied',()=>assert.equal(dispatch(actor,session,'create-account'),null));
scope([actor,checker,digital],false);
check('write revocation permits read only',()=>{assert.equal(permit(),true);assert.equal(permit(actor,tid,eid,true),false);assert(binding());});
scope([actor,digital],true,"clock_timestamp()+interval'100 milliseconds'");
await new Promise(r=>setTimeout(r,200));
check('expired cohort denied',()=>{assert.equal(permit(),false);assert.equal(binding(),null);});
check('all seven actual wrappers reject expired cohort',()=>assert(deniedWrappers(`https://${ref}.supabase.co/auth/v1`).every(v=>v===null)));
sql('set role postgres;'+Object.entries(wrapperArgs).map(([n,a])=>`revoke execute on function public.${n}(${a})from authenticated;`).join(''));
sql('set role postgres;'+originals.join(';')+';revoke execute on function public.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid)from authenticated;');
sql('set role postgres;revoke execute on function app.native_mixed_pilot_permitted_v1(uuid,uuid,uuid,boolean)from service_role;revoke execute on function public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)from service_role;');


const baseTableFile='test-results/native-mixed-pilot-baseline2-20261107/table-catalog.json';for(let i=0;i<120&&!fs.existsSync(baseTableFile);i++)await new Promise(r=>setTimeout(r,500));assert(fs.existsSync(baseTableFile),'Numbered baseline table evidence required');
const baseTables=JSON.parse(fs.readFileSync(baseTableFile));
const tables=read(`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',coalesce(to_jsonb(c.relacl),'null'::jsonb),'exposedTo',array(select r from unnest(array['anon','authenticated','service_role'])r where has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','public')and c.relkind in('r','p','v','m');`);
const tableKey=t=>t.schema+'.'+t.name,bt=new Map(baseTables.map(t=>[tableKey(t),t])),newTables=tables.filter(t=>!bt.has(tableKey(t))),changedTables=tables.filter(t=>bt.has(tableKey(t))&&JSON.stringify(t)!==JSON.stringify(bt.get(tableKey(t))));
fs.writeFileSync(dir+'/table-privilege-difference.json',JSON.stringify({baselineCount:baseTables.length,currentCount:tables.length,newTables,changedExisting:changedTables},null,2));
check('new tables deny direct application-role access',()=>assert(newTables.every(t=>t.exposedTo.length===0)));
check('existing table security and ACL metadata preserved',()=>assert.deepEqual(changedTables,[]));
const revoke='begin;\n'+fresh.map(p=>`revoke all on function ${p.schema}.${p.name}(${p.identityArgs})from public,anon,authenticated,service_role;`).join('\n')+'\ncommit;\n';
fs.writeFileSync(dir+'/freeze-new-function-privileges.sql',revoke);sql('set role postgres;'+revoke);
const reachable=read(`select to_jsonb(count(*))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')and (n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))in(select x->>'schema',x->>'name',x->>'identityArgs'from jsonb_array_elements(${json(fresh)})x)and exists(select 1 from unnest(array['anon','authenticated','service_role'])r where has_function_privilege(r,p.oid,'EXECUTE'));`);
check('all newly introduced functions closed after literal ACL freeze',()=>assert.equal(reachable,0));
scope(Object.keys(cache.sessionIds),true);
const integrated=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types','tests/native-mixed-pilot-prep108-acceptance-local-scoring.mjs','full'],{encoding:'utf8',windowsHide:true,maxBuffer:32e6});
fs.writeFileSync(dir+'/post-confinement-paper-provider.log',integrated.stdout+integrated.stderr);assert.equal(integrated.status,0,integrated.stderr||integrated.stdout);checks.push('full scoped108 private scoring completed');
for(const[name,args]of[['verify',['scoring','verify']],['oracle',['oracle']]]){const target='tests/native-mixed-pilot-prep108-acceptance-local-'+args[0]+'.mjs',r=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types',target,...args.slice(1)],{encoding:'utf8',windowsHide:true,maxBuffer:32e6});fs.writeFileSync(dir+'/'+name+'-full.log',r.stdout+r.stderr);assert.equal(r.status,0,r.stderr||r.stdout);}checks.push('full journal independent oracle and ordinary data preservation');sql('set role postgres;'+revoke);
verifyCompatibility(sql,dir,true);checks.push('populated historical row multiset retained through rehearsal');
fs.writeFileSync(dir+'/confinement-results.json',JSON.stringify({checks,sqlClaimsOnly:true,hostedChanges:false},null,2));
