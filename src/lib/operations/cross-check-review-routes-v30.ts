import {crossCheckConditionCodes,type CrossCheckCondition} from '../api/cross-check-finalization.ts';
import {isUuid} from '../api/validation.ts';
export type CrossCheckReviewAccessV30={canAssignCrossCheckers:boolean;correctionsEnabled:boolean;eventDeskEnabled:boolean;manualCardsEnabled:boolean;digitalQueueEnabled?:boolean};
export type CrossCheckReviewRouteV30={links:{label:string;href:string}[];note:string};
/** Navigation only. Counts and completion authority stay with the existing
 * server workspace/writer. No inferred event, player, score or permission. */
export function crossCheckReviewRoutesV30(tournamentId:string,condition:CrossCheckCondition,access:CrossCheckReviewAccessV30):CrossCheckReviewRouteV30|null {
 if(!isUuid(tournamentId)||!crossCheckConditionCodes.includes(condition.code)||!condition.outstanding||!Number.isSafeInteger(condition.count)||condition.count<1)return null;
 const root='/tournament/'+tournamentId,link=(label:string,suffix:string)=>({label,href:root+'/'+suffix});
 switch(condition.code){
  case 'tournament_not_open_for_cross_check':return{links:[link('Review tournament status','setup')],note:'Review the saved tournament status. This link does not change it.'};
  case 'cross_checkers_not_assigned':return access.canAssignCrossCheckers?{links:[link('Review cross-checker assignments','cross-checkers')],note:'The primary Director assigns cross-checkers; assignment alone does not verify a score.'}:{links:[],note:'Ask the primary Director to review cross-checker assignments.'};
  case 'games_not_verified':return{links:[...(access.digitalQueueEnabled?[link('Review unresolved scheduled games','unresolved-games')]:[]),link('Find published games','schedule'),...(access.manualCardsEnabled?[link('Review original paper cards','manual-paper-cards')]:[])],note:'Locate pairings by event. Ordinary digital players enter and confirm on their own My Games screens; Schedule is not an unverified-game review queue. Use the original paper card for independent manual review.'};
  case 'team_games_not_verified':return{links:[link('Review team scorecards','teams')],note:'Choose the team event. Each destination rechecks its authorized actions.'};
  case 'corrections_pending':return access.correctionsEnabled?{links:[link('Review pending corrections','corrections')],note:'A different eligible official must review where required; opening the queue changes no score.'}:{links:[],note:'The correction workflow is not enabled here. Pending corrections remain outstanding.'};
  case 'disputes_unresolved':return access.eventDeskEnabled?{links:[link('Choose an event to review disputes','event-desk')],note:'Choose the affected event, then Review Event Disputes. No event is inferred from this tournament-wide count.'}:{links:[],note:'The event dispute directory is not enabled here. Existing disputes remain outstanding.'};
  case 'device_recoveries_awaiting_review':return{links:[link('Review failed-device recovery','recoveries')],note:'Preserve original device and paper evidence. Opening this queue does not approve or clear recovery.'};
  case 'hybrid_cases_awaiting_review':return{links:[link('Review digital-versus-paper games','hybrid-games')],note:'Original paper and independent review remain required; a player response is tentative.'};
  case 'paper_completions_awaiting_review':return{links:[link('Review paper-versus-paper games','paper-games')],note:'Read both original cards and complete the independent review; no photo is required.'};
  case 'cashing_placements_without_cross_check_evidence':return{links:[link('Review Satellite cashing-card evidence','satellite-results')],note:'This condition counts Satellite cashing-card evidence. It does not authorize payouts or infer Main results.'};
  case 'satellite_results_not_marked_cross_check_complete':return{links:[link('Review Satellite cross-check completion','satellite-results')],note:'Choose the Satellite event and review its current package. Tournament completion is separate.'};
 }
}
