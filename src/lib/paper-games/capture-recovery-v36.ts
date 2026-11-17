import {isCompletePaperGameRequest,isAcceptedPaperGameCompletion,isRejectedPaperGameCompletion,type CompletePaperGameRequest} from '../api/paper-game-completion.ts';
export function readPaperCaptureRecoveryV36(raw:string|null,scope:{gameId:string;eventId:string}) {
  if(raw===null)return {kind:'empty' as const};
  try{const request:unknown=JSON.parse(raw);if(isCompletePaperGameRequest(request)&&request.gameId===scope.gameId&&request.eventId===scope.eventId)return{kind:'bound' as const,request};}catch{}
  return{kind:'blocked' as const};
}
/** Historical capture receipt only; never independent confirmation. */
export function paperCaptureOutcomeV36(value:unknown,request:CompletePaperGameRequest,tournamentId:string) {
  if(isAcceptedPaperGameCompletion(value,request)&&(value as {tournamentId:string}).tournamentId===tournamentId)return 'accepted' as const;
  if(isRejectedPaperGameCompletion(value,request.completionId))return (value as {code:string}).code==='idempotency_conflict'?'conflict' as const:'rejected' as const;
  return 'unknown' as const;
}
