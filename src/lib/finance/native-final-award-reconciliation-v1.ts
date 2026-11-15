import {readNativeRecordedFundReviewSourceV1} from './native-recorded-fund-review-source-v1.ts';
import {readCurrentCommonEntryFeeSourceV1} from './common-entry-fee-source-v1.ts';
import {readPlayoffPrizeProposalWorkspaceV2} from './playoff-prize-proposal-store-v2.ts';
import {assemblePlayoffPrizeNativeSourceV2} from './playoff-prize-native-read-v2.ts';
import {calculatePlayoffPrizeProposalsV2,type PlayoffPrizeProposalInputV2} from '../results/playoff-prize-proposals-v2.ts';
import 'server-only';
import {createHash} from 'node:crypto';
import {projectNativeFinalRecipientEstimateV1} from './native-playoff-recipient-v1.ts';
type Scope={actorId:string;tournamentId:string;eventId:string};
type IncomeRecord={incomeId:string;recordId:string;priorRecordId:string|null;physicalEvidenceId:string;amountMinor:number;voided:boolean;label:string;evidenceReference:string;reason:string;recordedAt:string;recordedBy:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return!!d&&'value'in d&&d.enumerable;});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max&&!Object.is(v,-0);
const text=(v:unknown,max=2000):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const stamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const array=(v:unknown,max=10000):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&v.every((_x,i)=>Object.hasOwn(v,i));
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const noAuthority={writeAuthorized:false as const,publicAccessGranted:false as const,moneyMoved:false as const,payoutAuthorized:false as const,disbursementAuthorized:false as const,finalizationAuthorized:false as const,bankReceiptVerified:false as const};
const blocked=(code:string)=>({status:'blocked' as const,code,...noAuthority});
/** Validate the private locked SQL contract independently. A recorded fund is
 * reviewed bookkeeping, not a bank balance. No client facts become receipts.
 * SQL owns tournament-wide evidence collision and review-head checks; this
 * target-event DTO cannot independently re-prove out-of-scope rows. */
export function reconcileNativeFinalAwardSourceV1(value:unknown,scope:Scope){
 try{
  if(!exact(value,['status','kind','actorId','tournamentId','eventId','nativeRecipientSource','recipientSourceDigest','proposal','allocation','income','sanctioning','fund','projection','fundSourceDigest','sourceDigest','awardStatus','moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized'])||value.status!=='source_available'||value.kind!=='native-playoff-final-award-source-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!hash(value.sourceDigest)||!hash(value.recipientSourceDigest)||!hash(value.fundSourceDigest)||value.awardStatus!=='recordable_unpaid'||value.moneyMoved!==false||value.payoutAuthorized!==false||value.disbursementAuthorized!==false||value.finalizationAuthorized!==false)return blocked('recorded_fund_source_unavailable');
  const recipient=projectNativeFinalRecipientEstimateV1(value.nativeRecipientSource,scope);if(recipient.status!=='recipient_estimate')return blocked(recipient.code);
  const native=value.nativeRecipientSource as {sourceDigest:string;proposal:{revisionId:string;version:number;sourceDigest:string;basisDigest:string;qualificationResultVersionId:string;editor:{basis:{source:unknown;history:unknown[]};history:unknown[]}};nativeFinanceSource:{sourceDigest:string;raw:{allocation:{revisionId:string;version:number;sourceDigest:string;eventSources:Array<{sourceId:string;physicalEvidenceId:string;kind:string;allocations:Array<{bucket:string;amountMinor:number}>}>}}};playoff:{players:Array<{participantId:string;profileId:string}>}};
  if(value.recipientSourceDigest!==native.sourceDigest||!exact(value.proposal,['revisionId','version','sourceDigest','basisDigest','qualificationResultVersionId'])||!same(value.proposal,{revisionId:native.proposal.revisionId,version:native.proposal.version,sourceDigest:native.proposal.sourceDigest,basisDigest:native.proposal.basisDigest,qualificationResultVersionId:native.proposal.qualificationResultVersionId})||!exact(value.allocation,['revisionId','version','sourceDigest'])||!same(value.allocation,{revisionId:native.nativeFinanceSource.raw.allocation.revisionId,version:native.nativeFinanceSource.raw.allocation.version,sourceDigest:native.nativeFinanceSource.raw.allocation.sourceDigest}))return blocked('final_award_source_changed');
  const income=value.income;
  if(!exact(income,['headVersion','headDigest','reviewId','reviewVersion','reviewStatus','reviewedBy','reviewedAt','incomeTotalMinor','records','sourceDigest'])||!integer(income.headVersion,0,2147483647)||!hash(income.headDigest)||!uuid(income.reviewId)||!integer(income.reviewVersion,1,2147483647)||!['reviewed_zero','recorded_complete'].includes(income.reviewStatus as string)||!uuid(income.reviewedBy)||!stamp(income.reviewedAt)||!integer(income.incomeTotalMinor)||!hash(income.sourceDigest)||!array(income.records)||income.records.length!==income.headVersion)return blocked('income_coverage_unavailable');
  if(value.fundSourceDigest!==income.sourceDigest)return blocked('recorded_fund_source_changed');
  const current=new Map<string,IncomeRecord>(),recordIds=new Set<string>(),physical=new Map<string,string>(),references=new Map<string,string>(),nativePhysical=new Set(native.nativeFinanceSource.raw.allocation.eventSources.flatMap(s=>[s.sourceId,s.physicalEvidenceId]));
  for(const row of income.records){
   if(!exact(row,['incomeId','recordId','priorRecordId','physicalEvidenceId','amountMinor','voided','label','evidenceReference','reason','recordedAt','recordedBy'])||![row.incomeId,row.recordId,row.physicalEvidenceId,row.recordedBy].every(uuid)||(row.priorRecordId!==null&&!uuid(row.priorRecordId))||!integer(row.amountMinor)||typeof row.voided!=='boolean'||(row.voided?row.amountMinor!==0:row.amountMinor===0)||!text(row.label,200)||!text(row.evidenceReference,500)||!text(row.reason)||!stamp(row.recordedAt))return blocked('invalid_recorded_income');
   const r=row as IncomeRecord,prior=current.get(r.incomeId),ref=r.evidenceReference.toLowerCase();
   if(recordIds.has(r.recordId)||nativePhysical.has(r.physicalEvidenceId)||r.priorRecordId!==(prior?.recordId??null)||(!prior&&r.voided)||(prior&&(r.physicalEvidenceId!==prior.physicalEvidenceId||r.evidenceReference!==prior.evidenceReference))||(physical.has(r.physicalEvidenceId)&&physical.get(r.physicalEvidenceId)!==r.incomeId)||(references.has(ref)&&references.get(ref)!==r.incomeId))return blocked('recorded_income_lineage_invalid');
   recordIds.add(r.recordId);physical.set(r.physicalEvidenceId,r.incomeId);references.set(ref,r.incomeId);current.set(r.incomeId,r);
  }
  const active=[...current.values()].filter(r=>!r.voided),sumIncome=active.reduce((s,r)=>s+BigInt(r.amountMinor),BigInt(0));
  if(sumIncome>BigInt(Number.MAX_SAFE_INTEGER)||Number(sumIncome)!==income.incomeTotalMinor||(income.reviewStatus==='reviewed_zero')!==(active.length===0))return blocked('recorded_income_review_changed');
  const editor=native.proposal.editor;
  const postedHistory=(income.records as IncomeRecord[]).map(r=>({label:r.label,line:{recordId:r.recordId,lineId:r.incomeId,priorRecordId:r.priorRecordId,source:editor.basis.source,mode:'estimate',category:'unrestricted_income',amountMinor:r.amountMinor,voided:r.voided,reason:r.reason}}));
  if(!same(editor.history,[...editor.basis.history,...postedHistory]))return blocked('unposted_finance_adjustments');
  const sanction=value.sanctioning;
  if(!exact(sanction,['snapshotId','eventPlayStartId','rateMinor','eligibleParticipantCount','totalMinor','expenseSourceId','allocatedExpenseMinor'])||![sanction.snapshotId,sanction.eventPlayStartId].every(uuid)||!integer(sanction.rateMinor,0,100000)||!integer(sanction.eligibleParticipantCount,0,10000)||!integer(sanction.totalMinor,0,1000000000)||sanction.totalMinor!==sanction.rateMinor*sanction.eligibleParticipantCount||!integer(sanction.allocatedExpenseMinor)||(sanction.expenseSourceId!==null&&!uuid(sanction.expenseSourceId)))return blocked('sanctioning_coverage_unverified');
  if(sanction.totalMinor===0){if(sanction.expenseSourceId!==null||sanction.allocatedExpenseMinor!==0)return blocked('sanctioning_coverage_unverified');}
  else{
   const evidence=native.nativeFinanceSource.raw.allocation.eventSources.find(s=>s.sourceId===sanction.expenseSourceId&&s.kind==='expense');
   const covered=evidence?.allocations.filter(p=>p.bucket==='player_benefit'||p.bucket==='operating_expense').reduce((s,p)=>s+BigInt(p.amountMinor),BigInt(0));
   if(covered===undefined||covered!==BigInt(sanction.allocatedExpenseMinor)||covered<BigInt(sanction.totalMinor))return blocked('sanctioning_coverage_unverified');
  }
  let gross=BigInt(0),benefits=BigInt(0),expenses=BigInt(0);
  for(const s of native.nativeFinanceSource.raw.allocation.eventSources)for(const p of s.allocations){if(p.bucket==='regular_entry')gross+=BigInt(p.amountMinor);else if(p.bucket==='player_benefit')benefits+=BigInt(p.amountMinor);else if(p.bucket==='operating_expense')expenses+=BigInt(p.amountMinor);else return blocked('optional_fund_isolation_required');}
  const net=gross-benefits-expenses+sumIncome;if(net<BigInt(0)||[gross,benefits,expenses,net].some(n=>n>BigInt(Number.MAX_SAFE_INTEGER)))return blocked('negative_or_unsafe_recorded_fund');
  const f=value.fund;
  if(!exact(f,['currency','regularEntryIncomeMinor','benefitExpenseMinor','operatingExpenseMinor','unrestrictedIncomeMinor','awardFundMinor','recordedFundAvailable','bankReceiptVerified'])||!same(f,{currency:'USD',regularEntryIncomeMinor:Number(gross),benefitExpenseMinor:Number(benefits),operatingExpenseMinor:Number(expenses),unrestrictedIncomeMinor:Number(sumIncome),awardFundMinor:Number(net),recordedFundAvailable:true,bankReceiptVerified:false}))return blocked('recorded_fund_mismatch');
  if(recipient.fundMinor!==Number(net)||BigInt(recipient.totalMinor)!==net)return blocked('award_fund_imbalance');
  const expectedGroups=recipient.groups.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,people:g.participantIds.length,included:g.included,perPersonMinor:g.perPersonMinor,groupTotalMinor:g.perPersonMinor*g.participantIds.length}));
  if(expectedGroups.some((g,i)=>g.included&&(g.perPersonMinor<500||g.perPersonMinor%500!==0||(i>0&&g.perPersonMinor>expectedGroups[i-1].perPersonMinor))))return blocked('invalid_final_group_amount');
  const p=value.projection;
  if(!exact(p,['kind','requestedPaidPlaces','includedPaidPlaces','positiveAwardPlaces','groups','recipients','totalMinor'])||p.kind!=='native-unpaid-final-award-projection-v1'||p.requestedPaidPlaces!==recipient.requestedPaidPlaces||p.includedPaidPlaces!==recipient.includedPaidPlaces||p.positiveAwardPlaces!==recipient.positiveAwardPlaces||p.totalMinor!==recipient.totalMinor||!same(p.groups,expectedGroups)||!array(p.recipients,64)||p.recipients.length!==recipient.recipients.length)return blocked('final_award_projection_mismatch');
  const recipients=new Map(recipient.recipients.map(r=>[r.participantId,r])),seen=new Set<string>();
  for(const row of p.recipients){if(!exact(row,['participantId','profileId','displayName','tournamentPlayerId','firstPlace','lastPlace','included','amountMinor'])||!uuid(row.participantId)||seen.has(row.participantId))return blocked('final_award_recipient_mismatch');const r=recipients.get(row.participantId),player=native.playoff.players.find(x=>x.participantId===row.participantId);if(!r||!player||!same(row,{...r,profileId:player.profileId}))return blocked('final_award_recipient_mismatch');seen.add(row.participantId);}
  const digest=createHash('sha256').update(canonical(value)).digest('hex');
  return{status:'recordable_unpaid_awards' as const,version:'native-final-award-reconciliation-v1' as const,digest,sourceDigest:value.sourceDigest,recipientDigest:recipient.digest,fundSourceDigest:income.sourceDigest,proposalRevisionId:native.proposal.revisionId,fundReviewId:income.reviewId,reviewStatus:income.reviewStatus,recordedFundMinor:Number(net),recordedAdditionalIncomeMinor:Number(sumIncome),totalAwardMinor:recipient.totalMinor,requestedPaidPlaces:recipient.requestedPaidPlaces,includedPaidPlaces:recipient.includedPaidPlaces,groups:expectedGroups,recipients:recipient.recipients,recordedBookkeepingOnly:true as const,independentPlayEstablished:false as const,...noAuthority};
 }catch{return blocked('invalid_final_award_source');}
}

/** New saved methods are reviewed against separately reconciled recorded funds.
 * This is deliberately NOT a legacy-method conversion or final-record writer. */
export function reconcileLatestPrizeAwardReviewV2(value:unknown,scope:Scope){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 try{
  if(!exact(value,['fundSource','prizeWorkspace'])&&!exact(value,['fundSource','prizeWorkspace','entryFeeSource']))return fail('invalid_latest_review');
  const fund=object(value.fundSource)&&value.fundSource.kind==='current-native-prize-fund-v2'?readCurrentNativeFundOnlyV2(value.fundSource,scope):reconcileNativeFinalAwardSourceV1(value.fundSource,scope),workspace=readPlayoffPrizeProposalWorkspaceV2(value.prizeWorkspace,scope);
  if(!['recordable_unpaid_awards','reviewed_native_fund'].includes(fund.status)||fund.status==='blocked'||!workspace||workspace.stale||!workspace.head||!workspace.nativeSource)return fail('current_reviewed_sources_required');
  const native=assemblePlayoffPrizeNativeSourceV2(workspace.nativeSource,scope);if(!native)return fail('current_prize_source_required');
  // Supplement the immutable saved proposal with actual completed finishing evidence.
  // The original saved input/history is never rewritten or silently rebased.
  const input:PlayoffPrizeProposalInputV2=structuredClone(native.basis.input),lowest=fund.groups.at(-1);if(!lowest)return fail('completed_finishing_groups_required');
  // The saved policy's allocation basis excludes separately recorded income.
  // Only the complete current fund review may supplement it, exactly once.
  // Preserve the saved proposal/history and bind this derived review to both
  // captures; changed income therefore needs a new explicit award review.
  if(fund.recordedAdditionalIncomeMinor!==0&&(!object(value.fundSource)||value.fundSource.kind!=='current-native-prize-fund-v2'))return fail('current_income_review_required');
  if(BigInt(input.fundMinor)+BigInt(fund.recordedAdditionalIncomeMinor)!==BigInt(fund.recordedFundMinor))return fail('latest_income_or_fund_coverage_unsupported');
  input.fundMinor=fund.recordedFundMinor;
  input.field.firstRoundLoserPlaces=Array.from({length:lowest.lastPlace-lowest.firstPlace+1},(_,i)=>lowest.firstPlace+i);
  input.field.entryFeeMinor=null; // Only the current receipt/obligation collector may supply it.
  let verifiedFee:number|null=null;
  if(value.entryFeeSource!==undefined&&value.entryFeeSource!==null){
   const fee=readCurrentCommonEntryFeeSourceV1(value.entryFeeSource,scope);
   if(fee.status!=='common_fee_evidence'||!object(value.entryFeeSource)||!same(value.entryFeeSource.fundSource,value.fundSource)||fee.qualificationResultVersionId!==native.basis.source.qualificationResultVersionId||fee.entrantCount!==(workspace.nativeSource as {capture:{input:{qualification:{result:{participantCount:number}}}}}).capture.input.qualification.result.participantCount)return fail('entry_fee_source_changed');
   verifiedFee=fee.entryFeeMinor;input.field.entryFeeMinor=verifiedFee;
  }
  const current={source:native.basis.source,input},proposal=calculatePlayoffPrizeProposalsV2({...current,overrideHistory:workspace.head.overrideHistory},current);
  if(proposal.status!=='proposal_review')return fail('latest_proposal_unavailable');
  const source=value.fundSource as Record<string,unknown>,recipient=(source.kind==='current-native-prize-fund-v2'?(source.capture as Record<string,unknown>).recipientSource:source.nativeRecipientSource) as {nativeFinanceSource:{raw:{binding:Record<string,string>;event:{eventKind:string};allocation:{revisionId:string;version:number;sourceDigest:string;eventSources:unknown[]}}};proposal:{qualificationResultVersionId:string};playoff:{players:Array<{participantId:string;seed:number}>}},raw=recipient.nativeFinanceSource.raw,capture=(workspace.nativeSource as {capture:{bindingId:string;activationId:string;setupEventVersionId:string;contextReviewId:string;input:{ledger:{current:{sourceDigest:string;sourceVersion:number;sources:unknown[]}};qualification:{result:{qualifiers:Array<{participantId:string;qualificationRank:number}>}}}}}).capture;
  const b=raw.binding,s=current.source,ledger=capture.input.ledger.current;
  if(capture.bindingId!==b.bindingId||capture.activationId!==b.activationId||capture.setupEventVersionId!==b.setupEventVersionId||capture.contextReviewId!==b.reviewId||s.settingsSnapshotId!==b.settingsSnapshotId||s.eventKind!==raw.event.eventKind||s.allocationRevisionId!==raw.allocation.revisionId||s.qualificationResultVersionId!==recipient.proposal.qualificationResultVersionId||ledger.sourceDigest!==raw.allocation.sourceDigest||ledger.sourceVersion!==raw.allocation.version)return fail('prize_fund_binding_changed');
  const sorted=(rows:unknown[])=>[...rows].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  if(!same(sorted(ledger.sources),sorted(raw.allocation.eventSources))||!same(capture.input.qualification.result.qualifiers.map(p=>[p.participantId,p.qualificationRank]).sort(),recipient.playoff.players.map(p=>[p.participantId,p.seed]).sort()))return fail('prize_fund_evidence_changed');
  // Complete current income was checked against the original allocation basis
  // before calculating. The saved proposal itself is still unchanged.
  const groups=fund.groups.map(g=>{const band=proposal.proposedBands.find(p=>p.firstPlace===g.firstPlace&&p.lastPlace===g.lastPlace);return{firstPlace:g.firstPlace,lastPlace:g.lastPlace,people:g.people,included:!!band,perPersonMinor:band?.perPersonMinor??0,groupTotalMinor:band?.bandTotalMinor??0};});
  if(proposal.proposedBands.some(b=>!groups.some(g=>g.firstPlace===b.firstPlace&&g.lastPlace===b.lastPlace&&g.people===b.people)))return fail('latest_finishing_group_mismatch');
  const recipients=fund.recipients.map(r=>{const g=groups.find(g=>g.firstPlace===r.firstPlace&&g.lastPlace===r.lastPlace)!;return{...r,included:g.included,amountMinor:g.perPersonMinor};});
  const total=recipients.reduce((n,r)=>n+BigInt(r.amountMinor),BigInt(0));if(total!==BigInt(proposal.proposedTotalMinor))return fail('latest_recipient_total_mismatch');
  const issues=proposal.issues.map(i=>i.code);
  // The owner permits explicit whole-band Director adjustments to Graduated
  // suggestions. This does not redefine Equal/Winner Multiplier or rebalance.
  const manualAdjustments=current.input.plan.method==='graduated'?proposal.proposedBands.filter(b=>b.overrideState==='active'&&b.perPersonMinor!==b.sourcePerPersonMinor).map(b=>({firstPlace:b.firstPlace,lastPlace:b.lastPlace,suggestedPerPersonMinor:b.sourcePerPersonMinor,reviewedPerPersonMinor:b.perPersonMinor,reason:workspace.head!.overrideHistory.find(h=>h.recordId===b.overrideRecordId)!.reason})):[];
  const reviewedGraduatedChange=current.input.plan.method==='graduated'&&manualAdjustments.length>0;
  // Fee evidence supplements this evaluation only. It never rewrites the saved
  // proposal, substitutes a discount policy, or supplies live write authority.
  const firstRound=groups.find(g=>g.firstPlace===lowest.firstPlace&&g.lastPlace===lowest.lastPlace)!;
  const entryFeeComparison=verifiedFee!==null&&proposal.comparison==='satisfied'&&['less','equal','more'].includes(input.plan.firstRoundComparison)?{entryFeeMinor:verifiedFee,choice:input.plan.firstRoundComparison as 'less'|'equal'|'more',firstPlace:firstRound.firstPlace,lastPlace:firstRound.lastPlace,perPersonMinor:firstRound.perPersonMinor}:null;
  return{status:'latest_prize_award_review' as const,held:!proposal.balanced||proposal.zeroAwardBand||proposal.rankOrderViolation||proposal.equalTreatmentViolation||(proposal.methodRelationReviewRequired&&!reviewedGraduatedChange)||!['not_applicable','satisfied'].includes(proposal.comparison),manualAdjustments,recordedAdditionalIncomeMinor:fund.recordedAdditionalIncomeMinor,entryFeeComparison,method:current.input.plan.method,roundingStepMinor:proposal.roundingStepMinor,plan:structuredClone(current.input.plan),prizeRevisionId:workspace.head.revisionId,prizeVersion:workspace.head.version,prizeSourceDigest:native.nativeSourceDigest,originalFundSourceDigest:fund.sourceDigest,originalFundReviewId:fund.fundReviewId,qualificationResultVersionId:s.qualificationResultVersionId,recordedFundMinor:fund.recordedFundMinor,totalMinor:Number(total),differenceMinor:fund.recordedFundMinor-Number(total),groups,recipients,issues,directorReviewRequired:true as const,recorded:false as const,priorAwardsUnchanged:true as const,...noAuthority};
 }catch{return fail('latest_review_unavailable');}
}

/** Proves current recorded fund review without requiring legacy award balance.
 * Caller still needs authenticated locked provider capture; this grants no IO. */
export function readCurrentNativeFundOnlyV2(value:unknown,scope:Scope){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 try{
  if(!exact(value,['kind','status','actorId','tournamentId','eventId','capture','sourceDigest','moneyMoved','payoutAuthorized','finalizationAuthorized'])||value.kind!=='current-native-prize-fund-v2'||value.status!=='source_available'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!hash(value.sourceDigest)||value.moneyMoved!==false||value.payoutAuthorized!==false||value.finalizationAuthorized!==false)return fail('invalid_current_fund');
  const c=readNativeRecordedFundReviewSourceV1(value.capture,scope);if(!c||!c.latestReview)return fail('current_fund_review_required');
  const r=c.latestReview,recipient=c.recipientSource as {sourceDigest?:unknown};
  if(r.proposalRevisionId!==c.proposalRevisionId||r.nativeAllocationRevisionId!==c.nativeAllocationRevisionId||r.incomeHeadVersion!==c.income.headVersion||r.incomeHeadDigest!==c.income.headDigest||r.reviewStatus!==c.income.suggestedStatus||r.recipientSourceDigest!==recipient.sourceDigest||r.sanctioningSnapshotId!==c.sanctioning.snapshotId)return fail('fund_review_stale');
  if(c.sanctioning.totalMinor===0){if(r.sanctioningExpenseEventId!==null||r.sanctioningAllocatedMinor!==0)return fail('fund_fee_review_stale');}
  else if(!c.sanctioning.candidates.some(x=>x.expenseSourceId===r.sanctioningExpenseEventId&&x.allocatedExpenseMinor===r.sanctioningAllocatedMinor))return fail('fund_fee_review_stale');
  const sporting=projectNativeFinalRecipientEstimateV1(c.recipientSource,scope);if(sporting.status!=='recipient_estimate')return fail(sporting.code);
  return{status:'reviewed_native_fund' as const,sourceDigest:value.sourceDigest,fundReviewId:r.reviewId,recordedFundMinor:c.totals.recordedFundMinor,recordedAdditionalIncomeMinor:c.totals.unrestrictedIncomeMinor,groups:sporting.groups.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,people:g.participantIds.length})),recipients:sporting.recipients,...noAuthority};
 }catch{return fail('current_fund_unavailable');}
}

/** Validate the private SQL producer's modern award projection independently.
 * This is a source-contract check, never permission to write or pay. */
export function reconcileModernPrizeAwardSourceV2(value:unknown,scope:Scope){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 try{
  const keys=['kind','status','actorId','tournamentId','eventId','fundSource','prizeWorkspace','plan','roundingUnitMinor','groups','recipients','totalMinor','directorReviewRequired','moneyMoved','payoutAuthorized','sourceDigest'];
  if((!exact(value,keys)&&!exact(value,[...keys,'entryFeeSource']))||value.kind!=='modern-prize-award-source-v2'||value.status!=='source_available'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!hash(value.sourceDigest)||value.directorReviewRequired!==true||value.payoutAuthorized!==false||value.moneyMoved!==false||!object(value.fundSource)||value.fundSource.kind!=='current-native-prize-fund-v2')return fail('invalid_modern_award_source');
  const r=reconcileLatestPrizeAwardReviewV2({fundSource:value.fundSource,prizeWorkspace:value.prizeWorkspace,...(Object.hasOwn(value,'entryFeeSource')?{entryFeeSource:value.entryFeeSource}:{})},scope);
  if(r.status!=='latest_prize_award_review'||r.held||!['equal','winner-takes-all','graduated','winner-multiplier'].includes(r.method)||!same(value.plan,r.plan)||value.roundingUnitMinor!==r.roundingStepMinor||value.totalMinor!==r.totalMinor||!same(value.groups,r.groups)||!array(value.recipients,64))return fail('modern_awards_unresolved');
  const fund=value.fundSource as {capture:{recipientSource:{playoff:{players:Array<{participantId:string;profileId:string}>}}}},byId=(x:Array<{participantId:string}>)=>[...x].sort((a,b)=>a.participantId.localeCompare(b.participantId));
  const expected=r.recipients.map(p=>({...p,profileId:fund.capture.recipientSource.playoff.players.find(x=>x.participantId===p.participantId)?.profileId}));
  if(!same(byId(value.recipients as typeof expected),byId(expected)))return fail('modern_recipient_rows_changed');
  return{...r,status:'modern_award_source_review' as const,sourceDigest:value.sourceDigest};
 }catch{return fail('modern_source_unavailable');}
}
