import{isEventFinanceWorkspaceV1,type EventFinanceWorkspaceV1}from'./event-finance-workspace-v1.ts';
import type{EventFinanceDraftScopeV1}from'./event-finance-draft-codec-v1.ts';
export type PreparedEventFinanceSourceV1=EventFinanceDraftScopeV1&{status:'prepared_finance_source';workspace:EventFinanceWorkspaceV1;accessObservation:'pre-post-official-role-checks';providerRuntimeVerified:false;sourceAtomicityVerified:false;noStoreRequired:true;writeAuthorized:false;paymentAuthorized:false;moneyMoved:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
/** Shape/scope decoding only. A caller must obtain this from its trusted server
 * path, never treat a posted object as authentication or live source authority. */
export function readPreparedEventFinanceSourceV1(value:unknown,scope:EventFinanceDraftScopeV1):PreparedEventFinanceSourceV1|null{
 const keys=['status','actorId','tournamentId','eventId','workspace','accessObservation','providerRuntimeVerified','sourceAtomicityVerified','noStoreRequired','writeAuthorized','paymentAuthorized','moneyMoved'];
 if(!object(value)||Reflect.ownKeys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k))||value.status!=='prepared_finance_source'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.accessObservation!=='pre-post-official-role-checks'||value.providerRuntimeVerified!==false||value.sourceAtomicityVerified!==false||value.noStoreRequired!==true||value.writeAuthorized!==false||value.paymentAuthorized!==false||value.moneyMoved!==false||!isEventFinanceWorkspaceV1(value.workspace)||value.workspace.source.tournamentId!==scope.tournamentId||value.workspace.source.eventId!==scope.eventId)return null;
 return structuredClone(value as PreparedEventFinanceSourceV1);
}
