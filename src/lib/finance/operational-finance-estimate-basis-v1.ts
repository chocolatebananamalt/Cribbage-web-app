/** Partial native evidence produces a proposal estimate, never an actual fund. */
import {createEventFinanceEditorV1,isEventFinanceWorkspaceV1,projectEventFinanceSectionV1,type EventFinanceWorkspaceV1,type EventFinanceEditorV1,type EventFinanceSectionViewV1} from './event-finance-workspace-v1.ts';
export type OperationalFinanceCoverageV1={additionalIncome:'unavailable';optionalPools:'isolated_regular_allocation';recordedFundAvailable:false};
export type OperationalFinanceEstimateBasisV1={kind:'operational-finance-estimate-basis-v1';sourceDigest:string;coverage:OperationalFinanceCoverageV1;workspace:EventFinanceWorkspaceV1};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
/** Shape validation grants no provider authority. The private authenticated assembler
 * must supply the current source; posted facts are never receipt evidence. */
export function isOperationalFinanceEstimateBasisV1(v:unknown):v is OperationalFinanceEstimateBasisV1{
 if(!exact(v,['kind','sourceDigest','coverage','workspace'])||v.kind!=='operational-finance-estimate-basis-v1'||typeof v.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceDigest)
 ||!exact(v.coverage,['additionalIncome','optionalPools','recordedFundAvailable'])||v.coverage.additionalIncome!=='unavailable'||v.coverage.optionalPools!=='isolated_regular_allocation'||v.coverage.recordedFundAvailable!==false||!isEventFinanceWorkspaceV1(v.workspace))return false;
 const w=v.workspace;
 return w.mode==='estimate'&&w.source.sourceDigest===v.sourceDigest&&w.payoutSource.ledgerDigest===v.sourceDigest&&w.payoutSource.resultsDigest===v.sourceDigest
 &&w.overrideHistory.length===0&&w.history.every(r=>['player_benefit','operating_expense'].includes(r.line.category));
}
export type OperationalFinanceEstimateViewV1={kind:'operational-finance-estimate-view-v1';coverage:OperationalFinanceCoverageV1;recordedFundMinor:null;recordedAdditionalIncomeMinor:null;recordedQPoolMinor:null;recordedSidePoolMinor:null;knownRegularSubtotalMinor:number|null;proposal:EventFinanceSectionViewV1;moneyMoved:false;payoutAuthorized:false};
/** An empty proposed-income list cannot establish recorded zero income. */
export function projectOperationalFinanceEstimateV1(editor:EventFinanceEditorV1,current:unknown):OperationalFinanceEstimateViewV1|null{
 if(!isOperationalFinanceEstimateBasisV1(current)||editor.basis.source.tournamentId!==current.workspace.source.tournamentId||editor.basis.source.eventId!==current.workspace.source.eventId)return null;
 const view=projectEventFinanceSectionV1(editor,current.workspace);
 const currentView=projectEventFinanceSectionV1(createEventFinanceEditorV1(current.workspace)!,current.workspace);
 return{kind:'operational-finance-estimate-view-v1',coverage:structuredClone(current.coverage),recordedFundMinor:null,recordedAdditionalIncomeMinor:null,recordedQPoolMinor:null,recordedSidePoolMinor:null,knownRegularSubtotalMinor:currentView.basisFundMinor,
 proposal:{...view,modeLabel:'Proposal Estimate - Unpaid and Nonfinal',basisFundMinor:null,basisAdditionalIncomeMinor:null,excludedQMinor:null,excludedSideMinor:null,
 warnings:['Recorded additional-income coverage is unavailable. Fund and payout amounts below are proposal estimates, not approved awards or payments.',...view.warnings]},moneyMoved:false,payoutAuthorized:false};
}
