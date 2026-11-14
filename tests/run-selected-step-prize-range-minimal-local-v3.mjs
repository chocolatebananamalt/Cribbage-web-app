// Bounded isolated SQL writer/admission acceptance. Reviewed-fund/manual
// sporting capture is a synthetic upstream fixture, NOT real collector/provider proof.
import fs from'node:fs';import crypto from'node:crypto';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import{manualAwardFixtureV1}from'./helpers/modern-manual-award-fixture-v1.mjs';import{selectedStepFinalClonesV3,applySelectedStepCloneV3}from'./helpers/selected-step-final-clones-v3.mjs';
const name='cribbage-selected-step-range-minimal-20261112',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706',dir='test-results/selected-step-range-minimal-20261112',db='fictional_selected_range';fs.mkdirSync(dir,{recursive:true});let cid;
const report={localOnly:true,fictionalOnly:true,syntheticUpstream:['pure source-input DTO; no source collector or provider invoked'],realCollectorAcceptance:false,realProviderAcceptance:false,checks:[],sourceHashes:{},cleaned:false};const save=()=>fs.writeFileSync(dir+'/result.json',JSON.stringify(report,null,2));
const docker=(args,input,allow=false)=>{const r=spawnSync('C:/Users/choco/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,maxBuffer:32e6});if(!allow)assert.equal(r.status,0,String(r.stderr||r.stdout));return r;};
const inspect=()=>{const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Name,'/'+name);assert.equal(m.Image,image);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.Mounts.length,0);assert.equal(m.HostConfig.Privileged,false);assert.equal(m.HostConfig.Tmpfs['/tmp'],'rw,noexec,nosuid,size=268435456');};
const sql=(s,allow=false,database=db)=>{inspect();return docker(['exec','-i',cid,'psql','-h','/tmp','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],s,allow);};const lit=s=>"'"+s.replaceAll("'","''")+"'",id=n=>'be120000-0000-4000-8000-'+String(n).padStart(12,'0');
const source=f=>{const s=fs.readFileSync('database/proposals/'+f,'utf8');report.sourceHashes[f]=crypto.createHash('sha256').update(s).digest('hex');return s;};
const fn=(file,name)=>{const s=source(file),start=s.indexOf('create function '+name+'(');assert(start>=0,name);const tail=s.slice(start),m=/\bas\s*(\$[A-Za-z_]*\$)/i.exec(tail);assert(m,name);const end=tail.indexOf(m[1],m.index+m[0].length);assert(end>=0);return tail.slice(0,end+m[1].length)+';';};
const c=manualAwardFixtureV1(),input=c.value.source.prizeWorkspace.nativeSource.capture.input;
try{
 const context=JSON.parse(docker(['context','inspect','desktop-linux']).stdout);assert.equal(context[0].Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');assert.equal(docker(['ps','-aq','--filter','name=^/'+name+'$']).stdout.trim(),'');
 cid=docker(['run','-d','--pull=never','--name',name,'--label','codex.fixture='+name,'--network','none','--tmpfs','/tmp:rw,noexec,nosuid,size=268435456','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/fixture-pgdata -U postgres --auth=trust --no-locale --encoding=UTF8 >/tmp/init.log 2>&1 && exec postgres -D /tmp/fixture-pgdata -k /tmp -c listen_addresses=''"]).stdout.trim();report.containerId=cid;save();inspect();
 let ready=false;for(let i=0;i<40;i++){if(docker(['exec',cid,'pg_isready','-h','/tmp','-U','postgres'],undefined,true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,250));}assert(ready);docker(['exec',cid,'createdb','-h','/tmp','-U','postgres',db]);
 sql(`create schema app;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create role anon nologin;create role authenticated nologin;create role service_role nologin;
 create function auth.uid()returns uuid language sql as $$select null::uuid$$;
 create function app.reject_immutable_history()returns trigger language plpgsql as $$begin raise exception'immutable';end$$;
 create function app.event_settings_js_text_length_v3(text)returns integer language sql as $$select length($1)$$;
 create table app.tournaments(id uuid primary key);create table app.events(id uuid,tournament_id uuid);create table app.tournament_roles(tournament_id uuid,profile_id uuid,role text);`);
 sql(fn('event-prize-transaction-source-v1.sql','app.event_prize_exact_keys_source_v1'));sql(fn('event-prize-transaction-source-v1.sql','app.valid_event_prize_draft_source_v1'));
 sql(source('playoff-prize-proposal-store-v2.sql'));
 const definition=fn('playoff-prize-proposal-store-v2.sql','app.save_playoff_prize_proposal_v2');const spec=selectedStepFinalClonesV3.find(x=>x.name==='app.save_selected_step_prize_proposal_v3');const body=definition.slice(definition.indexOf('as $$')+5,definition.lastIndexOf('$$;'));
 sql('create function '+spec.name+'('+spec.args+')returns jsonb language plpgsql security definer set search_path=\'\'as $copy$'+applySelectedStepCloneV3(body,spec)+'$copy$;');
 sql(source('selected-step-prize-range-v3.sql'));
 const check=(v,history=[],legacy=false)=>sql('select app.'+(legacy?'playoff_prize_proposal_range_safe_v2':'selected_step_prize_range_safe_v3')+'('+lit(JSON.stringify(v))+'::jsonb,'+lit(JSON.stringify(history))+'::jsonb);').stdout.trim()==='t';
 assert.equal(check(input,[],true),false);assert.equal(check(input),true);
 // Original source remains complete; Q/Side amounts must not enter regular prize weights.
 for(const method of['equal','graduated','winner-multiplier','winner-takes-all']){const v=structuredClone(input);v.prizeSource.snapshot.plans[0].draft.method=method;assert.equal(check(v),true,method);}
 for(const change of[
 v=>v.ledger.current.sources[0].allocations[1].amountMinor++,
 v=>v.ledger.current.sources[0].allocations[1].poolId=id(900),
 v=>v.ledger.current.sources[0].allocations[1].bucket='side',
 v=>v.ledger.current.sources[0].allocations[1].eventId=id(901),
 v=>v.ledger.current.pools.push(structuredClone(v.ledger.current.pools[0])),
 v=>v.ledger.current.sources.push(structuredClone(v.ledger.current.sources[0])),
 v=>v.ledger.current.sources[0].physicalEvidenceId=id(902),
 v=>v.ledger.current.sources[0].allocations[1].classificationReviewed=false,
 v=>v.ledger.current.sources[0].allocations[0].poolId=id(903),
 v=>v.ledger.current.sources[0].allocations[0].amountMinor=Number.MAX_SAFE_INTEGER
 ]){const v=structuredClone(input);change(v);v.ledger.retained=structuredClone(v.ledger.current);assert.equal(check(v),false);}
 const legacy=structuredClone(input);legacy.ledger.current.sources[0].allocations=legacy.ledger.current.sources[0].allocations.slice(0,1);legacy.ledger.current.sources[0].amountMinor=10000;legacy.ledger.current.pools=[];legacy.ledger.retained=structuredClone(legacy.ledger.current);assert.equal(check(legacy,[],true),true);assert.equal(check(legacy),true);
 const writer=sql("select prosrc from pg_proc where oid='app.save_selected_step_prize_proposal_v3(uuid,uuid,uuid,uuid,text)'::regprocedure;").stdout;assert(writer.includes('app.selected_step_prize_range_safe_v3(request_value'));assert(!writer.includes('app.playoff_prize_proposal_range_safe_v2('));
 for(const role of['anon','authenticated','service_role'])assert.equal(sql('select has_function_privilege('+lit(role)+','+lit('app.selected_step_prize_range_safe_v3(jsonb,jsonb)')+','+lit('execute')+');').stdout.trim(),'f');
 report.checks.push('genuine original store and V3 clone install; new exact writer call patch parses','actual legacy validator rejects conserved optional funds; V3 accepts same complete source and retains legacy regular-only behavior','four actual methods pass range checks; conservation/pool/event/identity/classification/overflow mutations reject','new helpers revoked; no source collector, proposal save, award, provider or real transaction claimed');report.passed=true;save();
}catch(error){report.passed=false;report.error=String(error);save();throw error;}finally{if(cid){inspect();docker(['rm','-f',cid]);assert.equal(docker(['ps','-aq','--filter','id='+cid]).stdout.trim(),'');report.cleaned=true;}save();console.log(JSON.stringify(report));}

