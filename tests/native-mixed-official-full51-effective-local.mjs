// Read-only parallel observer of this exact owned fixture; no network or writes.
import fs from'node:fs';import assert from'node:assert/strict';import crypto from'node:crypto';import{spawnSync}from'node:child_process';
const dir='test-results/native-mixed-official-full51-20261107',manifest=JSON.parse(fs.readFileSync('database/release-packages/native-preparation51/manifest.json'));let passed=false,lastError;
for(let i=0;i<180;i++){
 try{
  const s=JSON.parse(fs.readFileSync(dir+'/state.json'));if(s.cleaned)break;assert.equal(s.name,'cribbage-native-mixed-official-full51-20261107');
  const run=(args,input)=>spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,maxBuffer:32e6});
  const sql=text=>{const r=run(['exec','-i',s.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',s.db,'-X','-qAt','-v','ON_ERROR_STOP=1'],text);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  const count=sql("select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')");
  if(count==='1160'){
   const cols=JSON.parse(fs.readFileSync(dir+'/compatibility-baseline-columns.json')),quote=t=>"'"+t.replaceAll("'","''")+"'";
   const oldNames=cols.map(t=>quote(t.schema+'.'+t.name)).join(',');
   const q=`select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'role',r.role,'tableAccess',has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'columnAccess',has_any_column_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'),'rls',c.relrowsecurity)order by n.nspname,c.relname,r.role)from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join(values('anon'),('authenticated'),('service_role'))r(role)where c.relkind in('r','p')and n.nspname in('app','public')and n.nspname||'.'||c.relname not in(${oldNames})`;
   const rows=JSON.parse(sql(q));assert.equal(rows.length,118*3);for(const row of rows){assert.equal(row.tableAccess,false);assert.equal(row.columnAccess,false);assert.equal(row.rls,true);}
   const r=run(['exec',s.containerId,'sha256sum','/tmp/full51-project/supabase/migrations/'+manifest.file.split('/').at(-1)]);assert.equal(r.status,0,r.stderr);const hash=r.stdout.split(/\s/)[0];assert.equal(hash,manifest.sha256);
   const history=JSON.parse(sql("select to_jsonb(t)from supabase_migrations.schema_migrations t where version='"+manifest.version+"'"));assert(history);assert.equal(history.version,manifest.version);
   const historySha=crypto.createHash('sha256').update(JSON.stringify(history)).digest('hex');
   fs.writeFileSync(dir+'/effective-privileges-and-cli-bytes.json',JSON.stringify({passed:true,readOnlyObserver:true,rows,exactCliFileSha256:hash,historyVersion:history.version,historyName:history.name,historyRowSha256:historySha,historyStatementsCount:history.statements?.length,scope:'new tables effective app role access only; does not compare old policies or column grants'},null,2));passed=true;break;
  }
 }catch(e){lastError=String(e);}
 await new Promise(r=>setTimeout(r,700));
}
assert(passed,lastError??'Owned fixture ended before successful candidate commit was observed');console.log('PASS118 new tables x3 effective role denials, exact CLI file hash and history row fingerprint');
