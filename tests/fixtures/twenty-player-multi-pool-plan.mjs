// Disposable local planning fixture. Not receipts, played games, or hosted evidence.
import { orderQCardsV2 } from '../../src/lib/results/q-operating-schedule.ts';
import { calculateGraduatedPoolAmountsV2 } from '../../src/lib/results/graduated-pool-amounts-v2.ts';

export function twentyPlayerMultiPoolPlan() {
  const players = Array.from({length:20},(_,i)=>({participantId:`test-player-${String(i+1).padStart(2,'0')}`,number:i+1,gamePoints:0,gamesWon:0,plusPoints:0,minusPoints:0,played:0,qualified:false,qualificationRank:null}));
  // Circle ordering starts with adjacent pairs, matching permanent table/seat IDs.
  let circle = [...players.filter(p=>p.number%2===1),...players.filter(p=>p.number%2===0).reverse()];
  const matches=[];
  for(let round=1;round<=12;round++) {
    for(let i=0;i<10;i++) {
      const a=circle[i],b=circle[19-i],winner=a.number<b.number?a:b,loser=winner===a?b:a;
      const spread=10+((round*17+a.number*7+b.number*11)%20);
      winner.gamePoints+=2;winner.gamesWon++;winner.plusPoints+=spread;winner.played++;loser.minusPoints+=spread;loser.played++;
      const id=p=>`${String.fromCharCode(65+Math.floor((p.number-1)/4))}-${(p.number-1)%4+1}`;
      const table=String.fromCharCode(65+Math.floor(i/2)),seat=i%2*2+1;
      matches.push({gameNumber:round,a:a.participantId,b:b.participantId,winner:winner.participantId,spreadPoints:spread,sideAVerificationId:id(a),sideBVerificationId:id(b),sideATableSeat:`${table}-${seat}`,sideBTableSeat:`${table}-${seat+1}`});
    }
    circle=[circle[0],circle[19],...circle.slice(1,19)];
  }
  // Qualification and Q cash ranking deliberately have different spread rules.
  const compare=(a,b)=>b.gamePoints-a.gamePoints||b.gamesWon-a.gamesWon||(b.plusPoints-b.minusPoints)-(a.plusPoints-a.minusPoints)||b.plusPoints-a.plusPoints;
  const ranking=[...players].sort(compare);
  if(ranking.some((p,i)=>i>0&&compare(p,ranking[i-1])===0))throw Error('Plan has an unresolved sporting tie');
  ranking.slice(0,5).forEach((p,i)=>{p.qualified=true;p.qualificationRank=i+1;});
  // Membership is frozen in this plan before any future fixture execution.
  const excluded=new Set([ranking[1].participantId,ranking[3].participantId,ranking[18].participantId,ranking[19].participantId]);
  const paid=players.filter(p=>!excluded.has(p.participantId));
  const paidRanking=orderQCardsV2(paid,[]);
  if(!paidRanking)throw Error('Paid card ranking requires a tie decision');
  const calculation=calculateGraduatedPoolAmountsV2({paidCount:paid.length,feeMinor:1000,ratio:4});
  if(calculation.status!=='calculated')throw Error('Amount calculation blocked');
  return {kind:'LOCAL SYNTHETIC PLAN — no physical play or money',players,ranking,matches,paidIds:paid.map(p=>p.participantId),qAwards:paidRanking.slice(0,calculation.recipientCount).map((p,i)=>({participantId:p.participantId,qualified:p.qualified,amountMinor:calculation.awardsMinor[i]})),calculation,plannedBaseMinor:20*5000};
}
