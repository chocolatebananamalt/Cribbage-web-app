export const startId=n=>`cd130000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const startScope={actorId:startId(1),tournamentId:startId(2),eventId:startId(3)};
export const startRequest={kind:'native-mixed-simulation-start-v1',operationId:startId(4),expectedContextId:startId(5),
 expectedScheduleSourceDigest:'a'.repeat(64),expectedAttendanceSourceDigest:'b'.repeat(64),
 statement:'fictional-test-only-no-ordinary-attendance-v1',reason:'TEST ONLY fictional simulated Start'};
export function startReceipt(historical=false){return{kind:'native-mixed-simulation-start-receipt-v1',status:'accepted',code:'simulated_start_recorded',
 ...startScope,operationId:startRequest.operationId,request:structuredClone(startRequest),startId:startId(6),contextId:startRequest.expectedContextId,
 sourceDigest:'c'.repeat(64),startedAt:'2026-11-06T20:00:00.000Z',participantCount:18,gameCount:12,matchCount:108,simulationStarted:true,
 currentSourceVerified:!historical,historicalReceipt:historical,ordinaryAttendanceUsed:false,normalStartAuthorized:false,scoringAuthorized:false,
 humanPresenceVerified:false,paymentVerified:false,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};}
