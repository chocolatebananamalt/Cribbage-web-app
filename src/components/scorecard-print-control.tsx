'use client';

import './scorecard-print.css';

/** Prints only the already authorized card. No data fetch, save or verification. */
export function ScorecardPrintControl() {
  return <div className="scorecard-print-controls">
    <button type="button" className="secondary" onClick={() => window.print()}>Print Scorecard</button>
    <p>The printed card is a copy of this view. Handwritten entries still need normal entry and independent verification.</p>
  </div>;
}
