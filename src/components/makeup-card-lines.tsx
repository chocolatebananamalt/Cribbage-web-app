import type {GameScorecardNumbers} from '../lib/games/scorecard-number-context';
export function MakeupCardLines({numbers,sideAName,sideBName}:{numbers:GameScorecardNumbers|null|undefined;sideAName:string;sideBName:string}) {
  if(!numbers?.isMakeup)return null;
  return <p className="auth-note"><strong>Qualifying makeup, scheduling batch 13.</strong> {sideAName}: original card game {numbers.sideACardGameNumber}; {sideBName}: original card game {numbers.sideBCardGameNumber}. Each player still has twelve qualifying games. This is not a thirteenth game.</p>;
}
