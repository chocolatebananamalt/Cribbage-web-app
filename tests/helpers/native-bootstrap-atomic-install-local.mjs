// Approved fictional local fixture. Hold writer stdin open until a second connection checks visibility.
import fs from'node:fs';import assert from'node:assert/strict';import{spawn}from'node:child_process';
export async function installAtomicBootstrap({state,dir,sql,read}){
 const bytes=fs.readFileSync('test-results/native-mixed-bootstrap-atomic53-20261107/closed-install.sql','utf8'),mark='-- FINAL_CLOSED_PRIVILEGES',at=bytes.indexOf(mark);assert(at>0&&bytes.indexOf(mark,at+1)<0);
 let rejected=false;try{sql(bytes.slice(0,at)+'\nselect 1/0;\n'+bytes.slice(at));}catch(e){assert.match(String(e),/division by zero/);rejected=true;}assert(rejected);
 const afterRollback=read("select jsonb_build_object('count',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')),'bootstrapAbsent',to_regprocedure('public.get_native_mixed_bootstrap_session_v1(uuid,uuid,text,boolean)')is null);");assert.deepEqual(afterRollback,{count:781,bootstrapAbsent:true});
 const child=spawn('docker',['--context','desktop-linux','exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',state.db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',seen=false,resolveReady,rejectReady,resolveDone,rejectDone;
 const ready=new Promise((a,b)=>{resolveReady=a;rejectReady=b;}),done=new Promise((a,b)=>{resolveDone=a;rejectDone=b;});
 child.on('error',e=>{rejectReady(e);rejectDone(e);});child.on('close',code=>{if(code!==0){const e=Error(stderr||'atomic writer failed');rejectReady(e);rejectDone(e);}else{if(!seen)rejectReady(Error('missing precommit marker'));resolveDone();}});
 child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{stdout+=b;for(const line of stdout.split('\n'))try{const v=JSON.parse(line);if(v.atomicReady===true&&!seen){seen=true;resolveReady();}}catch{/* wait for marker */}});
 let committed=false;
 try{child.stdin.write('set role postgres;'+bytes.slice(0,at)+"\nselect jsonb_build_object('atomicReady',true);\n");await ready;
  const beforeCommit=read("select jsonb_build_object('count',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')),'bootstrapAbsent',to_regprocedure('public.get_native_mixed_bootstrap_session_v1(uuid,uuid,text,boolean)')is null);");assert.deepEqual(beforeCommit,{count:781,bootstrapAbsent:true});
  child.stdin.end(bytes.slice(at));await done;committed=true;
  const after=read("select jsonb_build_object('count',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')),'bootstrapPresent',to_regprocedure('public.get_native_mixed_bootstrap_session_v1(uuid,uuid,text,boolean)')is not null,'authCanLease',has_function_privilege('authenticated','public.get_native_mixed_bootstrap_session_v1(uuid,uuid,text,boolean)','execute'));");assert.deepEqual(after,{count:1174,bootstrapPresent:true,authCanLease:false});
  fs.writeFileSync(dir+'/atomic-install-proof.json',JSON.stringify({rollbackInjected:true,afterRollback,beforeCommit,after,secondConnection:true,writerHeldWithoutSleep:true,closedBeforeCommit:true,hosted:false},null,2));console.log('PASS atomic rollback and second-connection invisibility; committed functions closed');
 }finally{if(!committed){child.stdin.end('\nrollback;\n');await done.catch(()=>{});}fs.writeFileSync(dir+'/atomic-install-writer.log',stdout+stderr);}
}
