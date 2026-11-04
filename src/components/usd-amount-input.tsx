"use client";
import { useId, useState } from "react";
import { formatUsdInput, parseUsdMinor } from "../lib/money";

/** Keep partial/invalid dollar text visible; invalid amounts cannot form a valid API request. */
export function UsdAmountInput({ label, value, onChange }: { label: string; value: number; onChange: (minor: number) => void }) {
  const errorId = useId();
  const [view, setView] = useState(() => ({ minor: value, text: formatUsdInput(value) }));
  if (!Object.is(view.minor, value)) setView({ minor: value, text: formatUsdInput(value) });
  const invalid = parseUsdMinor(view.text, { allowZero: true }) === null;
  return <><input aria-label={label} inputMode="decimal" type="text" maxLength={32} value={view.text} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={event => {
    const text = event.target.value, minor = parseUsdMinor(text, { allowZero: true }) ?? Number.NaN;
    setView({ text, minor }); onChange(minor);
  }} />{invalid ? <span id={errorId} className="field-help">Enter a nonnegative dollar amount with no more than two decimal places.</span> : null}</>;
}
