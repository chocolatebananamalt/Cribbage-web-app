import fs from'node:fs';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';
import{dir,actor,checker,tid,sql,read,json,quote,claims}from'./helpers/native-mixed-pilot-scope2-acceptance-db.mjs';
const eid=JSON.parse(fs.readFileSync(dir+'/activation-result.json')).binding.eventId,cache=JSON.parse(fs.readFileSync(dir+'/scoring-results.json'));
sql('set role postgres;'+fs.readFileSync('database/proposals/native-mixed-pilot-confinement-v1.sql','utf8'));
const session=cache.sessionIds[actor],ref='nnhcnvksxgxnpvdqjgpg',checks=[];
const svc=(who=actor,project=ref)=>`set request.jwt.claim.role='service_role';set request.jwt.claims=${json({role:'service_role',sub:who,ref:project})};set role service_role;`;
function permit(who=actor,t=tid,e=eid,writing=false,project=ref){return read(svc(who,project)+`select app.native_mixed_pilot_permitted_v1('${who}','${t}','${e}',${writing});`);}
function check(name,fn){fn();checks.push(name);console.log('PASS',name);}
sql('set role postgres;grant usage on schema app to service_role;grant execute on function app.native_mixed_pilot_permitted_v1(uuid,uuid,uuid,boolean)to service_role;grant execute on function public.execute_native_mixed_pilot_director_v1(uuid,uuid,uuid,uuid,text,jsonb)to service_role;');
check('unconfigured fails closed',()=>assert.equal(permit(),false));
sql(`set role postgres;select app.authorize_native_mixed_pilot_deployment_v1('${ref}','fictional local approval');`);
let version=0;function scope(actors,writes,expiry='clock_timestamp()+interval\'1 hour\''){const op=randomUUID();return read(`set role postgres;select app.record_native_mixed_pilot_scope_v1('${tid}','${eid}',array[${actors.map(quote).join(',')}]::uuid[],${version++},${writes},${expiry},'fictional local approval','${op}');`);}
const digital='a1310000-0000-4000-8000-000000000002';
scope([actor,checker,digital],true);
check('approved project/event/actor permits',()=>assert.equal(permit(),true));
check('other project denied',()=>assert.equal(permit(actor,tid,eid,false,'fnjkwymxpnsqvxtpronk'),false));
check('other event denied',()=>assert.equal(permit(actor,tid,randomUUID()),false));
check('other actor denied',()=>assert.equal(permit('a1310000-0000-4000-8000-000000000003'),false));
function dispatch(who=actor,sid=session,action='source',project=ref){return read(svc(who,project)+`select public.execute_native_mixed_pilot_director_v1('${who}','${sid}','${tid}','${eid}',${quote(action)},'{}');`);}
check('Director preparation reads existing draw',()=>assert(dispatch()));
const originals=['native_mixed_game_writer_enabled_v1','native_mixed_admission_enabled_v1','native_mixed_funding_enabled_v1','native_mixed_attendance_enabled_v1','native_mixed_simulation_publication_enabled_v1'].map(n=>read(`select to_jsonb(pg_get_functiondef('app.${n}()'::regprocedure));`));
sql('set role postgres;'+originals.map(d=>d.replace('SELECT false','SELECT true').replace('select false','select true')).join(';')+`;grant execute on function public.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid)to authenticated;`);
function binding(issuer=`https://${ref}.supabase.co/auth/v1`,who=digital,target=eid){const c={role:'authenticated',sub:who,session_id:cache.sessionIds[who],iss:issuer,exp:4102444800};return read(`set request.jwt.claim.sub='${who}';set request.jwt.claim.role='authenticated';set request.jwt.claims=${json(c)};set role authenticated;select public.get_native_mixed_own_player_bindings_v1('${tid}','${target}','${cache.start.startId}');`);}
check('actual authenticated own-binding wrapper accepts current scoped subject',()=>assert.equal(binding()?.actorId,digital));
check('actual authenticated wrapper rejects wrong issuer',()=>assert.equal(binding('https://other.supabase.co/auth/v1'),null));
check('actual authenticated wrapper rejects other event',()=>assert.equal(binding(undefined,digital,randomUUID()),null));
const wrapperArgs={record_native_mixed_digital_consent_v1:'uuid,uuid,jsonb',record_native_mixed_simulation_game_evidence_v1:'uuid,uuid,jsonb',get_native_mixed_simulation_game_operation_v1:'uuid,uuid,jsonb',resolve_native_mixed_game_operation_v1:'uuid,uuid,jsonb',get_native_mixed_simulation_game_state_v1:'uuid,uuid,uuid,uuid',get_native_mixed_own_player_bindings_v1:'uuid,uuid,uuid',get_native_mixed_paper_binding_v1:'uuid,uuid,uuid,uuid'};
sql('set role postgres;'+Object.entries(wrapperArgs).map(([n,a])=>`grant execute on function public.${n}(${a})to authenticated;`).join(''));
function deniedWrappers(issuer){return Object.entries(wrapperArgs).map(([n,a])=>{const c={role:'authenticated',sub:digital,session_id:cache.sessionIds[digital],iss:issuer,exp:4102444800},tail=a==='uuid,uuid,jsonb'?"'{}'::jsonb":a==='uuid,uuid,uuid'?`'${cache.start.startId}'`:`'${cache.start.startId}','${cache.scheduleSource.canonicalGames[0].gameId}'`;return read(`set request.jwt.claim.sub='${digital}';set request.jwt.claim.role='authenticated';set request.jwt.claims=${json(c)};set role authenticated;select public.${n}('${tid}','${eid}',${tail});`);});}
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
fs.writeFileSync(dir+'/confinement-results.json',JSON.stringify({checks,sqlClaimsOnly:true,hostedChanges:false},null,2));
