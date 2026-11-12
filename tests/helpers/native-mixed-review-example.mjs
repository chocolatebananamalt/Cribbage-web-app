import fs from 'node:fs';
// Static captured FICTIONAL SQL output from the cleaned Nov7 local18/108 run.
// Not live data, a provider session, or runtime evidence for the new wrapper.
export function nativeMixedReviewExample(){const review=JSON.parse(fs.readFileSync('tests/fixtures/native-mixed-review-completed-v1.json','utf8')),context={projectRef:'nnhcnvksxgxnpvdqjgpg',scope:{actorId:'b1310000-0000-4000-8000-000000000901',tournamentId:review.tournamentId,eventId:review.eventId},sessionId:'b1310000-0000-4000-8000-000000000902'};return{context,review,envelope:{kind:'native-mixed-review-provider-v1',actorId:context.scope.actorId,sessionId:context.sessionId,tournamentId:review.tournamentId,eventId:review.eventId,review}};}
