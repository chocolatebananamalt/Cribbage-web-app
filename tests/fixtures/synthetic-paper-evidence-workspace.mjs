// Portable fictional records, not hosted/physical cards or human verification.
import crypto from 'node:crypto';
export const id=n=>`b2660000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const actor=id(1),tid=id(2),eid=id(3);
export function artifact(n){
 const a={artifactId:id(n+100),gameId:id(n),eventId:eid,gameVersion:1};
 for(const side of['a','b']){
  const text=`SYNTHETIC TEST SCORECARD\nSchema: synthetic-paper-card-v1\nTournament: ${tid}\nEvent: ${eid}\nGame: ${a.gameId}\nGame version: 1\nCard side: ${side}\nParticipant: ${id(side==='a'?20:21)}\nOpponent: ${id(side==='a'?21:20)}\nVerification ID: A-${side==='a'?1:2}\nWinner side: a\nSpread points: 23\nNo physical original; no human review claimed.\n`;
  const sha256=crypto.createHash('sha256').update(text).digest('hex');a[side==='a'?'sideA':'sideB']={text,sha256,reference:`SYNTHETIC-v1:${a.artifactId}:${side}:${sha256}`};
 }return a;
}
export const capture=artifact(10),review=artifact(11);
export const game=n=>({gameId:id(n),eventId:eid,eventName:'TEST ONLY Main',gameNumber:1,gameVersion:1,sideA:{displayName:'TEST Alpha',verificationId:'A-1',profileLinked:false},sideB:{displayName:'TEST Bravo',verificationId:'A-2',profileLinked:false}});
export const reviewCase={...game(11),completionId:id(70)};delete reviewCase.eventId;
