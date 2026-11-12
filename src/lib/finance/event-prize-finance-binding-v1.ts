import {isEventPrizeSettingsSnapshotV1,isEventPrizeWireValueV1,isEventPrizeResponseValueV1} from '../api/event-prize-settings-v1.ts';
import {isEventFinanceWorkspaceV1} from './event-finance-workspace-v1.ts';
export const eventPrizeAccountingEnabledV1=()=>false;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)===JSON.stringify(b,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
/** Local review projection, not a source attestation. A future authenticated
 * assembler must load the canonical event/client-row relation and snapshots.
 * No new plan may fall through to legacy Finance calculation or finalization. */
export function projectEventPrizeFinanceBindingV1(snapshot:unknown,workspace:unknown,binding:unknown){
 const authority={accountingAllowed:false as const,recordedFundApproved:false as const,operationalAmountsAvailable:false as const,payoutAuthorized:false as const,finalizationAllowed:false as const,moneyMoved:false as const,qualificationChanged:false as const};
 const blocked=(code:string)=>({status:'blocked' as const,code,...authority});
 try{
  if(![snapshot,binding].every(isEventPrizeWireValueV1)||!isEventPrizeResponseValueV1(workspace)||!isEventPrizeSettingsSnapshotV1(snapshot)||!isEventFinanceWorkspaceV1(workspace)||!exact(binding,['tournamentId','eventId','eventClientRowId','eventKind','setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest','financeSource','financePayoutSource']))return blocked('invalid_source_binding');
  if(![binding.tournamentId,binding.eventId,binding.eventClientRowId].every(uuid)||binding.tournamentId!==snapshot.tournamentId||binding.tournamentId!==workspace.source.tournamentId||binding.eventId!==workspace.source.eventId||binding.eventId!==workspace.payoutSource.eventId||!same(binding.financeSource,workspace.source)||!same(binding.financePayoutSource,workspace.payoutSource))return blocked('foreign_or_stale_finance_source');
  if(binding.setupRevisionId!==snapshot.setupRevisionId||binding.setupVersion!==snapshot.setupVersion||binding.settingsSnapshotId!==snapshot.settingsSnapshotId||binding.settingsDigest!==snapshot.settingsDigest||binding.prizeSnapshotId!==snapshot.prizeSnapshotId||binding.prizeDigest!==snapshot.prizeDigest)return blocked('settings_snapshot_changed');
  if(workspace.payoutSource.settingsSnapshotId!==snapshot.settingsSnapshotId)return blocked('new_setup_not_finance_basis');
  const plan=snapshot.plans.find(p=>p.eventClientRowId===binding.eventClientRowId);if(!plan)return blocked('event_plan_missing');if(binding.eventKind!==workspace.eventKind||plan.eventKind!==binding.eventKind)return blocked('event_kind_mismatch');if(plan.mode!=='proposed_v2')return blocked('historical_checks_required');
  return freeze({status:'review_only' as const,draft:structuredClone(plan.draft),sourcePins:structuredClone(binding),legacyCalculationMustNotApply:true as const,issues:['new_prize_activation_and_accounting_required','bound_bracket_recipient_evidence_required','rounding_balance_policy_required',...((plan.draft.method==='graduated'||plan.draft.method==='winner-multiplier')&&plan.draft.firstRoundComparison!=='unset'?['entry_fee_comparison_policy_required']:[])],...authority});
 }catch{return blocked('invalid_source_binding');}
}
