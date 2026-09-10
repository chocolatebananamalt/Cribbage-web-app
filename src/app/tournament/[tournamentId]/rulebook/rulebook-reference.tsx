"use client";

import { useMemo, useState } from "react";

const topics = [
  ["Score entry and verification", "Both assigned players submit matching results and each confirms before a digital result is official."],
  ["Paper and digital card", "Keep the paper card as the shared reference. Each assigned player signs in as themselves, independently enters and confirms the same result; a missing entry, mismatch, or player who cannot sign in stays pending for cross-checking or a judge."],
  ["Cross-checking and judges", "Use the dated ACC Rulebook for the rule text. An unresolved game stays pending for the authorized cross-check or judge process."],
  ["Corrections", "A permitted correction preserves the original value and audit history. A pending correction does not change standings or exports."],
  ["Table/Seat and verification ID", "The starting Table/Seat becomes the player’s permanent verification ID. Current game seating may change as the tournament rotates."],
] as const;

export default function RulebookReference() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? topics.filter(([title, description]) => `${title} ${description}`.toLowerCase().includes(needle)) : topics;
  }, [query]);

  return <section className="rulebook-reference" aria-label="ACC Rulebook reference">
    <p className="auth-note">Quick Reference helps you find a topic. It does not replace the dated ACC Rulebook or make an official rule interpretation.</p>
    <label className="search" htmlFor="rulebook-search">Search a topic or rule word<input id="rulebook-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example: cross-checking" /></label>
    <ul className="reference-list" aria-live="polite">{matches.map(([title, description]) => <li key={title}><strong>{title}</strong><span>{description}</span></li>)}</ul>
    {matches.length === 0 ? <p className="auth-note">No quick-reference topic matches. Open the cached Rulebook to search the official text.</p> : null}
  </section>;
}
