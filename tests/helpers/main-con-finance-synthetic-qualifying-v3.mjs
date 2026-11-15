// Synthetic qualifying evidence ONLY. Not normal Start/player/provider proof.
export function syntheticQualifyingGamesV3(count,rounds){
 if(count%2||rounds>=count||rounds<1)throw Error('Even bounded qualifying fixture required');
 for(let seed=1;seed<100;seed++){
  let ring=Array.from({length:count},(_,i)=>i+1),rng=seed;const matches=[],stats=Array.from({length:count},(_,i)=>({id:i+1,points:0,spread:0}));
  for(let round=1;round<=rounds;round++){
   for(let board=0;board<count/2;board++){
    const a=ring[board],b=ring[count-1-board],winner=Math.min(a,b);rng=(Math.imul(rng,1664525)+1013904223)>>>0;const margin=1+rng%30;
    const seat=n=>String.fromCharCode(65+Math.floor((n-1)/4))+'-'+((n-1)%4+1);
    matches.push({a,b,round,winner,margin,aSeat:seat(a),bSeat:seat(b)});
    stats[a-1].points+=winner===a?2:0;stats[b-1].points+=winner===b?2:0;stats[a-1].spread+=winner===a?margin:-margin;stats[b-1].spread+=winner===b?margin:-margin;
   }
   ring=[ring[0],ring.at(-1),...ring.slice(1,-1)];
  }
  stats.sort((a,b)=>b.points-a.points||b.spread-a.spread);
  if(!stats.some((a,i)=>i&&a.points===stats[i-1].points&&a.spread===stats[i-1].spread))return matches;
 }
 throw Error('Synthetic standings tie; no official tie policy is bypassed');
}
