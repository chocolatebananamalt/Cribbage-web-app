"use client";

export default function GameError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="game-unavailable-title"><p className="eyebrow">SCORE ENTRY</p><h1 id="game-unavailable-title">Game workspace temporarily unavailable</h1><p className="auth-note">No result can be recorded until the tournament system is current. Reconnect and try again, or ask a director to verify the system.</p><button type="button" className="primary-action" onClick={reset}>Try again</button></section></main>;
}
