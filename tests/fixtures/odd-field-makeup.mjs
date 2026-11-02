// Fictional local zero-anchor circle schedule, not a prescribed ACC rotation.
export function oddFieldFixture() {
  const verificationId = n => `${String.fromCharCode(65+Math.floor((n-1)/4))}-${(n-1)%4+1}`;
  let ring = Array.from({length:18}, (_, i) => i + 1);
  const regularMatches = [];
  for (let round=1;round<=12;round++) {
    let pair=0;
    for(let i=0;i<9;i++) {
      const a=ring[i], b=ring[17-i]; if(a===18 || b===18) continue;
      // Circle pairing's fixed array index is not a stationary physical seat:
      // rotate every occupied board position each round, so no one is an anchor.
      const seat=2*((pair+round-1)%8),table=String.fromCharCode(65+Math.floor(seat/4));
      regularMatches.push({gameNumber:round,sideAVerificationId:verificationId(a),sideBVerificationId:verificationId(b),
        sideATableSeat:`${table}-${seat%4+1}`,sideBTableSeat:`${table}-${seat%4+2}`});pair++;
    }
    ring=[ring[0],ring[17],...ring.slice(1,17)];
  }
  const verificationIds=Array.from({length:17}, (_,i)=>verificationId(i+1));
  const makeupSeats=Array.from({length:6},(_,i)=>({sideATableSeat:`${String.fromCharCode(65+Math.floor(i/2))}-${i%2*2+1}`,
    sideBTableSeat:`${String.fromCharCode(65+Math.floor(i/2))}-${i%2*2+2}`}));
  return {regularMatches,verificationIds,makeupSeats};
}

// New initial publications align round-one seats. Keep oddFieldFixture intact
// above as the historical replay/currentness regression fixture.
export function startingSeatAlignedOddFieldFixture() {
  const fixture = oddFieldFixture();
  const mapping = new Map();
  for (const m of fixture.regularMatches.filter(m => m.gameNumber === 1)) {
    mapping.set(m.sideAVerificationId, m.sideATableSeat);
    mapping.set(m.sideBVerificationId, m.sideBTableSeat);
  }
  const sitout = fixture.verificationIds.find(id => !mapping.has(id));
  const freeSeat = fixture.verificationIds.find(id => ![...mapping.values()].includes(id));
  mapping.set(sitout, freeSeat);
  return {...fixture, regularMatches: fixture.regularMatches.map(m => ({...m,
    sideAVerificationId: mapping.get(m.sideAVerificationId),
    sideBVerificationId: mapping.get(m.sideBVerificationId)}))};
}
