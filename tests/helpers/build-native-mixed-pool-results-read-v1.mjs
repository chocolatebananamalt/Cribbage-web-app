// Deterministic source only. Extract unchanged producer branches for read proof;
// no SQL execution, writer replacement or new policy/amount computation.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const poolResultsPinsV1={'database/proposals/native-mixed-pool-finance-v1.sql':'6b3f51e33a809dddd14173d14af75c4ba109163c82760e7aef475bde50d9bf4c','database/proposals/native-mixed-pool-amounts-v1.sql':'c916aba5f4e08c1e424aa9034fb9dca1f273f09ee77a497002a3162aecdf4707'};
const load=p=>{const b=fs.readFileSync(p);assert.equal(sha(b),poolResultsPinsV1[p]);return b.toString('utf8').replaceAll('\r\n','\n');};
const once=(s,a,b)=>{assert.equal(s.split(a).length-1,1,a);return s.replace(a,()=>b);};
export function poolResultsProducerBranchesV1(){const s=load('database/proposals/native-mixed-pool-finance-v1.sql'),a=s.indexOf("  if not app.native_mixed_pool_exact_v1(data,array['expectedFundingDigest'])"),b=s.indexOf(" else\n  if not app.native_mixed_pool_exact_v1(data,array['sealId','sealDigest','startId'])",a),c=s.indexOf('\n end if;\n\n select*into head',b);assert(a>0&&b>a&&c>b);return{seal:s.slice(a,b),final:s.slice(b+' else\n'.length,c)};}
export function buildNativeMixedPoolResultsReadV1(){
 const base=load('database/proposals/native-mixed-pool-finance-v1.sql'),amount=load('database/proposals/native-mixed-pool-amounts-v1.sql'),raw=poolResultsProducerBranchesV1();
 const seal=once(raw.seal,"\n   or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')",'');
 const final=once(raw.final,"review:=app.native_mixed_qualification_review_v1(tid,eid,(data->>'startId')::uuid);",'review:=verified_review;');
 const parts=[`create function app.native_mixed_pool_expected_seal_results_v1(tid uuid,eid uuid,data jsonb,funding jsonb)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare policy app.native_mixed_pool_records_v1%rowtype;setup_source jsonb;elections jsonb;contributions jsonb;entry jsonb;policy_rows jsonb:='[]';key text;record_payload jsonb;begin
${seal}
 return record_payload;
exception when sqlstate'P0001'then if sqlerrm like'native_pool_%'then return null;else raise;end if;
 when invalid_text_representation or numeric_value_out_of_range then return null;end$$;`,
 `create function app.native_mixed_pool_expected_final_results_v1(tid uuid,eid uuid,data jsonb,funding jsonb,verified_review jsonb)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare seal app.native_mixed_pool_records_v1%rowtype;review jsonb;cards jsonb;item jsonb;amount_policy jsonb;requested_kind text;setup_source jsonb;paid integer;unit integer;fund bigint;ranked jsonb;recipients integer;calc jsonb;awards jsonb;i integer;results jsonb:='[]';key text;record_payload jsonb;begin
${final}
 return record_payload;
exception when sqlstate'P0001'then if sqlerrm like'native_pool_%'then return null;else raise;end if;
 when invalid_text_representation or numeric_value_out_of_range then return null;end$$;`];
 const fn=(s,n)=>{const m=s.match(new RegExp(`create (?:or replace )?function app\\.${n}\\([^]*?\\$\\$;`));assert(m,n);return m[0];};
 const deps=[['execute_native_mixed_pool_finance_v1','uuid,uuid,uuid,jsonb',base],['native_mixed_pool_setup_v1','uuid,uuid,text,uuid,jsonb',base],['native_mixed_pool_amounts_v1','jsonb,integer,integer',amount]].map(([n,args,source])=>{const d=fn(source,n),head=d.split('as $$')[0],body=d.split('as $$')[1].slice(0,-3),config=[...head.matchAll(/set (search_path|timezone|lock_timeout)='([^']*)'/g)].map(m=>(m[1]==='timezone'?'TimeZone':m[1])+'='+(m[1]==='search_path'?'""':m[2]));return`('app.${n}(${args})','${sha(body)}',${head.includes('security definer')},'${head.includes('immutable')?'i':head.includes('stable')?'s':'v'}',array[${config.map(c=>"'"+c+"'").join(',')}]::text[])`;});
 const guard=`-- BEGIN POOL RESULTS DEPENDENCIES
do $dependencies$declare x record;p record;begin
 for x in select*from(values ${deps.join(',')})v(signature,body_sha,definer,volatility,configs)loop
  select*into p from pg_proc where oid=to_regprocedure(x.signature);
  if p.oid is null or encode(extensions.digest(replace(p.prosrc,E'\\r\\n',E'\\n'),'sha256'),'hex')<>x.body_sha
   or pg_get_userbyid(p.proowner)<>'postgres'or p.prosecdef is distinct from x.definer or p.provolatile::text<>x.volatility or p.proconfig is distinct from x.configs
   or has_function_privilege('anon',p.oid,'execute')or has_function_privilege('authenticated',p.oid,'execute')or has_function_privilege('service_role',p.oid,'execute')
  then raise exception 'pool_results_dependency_changed: %',x.signature;end if;
 end loop;end$dependencies$;
-- END POOL RESULTS DEPENDENCIES
`;
 const file='database/proposals/native-mixed-pool-results-read-v1.sql',marker='-- BEGIN DERIVED FUNCTIONS: build-native-mixed-pool-results-read-v1.mjs';
 const prefix=once(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n').split(marker)[0].replace(/-- BEGIN POOL RESULTS DEPENDENCIES[^]*?-- END POOL RESULTS DEPENDENCIES\n/,''),'begin;\n','begin;\n'+guard)+marker+'\n';
 const body=prefix+parts.join('\n\n')+'\n';
 const declared=[...body.matchAll(/create function ((?:app|public)\.[a-z0-9_]+)\(([^)]*)\)/g)].map(m=>m[1]+'('+m[2].split(',').filter(Boolean).map(x=>x.trim().split(/\s+/).slice(1).join(' ')).join(',')+')');
 return body+declared.map(s=>`alter function ${s}owner to postgres;\nrevoke all on function ${s}from public,anon,authenticated,service_role;`).join('\n')+'\ncommit;\n';
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-native-mixed-pool-results-read-v1.mjs'))fs.writeFileSync('database/proposals/native-mixed-pool-results-read-v1.sql',buildNativeMixedPoolResultsReadV1());
