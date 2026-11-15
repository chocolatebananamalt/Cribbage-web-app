import type {NativeMixedSimulationScopeV1} from "./native-mixed-simulation-operation-v1.ts";

export type NativeMixedSimulationStartRequestV1 = {kind:"native-mixed-simulation-start-v1";operationId:string;
 expectedContextId:string;expectedScheduleSourceDigest:string;expectedAttendanceSourceDigest:string;
 statement:"fictional-test-only-no-ordinary-attendance-v1";reason:string};
export type NativeMixedSimulationStartReceiptV1 = NativeMixedSimulationScopeV1 & {
 kind:"native-mixed-simulation-start-receipt-v1";status:"accepted";code:"simulated_start_recorded";
 operationId:string;request:NativeMixedSimulationStartRequestV1;startId:string;contextId:string;sourceDigest:string;startedAt:string;
 participantCount:18;gameCount:12;matchCount:108;simulationStarted:true;currentSourceVerified:boolean;historicalReceipt:boolean;
 ordinaryAttendanceUsed:false;normalStartAuthorized:false;scoringAuthorized:false;humanPresenceVerified:false;
 paymentVerified:false;moneyMoved:false;payoutAuthorized:false;finalizationAuthorized:false};
export type NativeMixedSimulationStartOutcomeV1 = NativeMixedSimulationStartReceiptV1 |
 {status:"retry_exact";code:"source_busy"} | {status:"rejected"|"blocked";code:string};
export type NativeMixedSimulationStartedSourceV1 = NativeMixedSimulationScopeV1 & {
 kind:"native-mixed-simulation-start-source-v1";receipt:NativeMixedSimulationStartReceiptV1;currentSourceVerified:true;
 normalStartAuthorized:false;scoringAuthorized:false};

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const iso=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function isNativeMixedSimulationStartRequestV1(v:unknown):v is NativeMixedSimulationStartRequestV1 {
 return exact(v,["kind","operationId","expectedContextId","expectedScheduleSourceDigest","expectedAttendanceSourceDigest","statement","reason"])
 &&v.kind==="native-mixed-simulation-start-v1"&&uuid(v.operationId)&&uuid(v.expectedContextId)
 &&digest(v.expectedScheduleSourceDigest)&&digest(v.expectedAttendanceSourceDigest)
 &&v.statement==="fictional-test-only-no-ordinary-attendance-v1"&&typeof v.reason==="string"&&v.reason===v.reason.trim()
 &&v.reason.length>=1&&v.reason.length<=500&&!/[\u0000-\u001f\u007f]/u.test(v.reason);
}
const falseFlags=["ordinaryAttendanceUsed","normalStartAuthorized","scoringAuthorized","humanPresenceVerified","paymentVerified","moneyMoved","payoutAuthorized","finalizationAuthorized"];
const receiptKeys=["kind","status","code","actorId","tournamentId","eventId","operationId","request","startId","contextId","sourceDigest","startedAt",
 "participantCount","gameCount","matchCount","simulationStarted","currentSourceVerified","historicalReceipt",...falseFlags];
export function readNativeMixedSimulationStartReceiptV1(v:unknown,expected:{scope:NativeMixedSimulationScopeV1;request:NativeMixedSimulationStartRequestV1;historicalOnly?:boolean}):NativeMixedSimulationStartReceiptV1|null {
 if(!isNativeMixedSimulationStartRequestV1(expected.request)||!exact(v,receiptKeys)||v.kind!=="native-mixed-simulation-start-receipt-v1"
 ||v.status!=="accepted"||v.code!=="simulated_start_recorded"||v.actorId!==expected.scope.actorId||v.tournamentId!==expected.scope.tournamentId
 ||v.eventId!==expected.scope.eventId||v.operationId!==expected.request.operationId||!same(v.request,expected.request)
 ||!uuid(v.startId)||v.contextId!==expected.request.expectedContextId||!digest(v.sourceDigest)||!iso(v.startedAt)
 ||v.participantCount!==18||v.gameCount!==12||v.matchCount!==108||v.simulationStarted!==true||falseFlags.some(k=>v[k]!==false)
 ||!(v.historicalReceipt===true&&v.currentSourceVerified===false||v.historicalReceipt===false&&v.currentSourceVerified===true)
 ||expected.historicalOnly===true&&v.historicalReceipt!==true)return null;
 return structuredClone(v)as NativeMixedSimulationStartReceiptV1;
}
export function readNativeMixedSimulationStartOutcomeV1(v:unknown,expected:{scope:NativeMixedSimulationScopeV1;request:NativeMixedSimulationStartRequestV1}):NativeMixedSimulationStartOutcomeV1|null {
 const receipt=readNativeMixedSimulationStartReceiptV1(v,expected);if(receipt)return receipt;
 if(!exact(v,["status","code"]))return null;
 if(v.status==="retry_exact"&&v.code==="source_busy")return {status:"retry_exact",code:"source_busy"};
 const rejected=["feature_unavailable","invalid_request","idempotency_conflict","test_scope_required","operation_conflict","simulation_already_started","draw_terminal","publication_or_readiness_changed"];
 if(v.status==="rejected"&&rejected.includes(v.code as string)||v.status==="blocked"&&v.code==="operation_history_unavailable")return structuredClone(v)as NativeMixedSimulationStartOutcomeV1;
 return null;
}
export function readNativeMixedSimulationStartedSourceV1(v:unknown,expected:{scope:NativeMixedSimulationScopeV1;request:NativeMixedSimulationStartRequestV1;startId:string}):NativeMixedSimulationStartedSourceV1|null {
 if(!uuid(expected.startId)||!exact(v,["kind","actorId","tournamentId","eventId","receipt","currentSourceVerified","normalStartAuthorized","scoringAuthorized"])
 ||v.kind!=="native-mixed-simulation-start-source-v1"||v.actorId!==expected.scope.actorId||v.tournamentId!==expected.scope.tournamentId
 ||v.eventId!==expected.scope.eventId||v.currentSourceVerified!==true||v.normalStartAuthorized!==false||v.scoringAuthorized!==false)return null;
 const receipt=readNativeMixedSimulationStartReceiptV1(v.receipt,expected);
 if(!receipt||receipt.startId!==expected.startId||receipt.historicalReceipt!==false||receipt.currentSourceVerified!==true)return null;
 return structuredClone({...v,receipt})as NativeMixedSimulationStartedSourceV1;
}
