import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {projectEventLedgerV1} from './event-ledger-projection-v1.ts';
import {readSatelliteFinanceWorkspaceV1} from './satellite-finance-contract-v1.ts';
type Scope={actorId:string;tournamentId:string;eventId:string};
type Income={id:string;version:number;incomeId:string;priorRecordId:string|null;physicalEvidenceId:string;evidenceReference:string;amountMinor:number;voided:boolean;label:string;reason:string;recordedBy:string;recordedAt:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).sort().join()===keys.sort().join();
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const text=(v:unknown,max=500):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim()&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
const stamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
/** Current protected native source only, never client authority or bank proof. */
export function readSatelliteFundReviewV1(value:unknown,scope:Scope){try{
 if(!exact(scope,['actorId','tournamentId','eventId'])||!Object.values(scope).every(uuid)||!exact(value,['kind','actorId','tournamentId','eventId','capture','sourceDigest','reviewHeadVersion','latestReview','bankReceiptVerified','moneyMoved','payoutAuthorized'])||value.kind!=='satellite-fund-source-v1'||!Object.entries(scope).every(([k,v])=>value[k]===v)||!hash(value.sourceDigest)||!whole(value.reviewHeadVersion)||value.bankReceiptVerified!==false||value.moneyMoved!==false||value.payoutAuthorized!==false||!exact(value.capture,['activation','allocation','incomeHeadVersion','incomeRecords','totals']))return null;
 const c=value.capture,a=c.allocation;
 if(!exact(c.activation,['activationId','setupEventVersionId','setupRevisionId'])||!Object.values(c.activation).every(uuid)||!exact(a,['status','revisionId','version','snapshot','fundAvailable','moneyMoved','payoutAuthorized'])||a.status!=='current'||!uuid(a.revisionId)||!whole(a.version)||a.version<1||a.fundAvailable!==true||a.moneyMoved!==false||a.payoutAuthorized!==false)return null;
 const ledger=projectEventLedgerV1({eventId:scope.eventId,current:a.snapshot,retained:a.snapshot});
 if(ledger.status!=='projected'||ledger.mode!=='documented_actual'||(ledger.reviewRequired&&ledger.regularFundMinor>=0)||ledger.tournamentId!==scope.tournamentId||!object(a.snapshot)||a.snapshot.sourceVersion!==a.version)return null;
 // Satellite income lives in its separate immutable journal, not both domains.
 if(!Array.isArray(a.snapshot.sources)||a.snapshot.sources.some(s=>!object(s)||s.kind==='additional_income'||!Array.isArray(s.allocations)||s.allocations.some(p=>!object(p)||p.classificationReviewed!==true)))return null;
 if(!whole(c.incomeHeadVersion)||!Array.isArray(c.incomeRecords)||c.incomeRecords.length!==c.incomeHeadVersion||c.incomeRecords.length>10000)return null;
 const heads=new Map<string,Income>(),ids=new Set<string>(),physical=new Map<string,string>(),refs=new Map<string,string>();
 const reserved=new Set(a.snapshot.sources.flatMap(s=>object(s)?[s.sourceId,s.physicalEvidenceId]:[]));
 for(const raw of c.incomeRecords){
  if(!exact(raw,['id','version','incomeId','priorRecordId','physicalEvidenceId','evidenceReference','amountMinor','voided','label','reason','recordedBy','recordedAt'])||![raw.id,raw.incomeId,raw.physicalEvidenceId,raw.recordedBy].every(uuid)||(raw.priorRecordId!==null&&!uuid(raw.priorRecordId))||raw.version!==ids.size+1||ids.has(raw.id as string)||reserved.has(raw.physicalEvidenceId)||!whole(raw.amountMinor)||typeof raw.voided!=='boolean'||(raw.voided?raw.amountMinor!==0:raw.amountMinor===0)||!text(raw.label,200)||!text(raw.reason)||!text(raw.evidenceReference)||!stamp(raw.recordedAt))return null;
  const r=raw as Income,prior=heads.get(r.incomeId);if(r.priorRecordId!==(prior?.id??null)||(!prior&&r.voided)||prior&&(prior.physicalEvidenceId!==r.physicalEvidenceId||prior.evidenceReference!==r.evidenceReference)||physical.has(r.physicalEvidenceId)&&physical.get(r.physicalEvidenceId)!==r.incomeId||refs.has(r.evidenceReference.toLowerCase())&&refs.get(r.evidenceReference.toLowerCase())!==r.incomeId)return null;
  ids.add(r.id);heads.set(r.incomeId,r);physical.set(r.physicalEvidenceId,r.incomeId);refs.set(r.evidenceReference.toLowerCase(),r.incomeId);
 }
 const income=[...heads.values()].reduce((n,r)=>n+(r.voided?BigInt(0):BigInt(r.amountMinor)),BigInt(0)),fund=BigInt(ledger.regularFundMinor)+income;
 if(income>BigInt(Number.MAX_SAFE_INTEGER)||fund>BigInt(Number.MAX_SAFE_INTEGER)||fund<BigInt(-Number.MAX_SAFE_INTEGER)||!exact(c.totals,['regularEntryMinor','benefitMinor','expenseMinor','additionalIncomeMinor','fundMinor']))return null;
 if(c.totals.regularEntryMinor!==ledger.totals.regular_entry||c.totals.benefitMinor!==ledger.totals.player_benefit||c.totals.expenseMinor!==ledger.totals.operating_expense||c.totals.additionalIncomeMinor!==Number(income)||c.totals.fundMinor!==Number(fund))return null;
 const r=value.latestReview;let current=false;
 if(r===null){if(value.reviewHeadVersion!==0)return null;}
 else{if(!exact(r,['id','version','sourceDigest','status','reason','recordedBy','recordedAt'])||![r.id,r.recordedBy].every(uuid)||r.version!==value.reviewHeadVersion||!whole(r.version)||!r.version||!hash(r.sourceDigest)||!['reviewed_zero','recorded_complete'].includes(r.status as string)||!text(r.reason)||!stamp(r.recordedAt))return null;current=r.sourceDigest===value.sourceDigest&&r.status===(income===BigInt(0)?'reviewed_zero':'recorded_complete')&&fund>=BigInt(0);}
 return{status:'satellite_fund_review' as const,...scope,sourceDigest:value.sourceDigest,allocationRevisionId:a.revisionId,allocationVersion:a.version,
  incomeHeadVersion:c.incomeHeadVersion,reviewHeadVersion:value.reviewHeadVersion,sourceCapture:structuredClone(c),latestReview:structuredClone(r),
  regularEntryMinor:ledger.totals.regular_entry,benefitMinor:ledger.totals.player_benefit,expenseMinor:ledger.totals.operating_expense,additionalIncomeMinor:Number(income),fundMinor:Number(fund),
  incomeHeads:structuredClone([...heads.values()]),reviewCurrent:current,reviewStatus:current?'director_declared_recorded_coverage' as const:r===null?'not_reviewed' as const:'stale' as const,
  held:!current||fund<BigInt(0),bankReceiptVerified:false as const,awardCalculationPerformed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
 }catch{return null;}}
export type SatelliteFundViewV1=NonNullable<ReturnType<typeof readSatelliteFundReviewV1>>;
/** Browser authoring gets only this event's amounts and current income heads,
 * never the native multi-event allocation or private source capture. */
export function projectSatelliteFinanceWorkspaceV1(v:SatelliteFundViewV1){return readSatelliteFinanceWorkspaceV1({kind:'satellite-finance-workspace-v1',actorId:v.actorId,tournamentId:v.tournamentId,eventId:v.eventId,sourceDigest:v.sourceDigest,incomeHeadVersion:v.incomeHeadVersion,reviewHeadVersion:v.reviewHeadVersion,regularEntryMinor:v.regularEntryMinor,benefitMinor:v.benefitMinor,expenseMinor:v.expenseMinor,additionalIncomeMinor:v.additionalIncomeMinor,fundMinor:v.fundMinor,reviewCurrent:v.reviewCurrent,reviewStatus:v.reviewStatus,held:v.held,incomeHeads:v.incomeHeads,bankReceiptVerified:false,payoutAuthorized:false,moneyMoved:false},{actorId:v.actorId,tournamentId:v.tournamentId,eventId:v.eventId});}
export const satelliteFundReviewEnabledV1=()=>integratedTestFeatureEnabled();
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(n:string,a:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function loadSatelliteFundReviewV1(o:{scope:Scope;client:()=>Promise<Client>;enabled?:()=>boolean}){
 const on=()=>{try{return(o.enabled??satelliteFundReviewEnabledV1)()===true;}catch{return false;}};
 if(!on()||!exact(o.scope,['actorId','tournamentId','eventId'])||!Object.values(o.scope).every(uuid))return null;
 const s=structuredClone(o.scope);try{const c=await o.client();async function identity(){
 const a=await c.auth.getClaims(),u=await c.auth.getUser();if(a.error||u.error||a.data?.claims?.sub!==s.actorId||u.data?.user?.id!==s.actorId||!uuid(a.data.claims.session_id)||!on())return null;
 const role=await c.rpc('get_satellite_finance_access_v1',{p_tournament_id:s.tournamentId}),d=structuredClone(role.data),after=await c.auth.getClaims(),user=await c.auth.getUser();
 return!role.error&&exact(d,['actorId','sessionId','tournamentId','primaryDirector'])&&d.actorId===s.actorId&&d.sessionId===a.data.claims.session_id&&d.tournamentId===s.tournamentId&&d.primaryDirector===true&&!after.error&&!user.error&&after.data?.claims?.sub===s.actorId&&after.data.claims.session_id===a.data.claims.session_id&&user.data?.user?.id===s.actorId&&on()?a.data.claims.session_id:null;}
 const sid=await identity();if(!sid)return null;const reply=await c.rpc('get_satellite_fund_source_v1',{p_tournament_id:s.tournamentId,p_event_id:s.eventId}),captured=structuredClone(reply.data);if(reply.error||await identity()!==sid||!on())return null;return readSatelliteFundReviewV1(captured,s);
 }catch{return null;}
}
