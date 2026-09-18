"use client";

import { useEffect, useState } from "react";
import { isSetupOfficialsWorkspace, setupOfficialRoles, type SetupOfficialsWorkspace, type SetupOfficialRole } from "../../../../lib/api/setup-officials";

const labels: Record<SetupOfficialRole, string> = { co_director: "Co-Directors", cross_checker: "Cross-Checkers", judge: "Judges" };

const statusLabel = (status: string) => status === "registered_approved" ? "Registered & Approved" : status === "invitation_email_sent" ? "Not Registered — invitation email sent" : "Invitation delivery unavailable";

export default function SetupOfficialSummaries({ tournamentId, canManage }: { tournamentId: string; canManage: boolean }) {
  const [workspaces, setWorkspaces] = useState<Partial<Record<SetupOfficialRole, SetupOfficialsWorkspace>>>({});
  useEffect(() => { void Promise.all(setupOfficialRoles.map(async (role) => {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup-officials/${role}`, { credentials: "same-origin", cache: "no-store" });
    const data: unknown = await response.json().catch(() => null);
    return isSetupOfficialsWorkspace(data) ? [role, data] as const : [role, undefined] as const;
  })).then((rows) => setWorkspaces(Object.fromEntries(rows))); }, [tournamentId]);
  return <section className="setup-subsection setup-wide" aria-labelledby="setup-officials-title"><h3 id="setup-officials-title">Tournament officials</h3><p className="field-help">A person may hold more than one role. Authority begins only after secure sign-in through that person’s exact email.</p>{setupOfficialRoles.map((role) => { const workspace = workspaces[role]; return <div key={role} className="setup-official-summary"><span><strong>{labels[role]}</strong><small>{workspace ? `${workspace.entries.length} of 12 listed` : "Loading…"}</small>{workspace?.entries.map((entry) => <small key={entry.nominationId}>{entry.displayName} — {statusLabel(entry.status)}</small>)}</span>{canManage ? <a className="secondary button-link" href={`/tournament/${tournamentId}/setup/officials/${role}`}>Add/Remove</a> : null}</div>; })}</section>;
}
