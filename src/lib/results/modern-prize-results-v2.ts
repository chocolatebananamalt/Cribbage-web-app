import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {decodeModernPrizeAwardRecordV2} from '../finance/native-final-award-record-v1.ts';
import {readNativeRecordedFundReviewSourceV1} from '../finance/native-recorded-fund-review-source-v1.ts';
import {readPlayoffPrizeProposalWorkspaceV2} from '../finance/playoff-prize-proposal-store-v2.ts';
import {projectNativeFinalRecipientEstimateV1} from '../finance/native-playoff-recipient-v1.ts';
import {modernPrizeFundResultEvidenceV2,modernPrizeWorkspaceResultEvidenceV2} from './modern-prize-result-evidence-v2.ts';
import {isModernPrizeScopeV2,modernPrizeSameV2,type ModernPrizeScopeV2} from '../finance/modern-prize-journal-contract-v2.ts';
export const modernPrizeResultsEnabledV2=()=>integratedTestFeatureEnabled();
export type ModernPrizeResultsV2={status:'available';eventKind:'main'|'consolation';method:'equal'|'winner-takes-all'|'graduated'|'winner-multiplier';directorAdjusted?:boolean;roundingUnitMinor:number;totalMinor:number;recordedAt:string;sourceObservation:'locked_database_capture';moneyMoved:false;payoutAuthorized:false;groups:Array<{firstPlace:number;lastPlace:number;included:boolean;perPersonMinor:number;groupTotalMinor:number;members:Array<{name:string;tournamentPlayerId:string}>}>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
/** Projection only. A historical receipt cannot independently produce Results. */
export function projectModernPrizeResultsV2(value:unknown,scope:ModernPrizeScopeV2,expectedQualificationResultVersionId:string):ModernPrizeResultsV2|null{try{
 if(!isModernPrizeScopeV2(scope)||!exact(value,['kind','status','actorId','tournamentId','eventId','record','facts','snapshotConsistency','moneyMoved','payoutAuthorized','writeAuthorized','bankReceiptVerified'])||value.kind!=='current-modern-prize-results-v2'||value.status!=='source_available'||!Object.entries(scope).every(([k,v])=>value[k]===v)||value.snapshotConsistency!=='locked_source_snapshot'||['moneyMoved','payoutAuthorized','writeAuthorized','bankReceiptVerified'].some(k=>value[k]!==false)||!exact(value.facts,['fundCapture','prizeWorkspace','feeHeads','feeEntrants']))return null;
 const record=decodeModernPrizeAwardRecordV2(value.record,scope),fund=readNativeRecordedFundReviewSourceV1(value.facts.fundCapture,scope),workspace=readPlayoffPrizeProposalWorkspaceV2(value.facts.prizeWorkspace,scope);
 if(record.status!=='recorded_unpaid_modern_awards'||!fund||!workspace||workspace.stale||!workspace.head||!object(value.record)||!object(value.record.sourceCapture))return null;
 const sporting=projectNativeFinalRecipientEstimateV1(fund.recipientSource,scope),stored=value.record.sourceCapture as {fundSource:{capture:unknown};prizeWorkspace:unknown;entryFeeSource?:{heads:unknown;evidence:{entrants:unknown}}|null};
 if(sporting.status!=='recipient_estimate'||!modernPrizeSameV2(modernPrizeFundResultEvidenceV2(fund),modernPrizeFundResultEvidenceV2(stored.fundSource.capture))||!modernPrizeSameV2(modernPrizeWorkspaceResultEvidenceV2(workspace),modernPrizeWorkspaceResultEvidenceV2(stored.prizeWorkspace)))return null;
 const sorted=(rows:unknown)=>Array.isArray(rows)?[...rows].sort((a,b)=>String(a?.participantId).localeCompare(String(b?.participantId))):null;
 if(stored.entryFeeSource){if(!Array.isArray(value.facts.feeHeads)||!Array.isArray(value.facts.feeEntrants)||!modernPrizeSameV2(sorted(value.facts.feeHeads),sorted(stored.entryFeeSource.heads))||!modernPrizeSameV2(sorted(value.facts.feeEntrants),sorted(stored.entryFeeSource.evidence.entrants)))return null;}
 else if(value.facts.feeHeads!==null||value.facts.feeEntrants!==null)return null;
 const raw=fund.recipientSource as {nativeFinanceSource:{raw:{event:{eventKind:string};qualification:{resultVersionId:string}}}},kind=raw.nativeFinanceSource.raw.event.eventKind;
 if(raw.nativeFinanceSource.raw.qualification.resultVersionId!==expectedQualificationResultVersionId)return null;
 if(kind!=='main'&&kind!=='consolation')return null;
 return{status:'available',eventKind:kind,method:record.plan.method as ModernPrizeResultsV2['method'],roundingUnitMinor:record.roundingUnitMinor,totalMinor:record.totalMinor,directorAdjusted:record.manualAdjustments.length>0,recordedAt:record.recordedAt as string,sourceObservation:'locked_database_capture',moneyMoved:false,payoutAuthorized:false,groups:record.groups.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,included:g.included,perPersonMinor:g.perPersonMinor,groupTotalMinor:g.groupTotalMinor,members:record.recipients.filter(p=>p.firstPlace===g.firstPlace&&p.lastPlace===g.lastPlace).map(p=>({name:p.displayName,tournamentPlayerId:p.tournamentPlayerId}))}))};
 }catch{return null;}}
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function readModernPrizeResultsV2(client:Client,scope:ModernPrizeScopeV2,enabled:()=>boolean,expectedQualificationResultVersionId:string):Promise<ModernPrizeResultsV2|null>{
 if(!enabled()||!isModernPrizeScopeV2(scope)||typeof expectedQualificationResultVersionId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(expectedQualificationResultVersionId))return null;const fixed=Object.freeze({...scope});
 const authorized=async()=>{if(!enabled())return false;const r=await client.auth.getUser();return !r.error&&r.data?.user?.id===fixed.actorId&&enabled();};
 try{if(!await authorized())return null;const r=await client.rpc('get_current_modern_prize_results_provider_v2',{p_tid:fixed.tournamentId,p_eid:fixed.eventId});if(r.error||!await authorized())return null;return projectModernPrizeResultsV2(r.data,fixed,expectedQualificationResultVersionId);}catch{return null;}
}
