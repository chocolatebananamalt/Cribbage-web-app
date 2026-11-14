import {isTournamentResultEventSummary} from '../api/result-event-summary.ts';
import {isEventControlWorkspace} from '../api/event-control.ts';
import {isCrossCheckFinalizationWorkspace} from '../api/cross-check-finalization.ts';
import {integratedTestUiEnabled} from '../integrated-test-target.ts';
export const eventDeskEnabledV1=()=>integratedTestUiEnabled();
export type DeskIdentity={actorId:string;sessionId:string;role:string};
export type DeskPorts={access:()=>Promise<DeskIdentity|null>;capture:(actor:string)=>Promise<{summary:unknown;control:unknown;crossCheck:unknown}>};
export async function readEventDeskV1(tournamentId:string,ports:DeskPorts){
 const before=await ports.access();if(!before||!['director','co_director'].includes(before.role))return null;
 const raw=await ports.capture(before.actorId);const after=await ports.access();
 if(!after||before.actorId!==after.actorId||before.sessionId!==after.sessionId||before.role!==after.role)return null;
 if(!isTournamentResultEventSummary(raw.summary)||raw.summary.tournamentId!==tournamentId||new Set(raw.summary.events.map(e=>e.eventId)).size!==raw.summary.events.length)return null;
 const control=isEventControlWorkspace(raw.control)&&new Set(raw.control.events.map(e=>e.eventId)).size===raw.control.events.length?raw.control:null;
 const crossCheck=isCrossCheckFinalizationWorkspace(raw.crossCheck,tournamentId)&&raw.crossCheck.tournamentId===tournamentId?raw.crossCheck:null;
 return {summary:raw.summary,control,crossCheck};
}
export function deskEventProgressV1(event:{format:string;eventType:string},control: {started:boolean;pauseState:string;closeState:string;readiness:{scheduledGames:number;resolvedGames:number;unresolvedGames:number}}|undefined){
 if(event.format!=='standard_singles')return 'Use the format-specific scorecards; singles completion is not inferred.';
 if(!control)return 'Play status unavailable. Open the event workflow to refresh its current source.';
 const r=control.readiness;if(r.resolvedGames+r.unresolvedGames!==r.scheduledGames||(!control.started&&control.closeState==='closed'))return 'Conflicting play evidence. Review the event before continuing.';
 if(!control.started)return 'Not started. Review check-in and the published schedule before Start.';
 if(control.closeState==='closed')return event.eventType==='satellite'?'Play closed. Review Satellite results and recorded funds.':'Play closed. Review qualification, playoffs and prizes in Results.';
 if(control.pauseState==='paused')return 'Play paused. Review Event Play Control before resuming.';
 if(r.scheduledGames>0&&r.unresolvedGames===0)return 'All scheduled games recorded as resolved. Review Close Event; this does not finalize results or finances.';
 return 'Play started. Complete score entry and independent verification before closing.';
}
