"use client";

import { useMemo, useState } from "react";
import { estimateGraduatedPool } from "../../../../lib/finance/graduated-pool";
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
      return estimateGraduatedPool({ playerCount, payoutRatio, entryFeeMinor });
    } catch {
      return null;
    }
  }, [fee, players, ratio]);

  return <section className="policy-settings pool-calculator" aria-labelledby="pool-calculator-title">
    <h2 id="pool-calculator-title">Graduated pool calculator</h2>
    <p>Matches the ACC Side Pool Calculator&apos;s one-in-X estimate and nearest-$5 rounding. Review and adjust the suggested amounts before treating them as payouts.</p>
    <div className="setup-grid">
      <label>Players in pool<input inputMode="numeric" min="2" step="1" type="number" value={players} onChange={(event) => setPlayers(event.target.value)} /></label>
      <label>Payout 1-in-<input inputMode="numeric" min="2" step="1" type="number" value={ratio} onChange={(event) => setRatio(event.target.value)} /></label>
      <label>Entry fee per player<input inputMode="decimal" min="0.01" step="0.01" type="number" value={fee} onChange={(event) => setFee(event.target.value)} /></label>
    </div>
    {estimate ? <div className="pool-output" aria-live="polite">
      <p><strong>{estimate.winnerCount}</strong> suggested payouts from a <strong>{money(estimate.fundMinor)}</strong> fund.</p>
      <ol>{estimate.awardsMinor.map((amount, index) => <li key={index}><span>Place {index + 1}</span><strong>{money(amount)}</strong></li>)}</ol>
      <p className={estimate.manualAdjustmentRequired ? "error-text" : "status"}>
        Suggested total: {money(estimate.awardTotalMinor)}. {estimate.manualAdjustmentRequired
          ? `${money(Math.abs(estimate.differenceMinor))} ${estimate.differenceMinor > 0 ? "remains to assign" : "must be removed"} before payout approval.`
          : "The suggested awards equal the fund."}
      </p>
    </div> : <p className="error-text" role="status">Enter possible whole-number player and ratio values and a positive fee.</p>}
  </section>;
}
