import assert from 'node:assert/strict';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
import {isLinkedSetupSaveResult,isSetupEventLinksWorkspace} from '../src/lib/api/setup-event-links.ts';
import {isSetupWorkspace} from '../src/lib/api/setup.ts';
const id=(prefix,n)=>`${prefix}0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function verifyEmptyLinkedSetup({q,read}){
 const actor=id('a294',1),other=id('a294',2),tid=id('b294',1),literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
 q(`insert into auth.users(id,email)values('${actor}','empty-draft-director@test.invalid'),('${other}','empty-draft-outsider@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY Empty Draft','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`);
 const {revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;
 const base=payload.events[0];payload.events=['main','consolation','satellite'].map((kind,i)=>{const e={...structuredClone(base),clientRowId:id('c294',i+1),eventKind:kind,displayName:`TEST ONLY ${kind}`,gameCount:kind==='main'?12:kind==='consolation'?8:3};delete e.sourceStatus;return e;});
 const envelope={kind:'setup-event-links-v1',request:{expectedVersion:0,payload,idempotencyKey:id('d294',1)},choices:[{mainClientRowId:payload.events[0].clientRowId,consolationClientRowIds:[payload.events[1].clientRowId]}]};
 const call=(e,who=actor)=>read(`select public.save_linked_tournament_setup_v1('${tid}',${literal(e)});`,who,'authenticated');
 const first=call(envelope);assert.equal(first.status,'linked_setup_saved');assert.ok(isLinkedSetupSaveResult(first,envelope));
 const digest=()=>read(`select to_jsonb(md5((select to_jsonb(r)::text from app.tournament_setup_revisions r where tournament_id='${tid}'and version=1)||coalesce((select jsonb_agg(to_jsonb(e)order by e.ordinal)::text from app.tournament_setup_event_versions e where setup_revision_id='${first.result.revisionId}'),'')));`);
 const historyBefore=digest();
 const clear={kind:'setup-event-links-v1',request:{expectedVersion:1,payload:{...payload,events:[]},idempotencyKey:id('d294',2)},choices:[]};
 const cleared=call(clear);assert.equal(cleared.status,'linked_setup_saved');assert.equal(cleared.result.version,2);assert.equal(cleared.result.eventCount,0);assert.ok(isLinkedSetupSaveResult(cleared,clear));
 assert.deepEqual(call(clear),cleared);assert.deepEqual(call(envelope),first);assert.equal(digest(),historyBefore);
 const workspace=read(`select public.get_tournament_setup_workspace('${tid}');`,actor,'authenticated');assert.ok(isSetupWorkspace(workspace));assert.equal(workspace.current.version,2);assert.deepEqual(workspace.current.events,[]);assert.equal(workspace.current.venue,payload.venue);assert.equal(workspace.current.tournamentName,payload.tournamentName);
 const links=read(`select public.get_setup_event_links_v1('${tid}');`,actor,'authenticated');assert.ok(isSetupEventLinksWorkspace(links));assert.deepEqual(links.current,cleared.links);
 assert.deepEqual(read(`select public.reconcile_linked_setup_save_v1('${tid}',${literal(clear)});`,actor,'authenticated'),cleared);
 const unowned=call({...clear,request:{...clear.request,expectedVersion:2,idempotencyKey:id('d294',3)}},other);assert.equal(unowned.status,'rejected');
 const activate=read(`select public.finalize_linked_tournament_setup_v1('${actor}','${tid}',${literal({request:{setupRevisionId:cleared.result.revisionId,expectedVersion:2,confirmed:true,idempotencyKey:id('d294',4)},associationHash:cleared.links.associationHash})});`);assert.equal(activate.status,'rejected');
 const facts=read(`select jsonb_build_object('revisions',(select count(*)from app.tournament_setup_revisions where tournament_id='${tid}'),'historicalEventRows',(select count(*)from app.tournament_setup_event_versions where setup_revision_id='${first.result.revisionId}'),'activations',(select count(*)from app.tournament_setup_activations where tournament_id='${tid}'),'state',(select status from app.tournaments where id='${tid}'),'registration',(select registration_status from app.tournaments where id='${tid}'));`);
 assert.deepEqual(facts,{revisions:2,historicalEventRows:3,activations:0,state:'draft',registration:'closed'});
 return{emptySaveReadback:true,exactReplay:true,historicalDigestUnchanged:true,unauthorizedDenied:true,emptyActivationDenied:true,...facts,hostedWrites:false};
}
