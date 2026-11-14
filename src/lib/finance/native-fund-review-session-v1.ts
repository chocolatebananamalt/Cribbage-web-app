import {NativeFundReviewOperationV1} from './native-fund-review-operation-v1.ts';
import type {createNativeFundReviewHttpV1} from './native-fund-review-http-v1.ts';
import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
import type {FinanceProviderScopeV1,FinanceProviderUiWorkspaceV1} from './operational-finance-provider-ui-v1.ts';
/** Fixed-scope inactive IO owner. Construction opens nothing. Epoch checks fence
 * async ports independently of React render/effect lifetimes. */
export class NativeFundReviewSessionV1{
 readonly operation:NativeFundReviewOperationV1;private active=false;private epoch=0;
 private scope:FinanceProviderScopeV1;private retained:FinanceDraftRetainedPortV1;
 constructor(scope:FinanceProviderScopeV1,retained:FinanceDraftRetainedPortV1,readFinance:()=>Promise<FinanceProviderUiWorkspaceV1>,http:ReturnType<typeof createNativeFundReviewHttpV1>){
  this.scope=Object.freeze(structuredClone(scope));this.retained=retained;
  this.operation=new NativeFundReviewOperationV1(scope,retained,{save:async request=>{const epoch=this.capture(),finance=await readFinance();this.check(epoch);if(finance.scope.actorId!==this.scope.actorId||finance.scope.tournamentId!==this.scope.tournamentId||finance.scope.eventId!==this.scope.eventId||!finance.editable)throw Error('finance_changed');await this.clear();this.check(epoch);return http.operation.save(request);},reconcile:async operationId=>{const epoch=this.capture(),reply=await http.operation.reconcile(operationId);this.check(epoch);return reply;}});
 }
 setActive(value:boolean){if(value===this.active)return;this.active=value;this.epoch++;if(!value)this.operation.setActive(false);}
 private capture(){if(!this.active)throw Error('owner_changed');return this.epoch;}
 private check(epoch:number){if(!this.active||epoch!==this.epoch)throw Error('owner_changed');}
 async clear(){const epoch=this.capture(),s=this.scope,suffix=`${s.actorId}:${s.tournamentId}:${s.eventId}`;for(const prefix of['finance-device-draft-v1:','finance-provider-operation-v1:','native-cost-adoption-operation-v1:']){const value=await this.retained.read(prefix+suffix);this.check(epoch);if(value!==null)throw Error('prior_recovery_required');}}
}
