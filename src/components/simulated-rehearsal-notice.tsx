import { SIMULATED_LINK_NOTICE } from "../lib/api/simulated-player-links";
export function SimulatedRehearsalNotice() {
  return <aside role="note" className="auth-note" aria-label="Simulated technical rehearsal"><strong>SIMULATED TEST</strong><p>{SIMULATED_LINK_NOTICE}</p></aside>;
}
