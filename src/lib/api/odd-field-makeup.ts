import { isEventScheduleMatch, type EventScheduleMatch } from './event-schedule.ts';
import { isUuid } from './validation.ts';
import type { MakeupSeats } from '../results/odd-field-makeup.ts';

export type OddFieldMakeupRequest = {
  regularMatches: EventScheduleMatch[]; makeupSeats: MakeupSeats[];
  anchorCount: 0; reason: string; reviewed: true;
};
export type OddFieldMakeupResult = {
  status: 'odd_field_schedule_published'; eventId: string; publicationId: string;
  gameCount: 12; participantCount: 17; regularMatchCount: 96; makeupMatchCount: 6; matchCount: 102;
};
export type OddFieldMakeupWorkspace = {
  tournamentId: string; eventId: string; current: boolean;
  policyVersion: 'acc-director-manual-2019-12b-even-game-makeup-v1';
  qualifyingGameCount: 12; makeupBatchNumber: 13;
  makeups: Array<{ canonicalGameId: string; publicationId: string; sideACardGameNumber: number;
    sideBCardGameNumber: number; reason: string; recordedAt: string; actorId: string }>;
};
export type GameScorecardNumbers={gameId:string;eventId:string;schedulingBatchNumber:number;sideACardGameNumber:number;sideBCardGameNumber:number;isMakeup:boolean};
export function isGameScorecardNumbers(v:unknown,g:string):v is GameScorecardNumbers {
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!=='eventId,gameId,isMakeup,schedulingBatchNumber,sideACardGameNumber,sideBCardGameNumber')return false;
  const x=v as Record<string,unknown>;
  if(x.gameId!==g||!isUuid(x.eventId)||typeof x.isMakeup!=='boolean'
    ||![x.schedulingBatchNumber,x.sideACardGameNumber,x.sideBCardGameNumber].every(n=>Number.isSafeInteger(n)&&Number(n)>0))return false;
  return x.isMakeup?x.schedulingBatchNumber===13&&Number(x.sideACardGameNumber)>=1&&Number(x.sideACardGameNumber)<=6
    &&Number(x.sideBCardGameNumber)>=7&&Number(x.sideBCardGameNumber)<=12&&Number(x.sideACardGameNumber)+Number(x.sideBCardGameNumber)===13
    :x.schedulingBatchNumber===x.sideACardGameNumber&&x.schedulingBatchNumber===x.sideBCardGameNumber;
}
function record(v: unknown): v is Record<string,unknown> { return !!v && typeof v==='object' && !Array.isArray(v); }
function exact(v: Record<string,unknown>,k: string[]) { return Object.keys(v).length===k.length && k.every(x=>Object.hasOwn(v,x)); }
function reason(v: unknown): v is string { return typeof v==='string' && v.trim().length>=1 && v.trim().length<=500 && !/[\u0000-\u001f\u007f]/u.test(v); }
function seat(v: unknown): v is string { return typeof v==='string' && /^[A-Z]-[1-9][0-9]*$/.test(v); }
export function isOddFieldMakeupRequest(v: unknown): v is OddFieldMakeupRequest {
  return record(v) && exact(v,['regularMatches','makeupSeats','anchorCount','reason','reviewed'])
    && v.anchorCount===0 && v.reviewed===true && reason(v.reason)
    && Array.isArray(v.regularMatches) && v.regularMatches.length===96 && v.regularMatches.every(isEventScheduleMatch)
    && Array.isArray(v.makeupSeats) && v.makeupSeats.length===6 && v.makeupSeats.every(s=>record(s)
      && exact(s,['sideATableSeat','sideBTableSeat']) && seat(s.sideATableSeat) && seat(s.sideBTableSeat)
      && s.sideATableSeat!==s.sideBTableSeat && s.sideATableSeat[0]===s.sideBTableSeat[0]);
}
export function isOddFieldMakeupResult(v: unknown,e: string): v is OddFieldMakeupResult {
  return record(v) && exact(v,['status','eventId','publicationId','gameCount','participantCount','regularMatchCount','makeupMatchCount','matchCount'])
    && v.status==='odd_field_schedule_published' && v.eventId===e && isUuid(v.publicationId)
    && v.gameCount===12 && v.participantCount===17 && v.regularMatchCount===96 && v.makeupMatchCount===6 && v.matchCount===102;
}
export function isOddFieldMakeupWorkspace(v: unknown,t: string,e: string): v is OddFieldMakeupWorkspace {
  if(!record(v) || !exact(v,['tournamentId','eventId','current','policyVersion','qualifyingGameCount','makeupBatchNumber','makeups'])
    || v.tournamentId!==t || v.eventId!==e || typeof v.current!=='boolean'
    || v.policyVersion!=='acc-director-manual-2019-12b-even-game-makeup-v1' || v.qualifyingGameCount!==12 || v.makeupBatchNumber!==13
    || !Array.isArray(v.makeups) || ![0,6].includes(v.makeups.length)) return false;
  if(v.current && v.makeups.length!==6) return false;
  const games=new Set<string>(),aLines=new Set<number>(),bLines=new Set<number>();let publicationId: unknown;
  return v.makeups.every(m=>{
    if(!record(m)||!exact(m,['canonicalGameId','publicationId','sideACardGameNumber','sideBCardGameNumber','reason','recordedAt','actorId'])
      ||!isUuid(m.canonicalGameId)||!isUuid(m.publicationId)||!isUuid(m.actorId)||!reason(m.reason)
      ||typeof m.recordedAt!=='string'||Number.isNaN(Date.parse(m.recordedAt))
      ||!Number.isSafeInteger(m.sideACardGameNumber)||(m.sideACardGameNumber as number)<1||(m.sideACardGameNumber as number)>6
      ||!Number.isSafeInteger(m.sideBCardGameNumber)||(m.sideBCardGameNumber as number)<7||(m.sideBCardGameNumber as number)>12
      ||(m.sideACardGameNumber as number)+(m.sideBCardGameNumber as number)!==13
      ||games.has(m.canonicalGameId)||aLines.has(m.sideACardGameNumber as number)||bLines.has(m.sideBCardGameNumber as number)
      ||(publicationId!==undefined && publicationId!==m.publicationId)) return false;
    publicationId=m.publicationId;games.add(m.canonicalGameId);aLines.add(m.sideACardGameNumber as number);bLines.add(m.sideBCardGameNumber as number);return true;
  });
}
const codes=new Set(['invalid_request','tournament_unavailable','not_director','idempotency_conflict','unsupported_event','registration_open','schedule_already_published','invalid_schedule']);
export function isOddFieldMakeupRejected(v: unknown): v is {status:'rejected';code:string} {
  return record(v) && exact(v,['status','code']) && v.status==='rejected' && typeof v.code==='string' && codes.has(v.code);
}
