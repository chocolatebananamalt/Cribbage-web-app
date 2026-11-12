import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {isSetupOfficialNominationRequest} from '../src/lib/api/setup-officials.ts';
import {saveSetupOfficialInvitation} from '../src/lib/setup-official-delivery.ts';
import {getOfficialInvitationContext} from '../src/lib/official-invitation-context.ts';
import {isOfficialInvitationContext} from '../src/lib/api/official-invitation-context.ts';
const id='00000000-0000-4000-8000-000000000001';
const input={actorId:id,tournamentId:id,role:'cross_checker',firstName:'TEST ONLY',lastName:'Official B',email:'pr122-player-b@test.invalid',accNumber:'ZZ1222026102602',operationId:id};
const context={status:'pending',nominationId:id,tournamentName:'TEST ONLY mixed',role:'cross_checker',expiresAt:'2030-01-01T00:00:00Z'};
test('exact nomination body supports legacy email default and explicit safe delivery modes',()=>{
 const body=Object.fromEntries(Object.entries(input).filter(([key])=>!["actorId","tournamentId","role"].includes(key)));
 for(const delivery of [undefined,'email','copy_link'])assert.equal(isSetupOfficialNominationRequest({...body,...(delivery?{delivery}:{})}),true);
 for(const delivery of [null,'skip','',true])assert.equal(isSetupOfficialNominationRequest({...body,delivery}),false);
 assert.equal(isSetupOfficialNominationRequest({...body,delivery:'copy_link',grantRole:true}),false);
});
test('copy mode uses canonical nomination authorization and never sends or records email',async()=>{
 const calls=[];let emails=0;
 const admin={rpc:async(name,args)=>{calls.push({name,args});return{data:{status:'official_pending_email',nominationId:id},error:null};}};
 const r=await saveSetupOfficialInvitation(admin,{...input,delivery:'copy_link'},async()=>{emails++;return true;});
 assert.deepEqual(r,{status:'invitation_link_ready',nominationId:id,acceptancePath:`/official-invitations/${id}`});
 assert.equal(emails,0);assert.equal(calls.length,2);assert.equal(calls[0].name,'get_setup_official_invitation_context_v1');assert.equal(calls[1].name,'nominate_tournament_setup_official_v1');
 assert.equal(calls[1].args.p_actor_id,input.actorId);assert.equal(calls[1].args.p_role,'cross_checker');
 assert.ok(calls[1].args.p_secret.length>=32);assert.equal('secret' in r,false);
});
test('copy-link fails before nomination or email if the rollout reader is unavailable',async()=>{
 const calls=[];let emails=0;
 await assert.rejects(saveSetupOfficialInvitation({rpc:async name=>{calls.push(name);return{data:null,error:{code:'PGRST202'}};}},{...input,delivery:'copy_link'},async()=>{emails++;return true;}));
 assert.deepEqual(calls,['get_setup_official_invitation_context_v1']);assert.equal(emails,0);
});
test('legacy and explicit email delivery preserve sent/failure recording only after nomination accepted',async()=>{
 for(const delivery of [undefined,'email'])for(const delivered of [true,false]){
  const calls=[];let emails=0;
  const admin={rpc:async(name,args)=>{calls.push({name,args});return{data:{status:'official_pending_email',nominationId:id},error:null};}};
  const r=await saveSetupOfficialInvitation(admin,{...input,delivery},async path=>{emails++;assert.equal(path,`/official-invitations/${id}`);return delivered;});
  assert.equal(emails,1);assert.equal(calls[1].name,'record_tournament_setup_official_invitation_delivery_v1');assert.equal(calls[1].args.p_delivered,delivered);
  assert.equal(r.status,delivered?'invitation_email_sent':'delivery_unavailable');
 }
 for(const result of [{status:'rejected',code:'not_primary_director'},{status:'rejected',code:'duplicate_official'}]){
  let emails=0;assert.deepEqual(await saveSetupOfficialInvitation({rpc:async()=>({data:result,error:null})},input,async()=>{emails++;return true;}),result);assert.equal(emails,0);
 }
});
test('invalid nomination reply cannot reveal a path or trigger delivery',async()=>{
 await assert.rejects(saveSetupOfficialInvitation({rpc:async()=>({data:{status:'official_pending_email',nominationId:'../bad'},error:null})},input,async()=>{throw Error('must not send');}));
});
test('context reader validates exact server shape, matching ID and accepted reconciliation',async()=>{
 for(const status of ['pending','accepted']){
  const r=await getOfficialInvitationContext({rpc:async(name,args)=>{assert.equal(name,'get_setup_official_invitation_context_v1');assert.deepEqual(args,{p_actor_id:id,p_nomination_id:id});return{data:{...context,status},error:null};}},id,id);
  assert.equal(r.status,status);
 }
 assert.equal(await getOfficialInvitationContext({rpc:async()=>({data:null,error:null})},id,id),null);
 for(const data of [{...context,role:'director'},{...context,extra:true},{...context,expiresAt:'bad'},{...context,status:'active'},{...context,nominationId:'00000000-0000-4000-8000-000000000002'}])await assert.rejects(getOfficialInvitationContext({rpc:async()=>({data,error:null})},id,id));
 assert.equal(isOfficialInvitationContext(context),true);
 await assert.rejects(getOfficialInvitationContext({rpc:async()=>({data:null,error:{}})},id,id));
});
test('routes preserve actor, origin, bounded bodies, unchanged acceptance and no-store readers',async()=>{
 const route=await readFile('src/app/api/v1/official-invitations/[secret]/route.ts','utf8');
 assert.match(route,/export async function GET/);assert.match(route,/requireVerifiedSubject\(await createClient\(\)\)/);
 assert.match(route,/isSameOriginRequest\(request\)/);assert.match(route,/isEmptyAcceptanceRequest\(body\)/);assert.match(route,/acceptSetupOfficialById/);assert.match(route,/acceptCoDirector/);
 const migration=await readFile('database/migrations/0238_official_invitation_context.sql','utf8');
 assert.match(migration,/security definer set search_path=''/);assert.match(migration,/service_role/);
 assert.match(migration,/pg_catalog\.lower\(u.email\)=n.email_normalized/);assert.match(migration,/n.accepted_profile_id=p_actor_id/);assert.match(migration,/invitation_expires_at>pg_catalog.clock_timestamp\(\)/);
 assert.match(migration,/from public,anon,authenticated/);assert.match(migration,/to service_role/);
 assert.doesNotMatch(migration,/\b(insert|update|delete|alter|drop)\b/i);
});
test('public invitation page treats missing or broken claims as signed out, while APIs stay strict',async()=>{
 const page=await readFile('src/app/official-invitations/[secret]/page.tsx','utf8');
 const subject=await readFile('src/lib/auth/current-subject.ts','utf8');
 assert.match(page,/const actorId = await getCurrentSubject\(\)/);assert.doesNotMatch(page,/requireVerifiedSubject/);
 assert.match(page,/signedIn=\{!!actorId\}/);assert.match(subject,/if \(error\) return null/);assert.match(subject,/catch \{\s*return null/);
 const client=await readFile('src/app/official-invitations/[secret]/official-invitation-client.tsx','utf8');
 assert.match(client,/href=\{`\/sign-in\?next=\$\{encodeURIComponent/);
});
