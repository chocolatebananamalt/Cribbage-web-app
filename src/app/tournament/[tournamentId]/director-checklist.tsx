import Link from "next/link";
import { directorChecklist, type DirectorChecklistSnapshot } from "../../../lib/director-checklist";

export default function DirectorChecklist({ tournamentId, snapshot }: { tournamentId: string; snapshot: DirectorChecklistSnapshot }) {
  const steps = directorChecklist(snapshot);
  const next = steps.find((step) => step.state !== "Complete");
  return <section className="director-checklist" aria-labelledby="director-checklist-title">
    <h2 id="director-checklist-title">Director setup checklist</h2>
    <p>Saved server status at page load. Refresh after changes. This guide does not replace the checks on each operations screen.</p>
    {next ? <p className="auth-note"><strong>Next action:</strong> <Link href={`/tournament/${tournamentId}/${next.path}`}>{next.state === "Check status" ? `Check saved status: ${next.title.toLowerCase()}` : next.title}</Link> — {next.detail}</p> : <p>Setup and event starts are recorded. Continue with event play control and cross-checking.</p>}
    <ol>{steps.map((step) => <li key={step.title}><div><strong>{step.title}</strong> <span className="checklist-state">{step.state}</span></div><p>{step.detail}</p><Link className="guide-link" href={`/tournament/${tournamentId}/${step.path}`}>Open {step.title.toLowerCase()}</Link></li>)}</ol>
    <p>Exceptional corrections and all existing tools remain available below. A completed step can need attention again after a correction.</p>
  </section>;
}
