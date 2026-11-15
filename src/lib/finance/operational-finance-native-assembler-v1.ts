/** Server-side independent reconstruction of the private native SQL basis.
 * No public route or provider is enabled by this module. */
import 'server-only';
import {createHash} from 'node:crypto';
import {resolveEventPlayoffParametersDraftV1} from '../playoffs/event-playoff-parameters-v1.ts';
import {isOperationalFinanceEstimateBasisV1,type OperationalFinanceEstimateBasisV1} from './operational-finance-estimate-basis-v1.ts';
import type {EventFinanceWorkspaceV1,FinanceNamedRecordV1} from './event-finance-workspace-v1.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d&&d.enumerable;});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v===v.trim()&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)===JSON.stringify(b,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export type NativeOperationalFinanceAssemblyV1={actorId:string;tournamentId:string;eventId:string;basisDigest:string;basis:OperationalFinanceEstimateBasisV1;proposalOnly:true;moneyMoved:false;finalizationAuthorized:false;payoutAuthorized:false};
/** Scope is supplied by the authenticated server, never taken from posted JSON.
 * Digests remain opaque PostgreSQL JSONB digests; equality is not provider proof. */
export function assembleNativeOperationalFinanceV1(value:unknown,scope:{actorId:string;tournamentId:string;eventId:string}):NativeOperationalFinanceAssemblyV1|null{
 if(![scope.actorId,scope.tournamentId,scope.eventId].every(uuid)||!exact(value,['status','kind','actorId','tournamentId','eventId','sourceDigest','raw','basis','basisDigest','proposalOnly','moneyMoved','finalizationAuthorized','payoutAuthorized'])
 ||value.status!=='source_available'||value.kind!=='operational-event-finance-source-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!hash(value.sourceDigest)||!hash(value.basisDigest)||value.proposalOnly!==true||value.moneyMoved!==false||value.finalizationAuthorized!==false||value.payoutAuthorized!==false
 ||!exact(value.raw,['binding','event','settings','allocation','counts','qualification','coverage']))return null;
 const r=value.raw;
 if(!exact(r.binding,['bindingId','activationId','setupEventVersionId','settingsSnapshotId','reviewId'])||!Object.values(r.binding).every(uuid)
 ||!exact(r.event,['tournamentName','eventName','eventKind','format','operationalState','startLabel'])||![r.event.tournamentName,r.event.eventName,r.event.startLabel].every(text)||!['main','consolation'].includes(r.event.eventKind as string)||r.event.format!=='standard_singles'||r.event.operationalState!=='active'
 ||!exact(r.settings,['draft','context'])||!exact(r.counts,['activeParticipants','paidEligibleEntries'])||!whole(r.counts.activeParticipants)||(r.counts.paidEligibleEntries!==null&&(!whole(r.counts.paidEligibleEntries)||r.counts.paidEligibleEntries>r.counts.activeParticipants))
 ||!exact(r.allocation,['revisionId','version','sourceDigest','createdAt','eventSources'])||!uuid(r.allocation.revisionId)||!whole(r.allocation.version)||r.allocation.version<1||!hash(r.allocation.sourceDigest)||typeof r.allocation.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.allocation.createdAt)||!Number.isFinite(Date.parse(r.allocation.createdAt))||!Array.isArray(r.allocation.eventSources)||r.allocation.eventSources.length>10000)return null;
 const settings=resolveEventPlayoffParametersDraftV1(r.settings.draft);if(!settings)return null;
 if(!exact(r.settings.context,['sanctioned','durationDays','eventKind','originalEntrants'])||typeof r.settings.context.sanctioned!=='boolean'||!whole(r.settings.context.durationDays)||r.settings.context.durationDays<1||r.settings.context.eventKind!==r.event.eventKind||r.settings.context.originalEntrants!==null)return null;
 let qualifiers:number|null=null;
 if(r.qualification!==null){if(!exact(r.qualification,['resultVersionId','version','participantCount','qualifierCount'])||!uuid(r.qualification.resultVersionId)||!whole(r.qualification.version)||r.qualification.version<1||!whole(r.qualification.participantCount)||r.qualification.participantCount<1||!whole(r.qualification.qualifierCount)||r.qualification.qualifierCount!==Math.ceil(r.qualification.participantCount/4))return null;qualifiers=r.qualification.qualifierCount;}
 const source={tournamentId:scope.tournamentId,eventId:scope.eventId,sourceVersion:r.allocation.version,sourceDigest:value.sourceDigest};
 const history:FinanceNamedRecordV1[]=[],seen=new Set<string>(),evidence=new Set<string>(),identities=new Set<string>();let gross=BigInt(0),expenses=BigInt(0);
 const sources=[...r.allocation.eventSources];
 for(const s of sources)if(!exact(s,['sourceId','physicalEvidenceId','kind','amountMinor','state','allocations'])||!uuid(s.sourceId)||!uuid(s.physicalEvidenceId)||s.sourceId!==s.physicalEvidenceId||seen.has(s.sourceId)||evidence.has(s.physicalEvidenceId)||!['entry_receipt','expense'].includes(s.kind as string)||s.state!=='active'||!whole(s.amountMinor)||s.amountMinor<1||!Array.isArray(s.allocations)||!s.allocations.length||s.allocations.length>3)return null;else{seen.add(s.sourceId);evidence.add(s.physicalEvidenceId);}
 sources.sort((a,b)=>(a.sourceId as string).localeCompare(b.sourceId as string));
 for(const s of sources){let allocated=BigInt(0);const buckets=new Set<string>();const parts=[...(s.allocations as unknown[])];
  for(const p of parts)if(!exact(p,['eventId','bucket','poolId','amountMinor','classificationReviewed'])||p.eventId!==scope.eventId||p.poolId!==null||p.classificationReviewed!==true||!['regular_entry','player_benefit','operating_expense'].includes(p.bucket as string)||!whole(p.amountMinor)||p.amountMinor<1||buckets.has(p.bucket as string)||(s.kind==='entry_receipt')!==(p.bucket==='regular_entry'))return null;else buckets.add(p.bucket as string);
  parts.sort((a,b)=>((a as Record<string,string>).bucket).localeCompare((b as Record<string,string>).bucket));
  for(const p of parts as Array<{bucket:'regular_entry'|'player_benefit'|'operating_expense';amountMinor:number}>){allocated+=BigInt(p.amountMinor);if(p.bucket==='regular_entry'){gross+=BigInt(p.amountMinor);continue;}expenses+=BigInt(p.amountMinor);
   const md=createHash('md5').update(`operational-finance-basis-line-v1|${scope.tournamentId}|${scope.eventId}|${r.allocation.revisionId}|${s.sourceId}|${p.bucket}`,'utf8').digest('hex'),lineId=`${md.slice(0,8)}-${md.slice(8,12)}-${md.slice(12,16)}-${md.slice(16,20)}-${md.slice(20)}`;
   if(identities.has(lineId))return null;identities.add(lineId);
   history.push({label:p.bucket==='player_benefit'?'Allocated Player Benefit':'Allocated Operating Expense',line:{recordId:lineId,lineId,priorRecordId:null,source:structuredClone(source),mode:'estimate',category:p.bucket,amountMinor:p.amountMinor,voided:false,reason:'Recorded allocation basis'}});
  }if(allocated>BigInt(s.amountMinor as number))return null;
 }
 if(gross>BigInt(Number.MAX_SAFE_INTEGER)||expenses>BigInt(Number.MAX_SAFE_INTEGER))return null;
 const workspace:EventFinanceWorkspaceV1={complete:true,source,mode:'estimate',tournamentName:r.event.tournamentName as string,eventName:r.event.eventName as string,eventKind:r.event.eventKind as 'main'|'consolation',startLabel:r.event.startLabel as string,entryCount:r.counts.activeParticipants,paidEntryCount:r.counts.paidEligibleEntries as number|null,qualifierCount:qualifiers,grossEntryMinor:Number(gross),history,settings:settings.payout,payoutSource:{tournamentId:scope.tournamentId,eventId:scope.eventId,settingsSnapshotId:r.binding.settingsSnapshotId as string,ledgerDigest:value.sourceDigest,resultsDigest:value.sourceDigest},savedAt:r.allocation.createdAt,overrideHistory:[]};
 const basis={kind:'operational-finance-estimate-basis-v1',sourceDigest:value.sourceDigest,coverage:r.coverage,workspace};
 if(!isOperationalFinanceEstimateBasisV1(basis)||!same(basis,value.basis))return null;
 return{actorId:scope.actorId,tournamentId:scope.tournamentId,eventId:scope.eventId,basisDigest:value.basisDigest,basis:structuredClone(basis),proposalOnly:true,moneyMoved:false,finalizationAuthorized:false,payoutAuthorized:false};
}
