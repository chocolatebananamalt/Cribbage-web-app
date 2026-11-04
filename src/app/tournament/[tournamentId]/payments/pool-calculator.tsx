"use client";

import { useMemo, useState } from "react";
import { calculateGraduatedPoolAmountsV2 } from "../../../../lib/results/graduated-pool-amounts-v2";
import { parseUsdMinor } from "../../../../lib/money";

const money = (minor: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(minor / 100);

function positiveWhole(value: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function PoolCalculator() {
  const [players, setPlayers] = useState("20");
  const [ratio, setRatio] = useState("6");
  const [fee, setFee] = useState("10.00");
  const estimate = useMemo(() => {
    const playerCount = positiveWhole(players);
    const payoutRatio = positiveWhole(ratio);
    const entryFeeMinor = parseUsdMinor(fee, { maxMinor: 100_000_000 });
    if (!playerCount || !payoutRatio || !entryFeeMinor) return null;
    try {
      const result = calculateGraduatedPoolAmountsV2({ paidCount: playerCount, ratio: payoutRatio, feeMinor: entryFeeMinor });
      return result.status === 'calculated' ? result : null;
    } catch {
      return null;
    }
  }, [fee, players, ratio]);

  return <section className="policy-settings pool-calculator" aria-labelledby="pool-calculator-title">
    <h2 id="pool-calculator-title">Graduated pool calculator</h2>
    <p>Uses the ACC calculator&apos;s raw graduated weights with this app&apos;s exact largest-remainder $5 rounding. Every $5 is assigned automatically and awards equal the fund. This modification is not ACC endorsement. Recipient eligibility and score ties are reviewed separately; no money moves here.</p>
    <div className="setup-grid">
      <label>Players in pool<input inputMode="numeric" min="1" max="10000" step="1" type="number" value={players} onChange={(event) => setPlayers(event.target.value)} /></label>
      <label>Payout 1-in-<input inputMode="numeric" min="2" max="100" step="1" type="number" value={ratio} onChange={(event) => setRatio(event.target.value)} /></label>
      <label>Entry fee per player (USD)<input inputMode="decimal" min="5" max="1000000" step="5" type="number" value={fee} onChange={(event) => setFee(event.target.value)} /></label>
    </div>
    {estimate ? <div className="pool-output" aria-live="polite">
      <p><strong>{estimate.recipientCount}</strong> calculated total awards from a <strong>{money(estimate.fundMinor)}</strong> fund.</p>
      <ol>{estimate.awardsMinor.map((amount, index) => <li key={index}><span>Place {index + 1}</span><strong>{money(amount)}</strong></li>)}</ol>
      <p className="status">Award total: {money(estimate.fundMinor)}. The calculated awards equal the fund; no leftover-placement decision is needed.</p>
      <p>Calculation version: {estimate.policyVersion}. Remainder ties favor the higher finishing place.</p>
    </div> : <p className="error-text" role="status">Enter 1–10,000 players, a whole-number ratio from 2–100, and a USD fee from $5 to $1,000,000 in $5 increments.</p>}
  </section>;
}
