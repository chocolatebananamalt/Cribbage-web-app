"use client";
import {useId} from 'react';
import {inspectPlayoffPrizePlanV2,isPlayoffPrizePlanDraftV2,playoffPrizeRecipientsV2,type PlayoffPrizePlanDraftV2,type PlayoffPrizeFieldV2} from '../lib/playoffs/playoff-prize-plan-v2';
import {validIncrementFactorDraftV1} from '../lib/playoffs/event-playoff-parameters-v1';
import './playoff-prize-plan-v2.css';
type Props={draft:PlayoffPrizePlanDraftV2;field:PlayoffPrizeFieldV2;onDraftChange:(next:PlayoffPrizePlanDraftV2,expected:PlayoffPrizePlanDraftV2)=>void;disabled?:boolean;saveConnected?:boolean};
/** Controlled local candidate. No legacy conversion, storage, requests, award
 * calculation or operational enablement. Host must compare the expected draft. */
export function PlayoffPrizePlanV2({draft,field,onDraftChange,disabled=false,saveConnected=false}:Props){
 const id=useId(),view=inspectPlayoffPrizePlanV2(draft,field);
 if(!isPlayoffPrizePlanDraftV2(draft))return <section aria-label="Playoff Prize Settings"><p role="status">Prize settings require review. Existing saved values have not been changed.</p></section>;
 const update=(next:Partial<PlayoffPrizePlanDraftV2>)=>onDraftChange({...draft,...next},draft);
 return <section className="playoff-prize-plan-v2" aria-labelledby={`${id}-heading`}>
  <h3 id={`${id}-heading`}>Playoff Prize Settings</h3>
  <p>{saveConnected?'Included in Save All Events Draft. No prize amounts or payments are calculated here.':'Proposed settings - not saved. No prize amounts or payments are calculated in this preview.'}</p>
  <div className="prize-plan-fields">
   <label htmlFor={`${id}-recipients`}>Who Receives Prize Money?<select id={`${id}-recipients`} disabled={disabled||draft.method==='winner-takes-all'} value={draft.method==='winner-takes-all'?'winner-only':draft.recipients} onChange={e=>update({recipients:e.target.value as PlayoffPrizePlanDraftV2['recipients']})}>{draft.method==='winner-takes-all'?<option value="winner-only">Winner Only</option>:playoffPrizeRecipientsV2.map(value=><option value={value} key={value}>{value==='all'?'All Playoff Qualifiers':`Top ${value.slice(4)} Places`}</option>)}</select></label>
   <label htmlFor={`${id}-method`}>Payout Method<select id={`${id}-method`} disabled={disabled} value={draft.method} onChange={e=>update({method:e.target.value as PlayoffPrizePlanDraftV2['method']})}><option value="graduated">Graduated</option><option value="equal">Equal</option><option value="winner-multiplier">Equal with Winner Multiplier</option><option value="winner-takes-all">Winner Takes All</option></select></label>
   {draft.method==='graduated'&&<label htmlFor={`${id}-factor`}>Increment Factor<input id={`${id}-factor`} disabled={disabled} required inputMode="decimal" maxLength={256} aria-invalid={!validIncrementFactorDraftV1(draft.incrementFactorText)} aria-describedby={`${id}-factor-help`} value={draft.incrementFactorText} onChange={e=>update({incrementFactorText:e.target.value})}/></label>}
   {draft.method==='winner-multiplier'&&<label htmlFor={`${id}-multiplier`}>Winner Multiplier<input id={`${id}-multiplier`} disabled={disabled} required inputMode="decimal" maxLength={256} aria-invalid={!validIncrementFactorDraftV1(draft.winnerMultiplierText)} aria-describedby={`${id}-factor-help`} value={draft.winnerMultiplierText} onChange={e=>update({winnerMultiplierText:e.target.value})}/></label>}
  </div>
  {(draft.method==='graduated'||draft.method==='winner-multiplier')&&<p id={`${id}-factor-help`}>Default: Graduated 1.5; Winner Multiplier 2. Enter a value from 1 to 1,000, with up to six decimal places.</p>}
  {draft.method==='winner-takes-all'&&<p role="status">Only the winner receives prize money. Your previous recipient choice is retained if you change methods.</p>}
  <fieldset disabled={disabled}><legend>Rounding</legend><div className="prize-plan-fields">{([['regular','Regular Prizes'],['qPool','Q-Pools'],['sidePool','Side Pools']] as const).map(([key,label])=><label htmlFor={`${id}-round-${key}`} key={key}>{label}<select id={`${id}-round-${key}`} value={draft.rounding[key]} onChange={e=>update({rounding:{...draft.rounding,[key]:e.target.value as '1'|'5'|'10'}})}><option value="1">$1 Increments</option><option value="5">$5 Increments</option><option value="10">$10 Increments</option></select></label>)}</div><p>Separate choices for each type. Existing settings are unchanged.</p></fieldset>
  {view.status==='blocked'?<p role="status">Review required: {view.code==='payments_beyond_qualifiers_policy_unresolved'?'The selected Top count exceeds the playoff field. Choose All Playoff Qualifiers or a smaller count; no automatic cap has been applied.':view.code==='invalid_factor'||view.code==='invalid_winner_multiplier'?'Enter a valid factor or multiplier. Your typed value is retained.':'The field or prize settings are incomplete or unsupported.'}</p>:<>
   <p role="status">{view.fieldKnown?`Playoff field: ${view.qualifierCount}. Planned paid places: ${view.includedPaidPlaces}. Prize amounts remain proposals until reviewed.`:'The playoff field is not known. Actual paid counts and prize amounts are not available.'}</p>
   {view.cutoffWarning&&<p className="prize-plan-notice">{view.cutoffWarning}</p>}
   {view.comparisonPending&&<p>First-round entry-fee comparison will appear when the reviewed field shows that first-round losers receive a prize.</p>}
   {view.comparisonVisible&&<div className="prize-plan-comparison"><label htmlFor={`${id}-comparison`}>First-Round Prize Compared with Entry Fee<select id={`${id}-comparison`} disabled={disabled} value={draft.firstRoundComparison} onChange={e=>update({firstRoundComparison:e.target.value as PlayoffPrizePlanDraftV2['firstRoundComparison']})}><option value="unset">Choose a Comparison</option><option value="less">Less than Entry Fee</option><option value="equal">Equal to Entry Fee</option><option value="more">More than Entry Fee</option></select></label><p>Applies only to first-round losers included in the paid places. This records your intention; it does not change the fund or calculate an amount.</p>
    {view.comparisonCompatibility==='incompatible_increment'&&<p className="prize-plan-notice" role="status">An amount exactly equal to the entry fee cannot use the selected regular-prize rounding increment. Review the rounding or comparison; no amount has been rounded or changed for you.</p>}
    {view.comparisonCompatibility==='pending_entry_fee'&&<p role="status">A known positive entry fee is required to check this comparison.</p>}
   </div>}
  </>}
  <p>Rounding differences and entry-fee comparisons require review before amounts can be calculated.</p>
 </section>;
}
