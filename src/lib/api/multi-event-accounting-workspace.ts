import {isUuid} from './validation.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const code=(v:unknown):v is string=>typeof v==='string'&&/^[a-z_]{1,80}$/.test(v);
const version=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=256;
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const amount=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=100_000_000;
export type JointReview={eventId:string;name:string;sourceDigest:string;baseMinor:number;expenseMinor:number;regularMinor:number;qMinor:number;sideMinor:number;restrictedMinor:number;fundingMinor:number};
function reviewEvents(manifest:Record<string,unknown>,names:Record<string,string>):JointReview[]|null {
 if(!Array.isArray(manifest.events)||manifest.events.length!==2)return null;
 const result:JointReview[]=[];
 for(const e of manifest.events){
  if(!object(e)||!isUuid(e.eventId)||!hash(e.sourceDigest)||!object(e.preview))return null;const p=e.preview,name=names[e.eventId];
  if(typeof name!=='string'||!name.trim()||name.length>200||/[\u0000-\u001f\u007f]/.test(name)||p.status!=='preview'||p.eventId!==e.eventId||p.sourceDigest!==e.sourceDigest||p.moneyMoved!==false||p.accountingAvailable!==false||!['baseIncomeMinor','expenseMinor','qIncomeMinor','sideIncomeMinor','restrictedResidualMinor','requiredFundingMinor'].every(k=>amount(p[k]))||!Array.isArray(p.regularAwards)||![4,5].includes(p.regularAwards.length)||!Array.isArray(p.pools)||p.pools.length>8)return null;
  let regular=0,q=0,side=0;const people=new Set<string>();
  for(const a of p.regularAwards){if(!object(a)||!isUuid(a.participantId)||people.has(a.participantId)||!amount(a.amountMinor)||a.amountMinor===0||a.amountMinor%500!==0)return null;people.add(a.participantId);regular+=a.amountMinor;}
  for(const pool of p.pools){if(!object(pool)||(pool.kind!=='q'&&pool.kind!=='side')||!object(pool.calculation))return null;const c=pool.calculation;if(c.status!=='calculated'||c.moneyMoved!==false||!amount(c.fundMinor)||!Array.isArray(c.awards)||c.awards.length>256)return null;let total=0;const recipients=new Set<string>();for(const a of c.awards){if(!object(a)||!isUuid(a.participantId)||recipients.has(a.participantId)||!amount(a.amountMinor)||a.amountMinor%500!==0)return null;recipients.add(a.participantId);total+=a.amountMinor;}if(total!==c.fundMinor)return null;if(pool.kind==='q')q+=total;else side+=total;}
  if(q!==p.qIncomeMinor||side!==p.sideIncomeMinor||regular+Number(p.expenseMinor)+Number(p.restrictedResidualMinor)!==Number(p.baseIncomeMinor)+Number(p.requiredFundingMinor))return null;
  result.push({eventId:e.eventId,name,sourceDigest:e.sourceDigest,baseMinor:Number(p.baseIncomeMinor),expenseMinor:Number(p.expenseMinor),regularMinor:regular,qMinor:q,sideMinor:side,restrictedMinor:Number(p.restrictedResidualMinor),fundingMinor:Number(p.requiredFundingMinor)});
 }
 return new Set(result.map(e=>e.eventId)).size===result.length?result:null;
}
function validReview(v:unknown):v is JointReview {return object(v)&&exact(v,['eventId','name','sourceDigest','baseMinor','expenseMinor','regularMinor','qMinor','sideMinor','restrictedMinor','fundingMinor'])&&isUuid(v.eventId)&&typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=200&&hash(v.sourceDigest)&&['baseMinor','expenseMinor','regularMinor','qMinor','sideMinor','restrictedMinor','fundingMinor'].every(k=>amount(v[k]))&&Number(v.regularMinor)+Number(v.expenseMinor)+Number(v.restrictedMinor)===Number(v.baseMinor)+Number(v.fundingMinor);}
export type AccountingWorkspace={tournamentId:string;eventId:string;draftVersion:number;draftSourceDigest:string|null;closureDigest:string|null;readiness:{ready:boolean;sourceDigest:string|null;code:string|null};joint:{ready:boolean;jointDigest:string|null;eventCount:number;code:string|null;events:JointReview[]};final:null|{id:string;jointDigest:string;eventCount:number;recordedAt:string;events:JointReview[]};moneyMoved:false;humanReviewClaimed:false};
export function isAccountingWorkspace(v:unknown,tid:string,eid:string):v is AccountingWorkspace {
 if(!object(v)||!exact(v,['tournamentId','eventId','draftVersion','draftSourceDigest','closureDigest','readiness','joint','final','moneyMoved','humanReviewClaimed'])||v.tournamentId!==tid||v.eventId!==eid||!version(v.draftVersion)||v.moneyMoved!==false||v.humanReviewClaimed!==false||!(v.draftSourceDigest===null||hash(v.draftSourceDigest))||((v.draftSourceDigest===null)!==(v.draftVersion===0))||!(v.closureDigest===null||hash(v.closureDigest))||!object(v.readiness)||!object(v.joint))return false;
 const r=v.readiness,j=v.joint;
 if(!exact(r,['ready','sourceDigest','code'])||typeof r.ready!=='boolean'||(r.ready?!hash(r.sourceDigest)||r.code!==null:r.sourceDigest!==null||!code(r.code)))return false;
 if(!exact(j,['ready','jointDigest','eventCount','code','events'])||typeof j.ready!=='boolean'||typeof j.eventCount!=='number'||!Number.isInteger(j.eventCount)||!Array.isArray(j.events)||j.events.length!==j.eventCount||!j.events.every(validReview)||new Set(j.events.map(e=>e.eventId)).size!==j.events.length||(j.ready?!hash(j.jointDigest)||j.code!==null||j.eventCount!==2||!j.events.some(e=>e.eventId===eid&&e.sourceDigest===v.draftSourceDigest):j.jointDigest!==null||j.eventCount!==0||!code(j.code)))return false;
 return v.final===null||(object(v.final)&&exact(v.final,['id','jointDigest','eventCount','recordedAt','events'])&&isUuid(v.final.id)&&hash(v.final.jointDigest)&&typeof v.final.eventCount==='number'&&Number.isInteger(v.final.eventCount)&&v.final.eventCount===2&&Array.isArray(v.final.events)&&v.final.events.length===v.final.eventCount&&v.final.events.every(validReview)&&new Set(v.final.events.map(e=>e.eventId)).size===v.final.events.length&&v.final.events.some(e=>e.eventId===eid)&&typeof v.final.recordedAt==='string'&&Number.isFinite(Date.parse(v.final.recordedAt)));
}
/** Project service-only facts; never send raw financial evidence manifests to the browser. */
export function projectAccountingWorkspace(event:unknown,joint:unknown,final:unknown,tid:string,eid:string,names:Record<string,string>={}):AccountingWorkspace|null {
 if(!object(event)||!exact(event,['tournamentId','eventId','currentDraftVersion','draft','closure','readiness'])||event.tournamentId!==tid||event.eventId!==eid||!version(event.currentDraftVersion)||!object(event.readiness)||!object(joint)||!object(final))return null;
 const draft=event.draft,closure=event.closure,r=event.readiness;
 if(draft!==null&&(!object(draft)||!exact(draft,['id','version','sourceDigest'])||!isUuid(draft.id)||draft.version!==event.currentDraftVersion||!hash(draft.sourceDigest)))return null;
 if((draft===null)!==(event.currentDraftVersion===0))return null;
 if(closure!==null&&(!object(closure)||!exact(closure,['id','sourceDigest'])||!isUuid(closure.id)||!hash(closure.sourceDigest)))return null;
 if((r.moneyMoved!==undefined&&r.moneyMoved!==false)||(r.humanReviewClaimed!==undefined&&r.humanReviewClaimed!==false)||(r.physicalPlayClaimed!==undefined&&r.physicalPlayClaimed!==false)||(joint.moneyMoved!==undefined&&joint.moneyMoved!==false)||(joint.humanReviewClaimed!==undefined&&joint.humanReviewClaimed!==false))return null;
 const ready=r.status==='candidate_ready';
 if(ready?(r.eventId!==eid||!hash(r.sourceDigest)||r.moneyMoved!==false||r.humanReviewClaimed!==false||r.physicalPlayClaimed!==false):r.status!=='blocked'||!code(r.code))return null;
 const jointReady=joint.status==='candidate_ready';let count=0,reviews:JointReview[]=[];
 if(jointReady){if(joint.tournamentId!==tid||!hash(joint.jointDigest)||joint.moneyMoved!==false||joint.humanReviewClaimed!==false||!object(joint.manifest)||joint.manifest.tournamentId!==tid||joint.manifest.moneyMoved!==false||joint.manifest.humanReviewClaimed!==false||!Array.isArray(joint.manifest.events)||joint.manifest.events.length!==2||!joint.manifest.events.every(v=>object(v)&&isUuid(v.eventId))||new Set(joint.manifest.events.map(v=>(v as Record<string,unknown>).eventId)).size!==joint.manifest.events.length)return null;count=joint.manifest.events.length;}
 else if(joint.status!=='blocked'||!code(joint.code))return null;
 if(jointReady){const values=reviewEvents(joint.manifest as Record<string,unknown>,names);if(!values||!values.some(e=>e.eventId===eid))return null;reviews=values;}
 let saved:AccountingWorkspace['final']=null;
 if(final.status==='not_finalized'){if(final.tournamentId!==tid||final.financialClosed!==false||final.moneyMoved!==false)return null;}
 else if(final.status==='synthetic_joint_unpaid_finalized'){
  if(final.tournamentId!==tid||!isUuid(final.jointFinalId)||!hash(final.jointDigest)||final.financialClosed!==true||final.moneyMoved!==false||final.humanReviewClaimed!==false||typeof final.recordedAt!=='string'||!Number.isFinite(Date.parse(final.recordedAt))||!object(final.manifest)||final.manifest.tournamentId!==tid||final.manifest.moneyMoved!==false||final.manifest.humanReviewClaimed!==false||!Array.isArray(final.manifest.events)||final.manifest.events.length!==2||!final.manifest.events.every(v=>object(v)&&isUuid(v.eventId))||new Set(final.manifest.events.map(v=>(v as Record<string,unknown>).eventId)).size!==final.manifest.events.length)return null;
  const values=reviewEvents(final.manifest,names);if(!values||!values.some(e=>e.eventId===eid))return null;
  saved={id:final.jointFinalId,jointDigest:final.jointDigest,eventCount:final.manifest.events.length,recordedAt:final.recordedAt,events:values};
 }else return null;
 return {tournamentId:tid,eventId:eid,draftVersion:event.currentDraftVersion,draftSourceDigest:object(draft)?draft.sourceDigest as string:null,closureDigest:object(closure)?closure.sourceDigest as string:null,readiness:{ready,sourceDigest:ready?r.sourceDigest as string:null,code:ready?null:r.code as string},joint:{ready:jointReady,jointDigest:jointReady?joint.jointDigest as string:null,eventCount:count,code:jointReady?null:joint.code as string,events:reviews},final:saved,moneyMoved:false,humanReviewClaimed:false};
}
