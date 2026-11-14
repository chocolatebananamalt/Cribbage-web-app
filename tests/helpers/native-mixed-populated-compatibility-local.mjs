import{qSetupPrizeWorkspace}from'../fixtures/q-setup-prize-workspace.mjs';
import{randomUUID}from'node:crypto';
// Approved disposable fictional database only. Existing-column row preservation.
import fs from'node:fs';import assert from'node:assert/strict';
const q=s=>"'"+String(s).replaceAll("'","''")+"'",ident=s=>'"'+s.replaceAll('"','""')+'"';
function snapshot(sql,metadata){
 const statements=metadata.map(t=>{const columns=t.columns.map(q).join(',');return `insert into compat_snapshot values(${q(t.schema+'.'+t.name)},(select coalesce(jsonb_agg(j order by j::text),'[]')from(select (select jsonb_object_agg(k,v)from jsonb_each(to_jsonb(t))e(k,v)where k=any(array[${columns}]::text[]))j from ${ident(t.schema)}.${ident(t.name)} t)s));`;});
 return JSON.parse(sql(`begin;create temporary table compat_snapshot(name text,rows jsonb)on commit drop;${statements.join('')}select jsonb_object_agg(name,rows)from compat_snapshot;commit;`));
}
export function seedCompatibility(sql,dir){
 let seed=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8');seed=seed.slice(0,seed.indexOf('insert into app.ruleset_versions'));seed=seed.replace("'Synthetic Qualification','open','open'","'TEST ONLY Historical Compatibility','draft','closed'").replaceAll('1310000','5310000').replaceAll('2430000','5430000').replaceAll('qualification-','compatibility-').replaceAll('Synthetic Qualification','TEST ONLY Historical Compatibility');
 sql('begin;'+seed+'commit;');
 const actor='a5310000-0000-4000-8000-000000000001',tid='b5310000-0000-4000-8000-000000000001';
 const{revisionId,version,createdAt,...payload}=qSetupPrizeWorkspace(actor).current;void revisionId;void version;void createdAt;
 payload.tournamentName='TEST ONLY Historical Compatibility';payload.events[0].clientRowId='e5310000-0000-4000-8000-000000000003';payload.events[0].gameCount=12;delete payload.events[0].sourceStatus;
 payload.events[0].qPools=[{poolTypeCode:'Equal',entryFeeCents:500,note:'Preserve Equal'},{poolTypeCode:'Graduated',entryFeeCents:1000,note:'Preserve Graduated'}];
 const envelope={kind:'setup-event-links-v1',request:{expectedVersion:1,payload,idempotencyKey:randomUUID()},choices:[{mainClientRowId:payload.events[0].clientRowId,consolationClientRowIds:[]}]};
 const prefix=`set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='authenticated';set role authenticated;`;
 const command=`select public.save_linked_tournament_setup_v1('${tid}',${q(JSON.stringify(envelope))}::jsonb);`;
 const saved=JSON.parse(sql(prefix+command));assert.equal(saved.status,'linked_setup_saved',JSON.stringify(saved));const replay=JSON.parse(sql(prefix+command));assert.deepEqual(replay,saved);
 const links=JSON.parse(sql(prefix+`select public.get_setup_event_links_v1('${tid}');`));assert(links);
 fs.writeFileSync(dir+'/compatibility-legacy-save.json',JSON.stringify({actor,tid,envelope,saved,links},null,2));

 const metadata=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'columns',(select jsonb_agg(a.attname order by a.attnum)from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p')and(n.nspname in('app','public')or n.nspname='auth'and c.relname in('users','sessions'));`));
 fs.writeFileSync(dir+'/compatibility-baseline-columns.json',JSON.stringify(metadata,null,2));const before=snapshot(sql,metadata);fs.writeFileSync(dir+'/compatibility-before.json',JSON.stringify(before,null,2));assert(Object.values(before).some(rows=>rows.length>0));return{tables:metadata.length,populated:Object.values(before).filter(r=>r.length).length,rows:Object.values(before).reduce((n,r)=>n+r.length,0)};
}
export function verifyCompatibility(sql,dir,containment=false){
 const metadata=JSON.parse(fs.readFileSync(dir+'/compatibility-baseline-columns.json')),before=JSON.parse(fs.readFileSync(dir+'/compatibility-before.json')),after=snapshot(sql,metadata),changes=[];
 for(const[name,rows]of Object.entries(before)){if(!containment){if(JSON.stringify(rows)!==JSON.stringify(after[name]))changes.push(name);}else{const counts=new Map();for(const row of after[name]){const k=JSON.stringify(row);counts.set(k,(counts.get(k)??0)+1);}for(const row of rows){const k=JSON.stringify(row),n=counts.get(k)??0;if(!n){changes.push(name);break;}counts.set(k,n-1);}}}
 fs.writeFileSync(dir+(containment?'/compatibility-after-rehearsal.json':'/compatibility-after-install.json'),JSON.stringify({tables:metadata.length,baselineRows:Object.values(before).reduce((n,r)=>n+r.length,0),mode:containment?'existing-row-multiset-containment':'exact-existing-column-rows',changes},null,2));assert.deepEqual(changes,[]);return{tables:metadata.length,changes:0};
}

export function verifyLegacyWriter(sql,dir){const prior=JSON.parse(fs.readFileSync(dir+'/compatibility-legacy-save.json')),envelope=structuredClone(prior.envelope);envelope.request.expectedVersion=prior.saved.result.version;envelope.request.idempotencyKey=randomUUID();const prefix=`set request.jwt.claim.sub='${prior.actor}';set request.jwt.claim.role='authenticated';set role authenticated;`,call=`select public.save_linked_tournament_setup_v1('${prior.tid}',${q(JSON.stringify(envelope))}::jsonb);`;const outputs=sql('begin;'+prefix+call+call+'rollback;').split('\n').filter(Boolean).map(JSON.parse);assert.equal(outputs.length,2);assert.equal(outputs[0].status,'linked_setup_saved',JSON.stringify(outputs));assert.deepEqual(outputs[0],outputs[1]);fs.writeFileSync(dir+'/compatibility-legacy-writer-after-install.json',JSON.stringify({transactionRolledBack:true,outputs},null,2));}
