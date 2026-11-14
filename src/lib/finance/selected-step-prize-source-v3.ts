import 'server-only';
import { isUuid } from '../api/validation.ts';
import { isEventPrizeResponseValueV1 } from '../api/event-prize-settings-v1.ts';
import { projectEventLedgerV1 } from './event-ledger-projection-v1.ts';
import { buildPlayoffPrizeProposalBasisV2 } from './playoff-prize-proposal-basis-v2.ts';
import {readJointExpenseIntentV3} from './joint-expense-intent-v3.ts';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const canonical = (v: unknown) => JSON.stringify(v, (_k, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const sameSourceRows=(a:unknown,b:unknown)=>{const rows=(v:unknown)=>{if(!Array.isArray(v)||v.some(x=>!object(x)||!isUuid(x.sourceId))||new Set(v.map(x=>x.sourceId)).size!==v.length)return null;return [...v].sort((x,y)=>String(x.sourceId).localeCompare(String(y.sourceId)));};const x=rows(a),y=rows(b);return x!==null&&y!==null&&same(x,y);};
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);

/** Distinct private Consolation capture: never accept a relabeled Main ledger. */
export function isConsolationOwnershipCaptureV3(c:unknown,scope:{actorId?:string;tournamentId:string;eventId:string}){
 if(!object(c)||c.kind!=='selected-step-consolation-ownership-source-v3'||c.tournamentId!==scope.tournamentId||c.eventId!==scope.eventId||c.regularOnly!==true||!object(c.nativePlayoffSource)||!object(c.nativePlayoffSource.source)||!object(c.nativeRawSource))return false;
 const g=c.nativePlayoffSource,p=g.source as Record<string,unknown>,link=p.linkedConsolationEligibility;
 if(g.status!=='source_available'||!isUuid(g.qualificationId)||!object(p.qualification)||p.qualification.qualifier_count!==4||!object(p.playStart)||p.playStart.event_id!==scope.eventId||p.playStart.start_source!=='official'||!object(p.settingsBinding)||p.settingsBinding.event_id!==scope.eventId||!object(link)||!isUuid(link.mainEventId)||link.mainEventId===scope.eventId||!digest(link.sourceDigest)||!object(link.manualAdmissionProof)||!['not_applicable','validated_manual_admissions'].includes(String(link.manualAdmissionProof.status))||!object(link.digitalAdmissionProof)||!['not_applicable','validated_native_admissions'].includes(String(link.digitalAdmissionProof.status)))return false;
 if(c.compositionKind==='unchanged-main-v3-and-consolation-addons-v1'){
  const m=c.mainOwnershipLedger,a=c.addonScope,parts=c.addonReceipts,l=c.combinedLedger;
  if(!object(m)||m.kind!=='selected-step-regular-ledger-v3'||m.status!=='source_available'||m.tournamentId!==scope.tournamentId||m.eventId!==link.mainEventId||scope.actorId&&m.actorId!==scope.actorId||!isUuid(m.ownershipRevisionId)||!object(m.ledger)||!Array.isArray(m.ledger.sources)||!object(m.capture)||!object(m.capture.ownershipSource)||!object(m.capture.ownershipSource.capture)||!same(m.capture.ownershipSource.capture.nativeRawSource,c.nativeRawSource)||!object(m.capture.ownershipOperation)||m.capture.ownershipOperation.reviewed!==true||m.capture.ownershipOperation.sourceDigest!==m.capture.ownershipSource.sourceDigest||!object(m.capture.ownershipOutcome)||m.capture.ownershipOutcome.status!=='selected_step_pool_ownership_reviewed_v3'||m.capture.ownershipOutcome.revisionId!==m.ownershipRevisionId||!object(a)||!isUuid(a.id)||a.tournament_id!==scope.tournamentId||a.event_id!==scope.eventId||a.main_event_id!==link.mainEventId||!Number.isSafeInteger(a.fee_minor)||(a.fee_minor as number)<=0||!Array.isArray(parts)||!parts.length||!object(l))return false;
  const main=projectEventLedgerV1({eventId:m.eventId,current:m.ledger,retained:m.ledger});if(main.status!=='projected'||main.reviewRequired||!object(m.funds)||main.regularFundMinor!==m.funds.regularAllocationFundMinor||main.totals.regular_entry!==m.funds.regularReceiptsMinor||main.totals.q!==m.funds.qReceiptsMinor||main.totals.side!==m.funds.sideReceiptsMinor||!sameSourceRows(m.capture.sources,m.ledger.sources)||!same(m.capture.pools,m.ledger.pools))return false;
  const sources=[...m.ledger.sources],ids=new Set<string>(),rosters=new Set<string>();
  const joint=c.jointExpenseIntent===null||c.jointExpenseIntent===undefined?null:readJointExpenseIntentV3(c.jointExpenseIntent,{tournamentId:scope.tournamentId,mainEventId:link.mainEventId,consolationEventId:scope.eventId});
  if(c.jointExpenseIntent!==null&&c.jointExpenseIntent!==undefined&&(!joint||!same(c.jointExpenseIntent,m.capture.ownershipSource.capture.basis&&object(m.capture.ownershipSource.capture.basis)?m.capture.ownershipSource.capture.basis.jointExpenseIntent:null)||!object(c.basis)||!same(c.basis.expenses,joint.consolationExpenses)))return false;
  for(const x of sources){if(!object(x)||!isUuid(x.sourceId)||!Array.isArray(x.allocations)||x.allocations.some(y=>!object(y)||y.eventId!==link.mainEventId)&&(!joint||x.kind!=='expense'||!joint.sources.some(s=>same(s,x))))return false;ids.add(x.sourceId);}
  for(const x of parts){if(!object(x)||!object(x.receipt)||!object(x.operation)||!object(x.source))return false;const r=x.receipt,o=x.operation;
   if(!isUuid(r.id)||!isUuid(r.roster_entry_id)||ids.has(r.id)||rosters.has(r.roster_entry_id)||r.tournament_id!==scope.tournamentId||r.event_id!==scope.eventId||r.scope_id!==a.id||r.amount_minor!==a.fee_minor||r.currency_code!=='USD'||r.event_type!=='received'||o.id!==r.operation_receipt_id||o.tournament_id!==scope.tournamentId||o.outcome!=='accepted'||o.actor_profile_id!==r.actor_id)return false;
   const source={sourceId:r.id,physicalEvidenceId:r.id,kind:'entry_receipt',amountMinor:r.amount_minor,state:'active',allocations:[{eventId:scope.eventId,bucket:'regular_entry',poolId:null,amountMinor:r.amount_minor,classificationReviewed:true}]};if(!same(source,x.source))return false;
   ids.add(r.id);rosters.add(r.roster_entry_id);sources.push(x.source);
  }
  if(joint)for(const x of joint.sources){if(!object(x)||!isUuid(x.sourceId))return false;if(!ids.has(x.sourceId)){ids.add(x.sourceId);sources.push(x);}else if(!sources.some(s=>same(s,x)))return false;}
  return same(l,{...m.ledger,eventIds:[link.mainEventId,scope.eventId],sources});
 }
 if(!object(c.nativeAllocation)||!object(c.nativeAllocation.snapshot)||!object(c.nativeAllocationOutcome)||!object(c.nativeAllocationOperation))return false;
 const a=c.nativeAllocation,o=c.nativeAllocationOperation,r=c.nativeAllocationOutcome;return a.tournament_id===scope.tournamentId&&isUuid(a.id)&&a.source_digest===c.nativeRawSource.sourceDigest&&o.tournament_id===scope.tournamentId&&o.actor_id===a.actor_id&&o.operation_id===a.operation_id&&same(o.request_payload,a.request_payload)&&o.request_hash===a.request_hash&&r.status==='accepted'&&r.revisionId===a.id&&same(r.snapshot,a.snapshot);
}

/** Decode a PRIVATE service-authenticated source, never a posted client claim.
 * Ownership IDs stay in their own domain. Complete receipt partitions feed the
 * existing independent projector; a proposal estimate is not a fund review. */
export function assembleSelectedStepPrizeSourceV3(value: unknown, scope: { actorId: string; tournamentId: string; eventId: string }) {
  if (![scope.actorId, scope.tournamentId, scope.eventId].every(v => isUuid(v) && v === v.toLowerCase()) || !isEventPrizeResponseValueV1(value)
    || !exact(value, ['status', 'kind', 'actorId', 'tournamentId', 'eventId', 'sourceDigest', 'capture', 'revisionDomain', 'coverage', 'proposalOnly', 'moneyMoved', 'payoutAuthorized', 'finalizationAuthorized'])
    || value.status !== 'source_available' || value.kind !== 'selected-step-prize-source-v3' || value.revisionDomain !== 'selected-step-pool-ownership-v3'
    || value.actorId !== scope.actorId || value.tournamentId !== scope.tournamentId || value.eventId !== scope.eventId || !digest(value.sourceDigest)
    || value.proposalOnly !== true || value.moneyMoved !== false || value.payoutAuthorized !== false || value.finalizationAuthorized !== false
    || !exact(value.capture, ['ownershipLedger', 'prizeActivation', 'input'])
    || !exact(value.coverage, ['additionalIncome', 'sanctioning', 'fundCompleteness']) || value.coverage.additionalIncome !== 'not_included'
    || value.coverage.sanctioning !== 'review_required' || value.coverage.fundCompleteness !== 'review_required') return null;
  const owned = value.capture.ownershipLedger, pin = value.capture.prizeActivation, input = value.capture.input;
  if (!exact(owned, ['status', 'kind', 'actorId', 'tournamentId', 'eventId', 'sourceDigest', 'ownershipRevisionId', 'ownershipVersion', 'capture', 'ledger', 'funds', 'coverage', 'moneyMoved', 'payoutAuthorized', 'finalizationAuthorized'])
    || owned.status !== 'source_available' || owned.kind !== 'selected-step-regular-ledger-v3' || owned.actorId !== scope.actorId || owned.tournamentId !== scope.tournamentId || owned.eventId !== scope.eventId
    || !digest(owned.sourceDigest) || !isUuid(owned.ownershipRevisionId) || !Number.isSafeInteger(owned.ownershipVersion) || (owned.ownershipVersion as number) < 1
    || owned.moneyMoved !== false || owned.payoutAuthorized !== false || owned.finalizationAuthorized !== false || !same(owned.coverage, value.coverage)
    || !object(owned.capture) || !object(owned.capture.ownershipSource) || !object(owned.capture.ownershipSource.capture)
    || !object(owned.capture.ownershipSource.capture.nativePlayoffSource) || !object(owned.capture.ownershipSource.capture.nativePlayoffSource.source)
    || !same(pin, owned.capture.ownershipSource.capture.nativePlayoffSource.source.prizeActivation)
    || !object(pin) || pin.status !== 'pin_available' || !object(pin.prize) || !object(pin.settingsBinding) || !object(pin.eventVersion)
    || !object(input) || !object(input.binding) || !object(input.prizeSource) || !object(input.ledger) || !object(input.qualification)
    || input.binding.eventId !== scope.eventId || input.binding.tournamentId !== scope.tournamentId || !['main','consolation'].includes(String(input.binding.eventKind))
    || !same(input.prizeSource.snapshot, pin.prize.document) || input.binding.settingsSnapshotId !== pin.settingsBinding.settings_snapshot_id
    || input.binding.eventClientRowId !== pin.eventVersion.client_row_id || input.binding.setupRevisionId !== pin.eventVersion.setup_revision_id
    || input.qualification.currentResultVersionId !== owned.capture.ownershipSource.capture.nativePlayoffSource.qualificationId
    || input.ledger.allocationRevisionId !== owned.ownershipRevisionId || input.ledger.currentAllocationRevisionId !== owned.ownershipRevisionId
    || !same(input.ledger.current, owned.ledger) || !same(input.ledger.retained, owned.ledger)) return null;
  if(input.binding.eventKind==='consolation'){const c=owned.capture.ownershipSource.capture,physical=c.compositionKind==='unchanged-main-v3-and-consolation-addons-v1'?c.combinedLedger:object(c.nativeAllocation)?c.nativeAllocation.snapshot:null;if(!isConsolationOwnershipCaptureV3(c,scope)||pin.eventVersion.event_kind!=='consolation'||pin.settingsBinding.event_id!==scope.eventId||!object(physical)||!object(owned.ledger)||!same(owned.ledger.sources,physical.sources)||!same(owned.ledger.eventIds,physical.eventIds)||!same(owned.ledger.pools,physical.pools))return null;}
  const ledger = projectEventLedgerV1({ eventId: scope.eventId, current: owned.ledger, retained: owned.ledger });
  if (ledger.status !== 'projected' || ledger.mode !== 'documented_actual' || ledger.tournamentId !== scope.tournamentId || ledger.sourceDigest !== owned.sourceDigest
    || ledger.sourceVersion !== owned.ownershipVersion || ledger.reviewRequired
    || !exact(owned.funds, ['regularReceiptsMinor', 'qReceiptsMinor', 'sideReceiptsMinor', 'benefitsMinor', 'expensesMinor', 'regularAllocationFundMinor'])
    || owned.funds.regularReceiptsMinor !== ledger.totals.regular_entry || owned.funds.qReceiptsMinor !== ledger.totals.q || owned.funds.sideReceiptsMinor !== ledger.totals.side
    || owned.funds.benefitsMinor !== ledger.totals.player_benefit || owned.funds.expensesMinor !== ledger.totals.operating_expense
    || owned.funds.regularAllocationFundMinor !== ledger.regularFundMinor) return null;
  const basis = buildPlayoffPrizeProposalBasisV2(input);
  if (basis.status !== 'proposal_basis') return null;
  return { status: 'selected_step_prize_estimate' as const, ...scope, sourceDigest: value.sourceDigest, ownershipRevisionId: owned.ownershipRevisionId,
    ownershipVersion: owned.ownershipVersion, revisionDomain: 'selected-step-pool-ownership-v3' as const,
    basis, ledger, coverageReviewRequired: true as const, providerSessionVerified: false as const,
    finalizationAllowed: false as const, payoutAuthorized: false as const, moneyMoved: false as const };
}
