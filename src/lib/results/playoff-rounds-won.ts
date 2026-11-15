import {calculateStandardSinglesMrpReference, type StandardSinglesMrpReferenceInput} from './standard-singles-mrp-reference.ts';

export type PlayoffWinsInput = Omit<StandardSinglesMrpReferenceInput, 'playoffExitRound'> & {
  /** Main-bracket match wins before elimination; excludes backward playoffs. */
  roundsWon: number;
  /** Awarded main-bracket byes, separately evidenced; not played matches. */
  byesWon: number;
};

/**
 * Local source-backed calculation boundary. Not connected to legacy persistence.
 * MainMRPs/ConMRPs: all qualifiers earn the first credit; each win/bye advances
 * that credit. A credit index is NOT an elimination round or a played round.
 */
export function calculateStandardSinglesMrpFromWins(input: PlayoffWinsInput) {
  const fields=['eventType','gameCount','qualifierCount','qualificationRank','gamePoints','roundsWon','byesWon'];
  if (!input || Object.keys(input).sort().join(',') !== fields.sort().join(',')) throw new TypeError('Unexpected playoff fields.');
  if (!Number.isSafeInteger(input.qualifierCount) || input.qualifierCount < 2 || input.qualifierCount > 256) throw new RangeError('Unsupported playoff qualifier count.');
  if (!Number.isSafeInteger(input.qualificationRank) || input.qualificationRank<1 || input.qualificationRank>input.qualifierCount) throw new RangeError('Invalid qualification rank.');
  const wins=input.roundsWon+input.byesWon;
  const bracketRounds=Math.max(2,Math.ceil(Math.log2(input.qualifierCount)));
  const firstRoundByeCount=2**bracketRounds-input.qualifierCount;
  if (![input.roundsWon,input.byesWon].every(n=>Number.isSafeInteger(n)&&n>=0)
    || input.byesWon !== (input.qualificationRank<=firstRoundByeCount?1:0)
    || wins>bracketRounds) throw new RangeError('Invalid main-bracket wins.');
  const playoffCreditIndex=wins+1;
  const result=calculateStandardSinglesMrpReference({eventType:input.eventType,gameCount:input.gameCount,qualifierCount:input.qualifierCount,
    qualificationRank:input.qualificationRank,gamePoints:input.gamePoints,playoffExitRound:playoffCreditIndex});
  return {...result,playoffCreditIndex};
}

export type EliminationRecord={participantId:string;eliminatedInRound:number|null};
export type EliminationCohort={eliminatedInRound:number|null;bandStart:number;bandEnd:number;participantIds:string[]};

/**
 * A representation of supplied same-round elimination, not an ACC label rule.
 * Caller must validate the bracket evidence separately. Prize/trophy order is
 * deliberately absent; canonical ID sorting is only stable serialization.
 */
export function groupEliminationCohorts(records:EliminationRecord[]):EliminationCohort[] {
  if (!Array.isArray(records) || records.length<2 || records.length>256
    || records.some(r=>!r || typeof r.participantId!=='string' || !r.participantId.trim() || r.participantId!==r.participantId.trim())
    || new Set(records.map(r=>r.participantId)).size!==records.length) throw new TypeError('Unique playoff participants required.');
  if (records.filter(r=>r.eliminatedInRound===null).length!==1) throw new TypeError('Exactly one champion required.');
  if (records.some(r=>r.eliminatedInRound!==null&&(!Number.isSafeInteger(r.eliminatedInRound)||r.eliminatedInRound<1||r.eliminatedInRound>8))) throw new RangeError('Invalid elimination round.');
  const rounds=[...new Set(records.map(r=>r.eliminatedInRound))].sort((a,b)=>a===null?-1:b===null?1:b-a);
  let next=1;
  return rounds.map(round=>{const participantIds=records.filter(r=>r.eliminatedInRound===round).map(r=>r.participantId).sort();
    const cohort={eliminatedInRound:round,bandStart:next,bandEnd:next+participantIds.length-1,participantIds};next=cohort.bandEnd+1;return cohort;});
}
