"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isCrossCheckerAssignmentResult, type CrossCheckerAssignmentWorkspace } from "../../../../lib/api/cross-checker-assignment";
import { formatUtcDateTime } from "../../../../lib/date-time";

export default function CrossCheckerAssignmentClient({ tournamentId, workspace }: {
  tournamentId: string;
  workspace: CrossCheckerAssignmentWorkspace;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [message, setMessage] = useState("Choose a linked tournament account, confirm the independent role, and assign it once.");

  async function assign(rosterEntryId: string) {
    if (busyId || confirmedId !== rosterEntryId) return;
    setBusyId(rosterEntryId);
    setMessage("Assigning cross-check authority…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/cross-checkers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ rosterEntryId, operationId: crypto.randomUUID() }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isCrossCheckerAssignmentResult(result, tournamentId, rosterEntryId)) {
        setConfirmedId(null);
        setMessage("Cross-checker assigned by the tournament server.");
        router.refresh();
        return;
      }
      setMessage(response.status === 409
        ? "The account is no longer eligible or was already assigned. Refresh and review the current list."
        : "The result is uncertain. Refresh before trying again.");
    } catch {
      setMessage("The result is uncertain. Refresh before trying again.");
    } finally {
      setBusyId(null);
    }
  }

  return <section aria-label={`Cross-checker assignments for ${workspace.tournamentName}`}>
    <p role="status" className="auth-note">{message}</p>
    <section>
      <h2>Assigned Cross-checkers</h2>
      {workspace.assignments.length === 0 ? <p>No cross-checker account is assigned yet.</p> : workspace.assignments.map((assignment) =>
        <article className="correction-item" key={assignment.assignmentId}>
          <h3>{assignment.displayName}</h3>
          <p>{assignment.assignedAt ? `Assigned ${formatUtcDateTime(assignment.assignedAt)}` : "Existing tournament assignment"}</p>
        </article>)}
    </section>
    <section>
      <h2>Eligible Linked Accounts</h2>
      {workspace.candidates.length === 0 ? <p>No eligible linked accounts are waiting for assignment. Activate the person&apos;s player account first.</p> : workspace.candidates.map((candidate) =>
        <article className="correction-item" key={candidate.rosterEntryId}>
          <h3>{candidate.displayName}</h3>
          <p><strong>{candidate.identityHint}</strong></p>
          <label className="check-row"><input type="checkbox" checked={confirmedId === candidate.rosterEntryId}
            onChange={(event) => setConfirmedId(event.target.checked ? candidate.rosterEntryId : null)} />I confirm this person will independently check other players&apos; cards.</label>
          <button className="primary" type="button" disabled={!!busyId || confirmedId !== candidate.rosterEntryId}
            onClick={() => void assign(candidate.rosterEntryId)}>Assign as Cross-checker</button>
        </article>)}
    </section>
  </section>;
}
