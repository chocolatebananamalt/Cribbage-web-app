"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAccNumber, normalizeAccNumberInput } from "../../../../../../lib/acc-number";
import { officialRejectionMessage, type SetupOfficialRole, type SetupOfficialsWorkspace } from "../../../../../../lib/api/setup-officials";

const label: Record<SetupOfficialRole, string> = { co_director: "Co-Director", cross_checker: "Cross-Checker", judge: "Judge" };

export default function SetupOfficialsClient({ tournamentId, role, initial }: { tournamentId: string; role: SetupOfficialRole; initial: SetupOfficialsWorkspace }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [email, setEmail] = useState(""); const [accNumber, setAccNumber] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const complete = firstName.trim().length > 0 && firstName.trim().length <= 80 && lastName.trim().length > 0 && lastName.trim().length <= 80 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && isAccNumber(normalizeAccNumberInput(accNumber));
  // Save is disabled until every field is usable, which is correct, but a
  // disabled button with no reason reads as a broken button. The ACC # is the
  // one that catches people: it needs a two-letter state prefix, so a bare
  // member number leaves Save greyed out with nothing on screen to explain it.
  const accTyped = normalizeAccNumberInput(accNumber);
  const unavailableReason = initial.entries.length >= initial.capacity
    ? `All ${initial.capacity} positions are filled. Remove one before adding another.`
    : complete ? null
    : firstName.trim().length === 0 || lastName.trim().length === 0 ? "Enter the person's first and last name."
    : firstName.trim().length > 80 || lastName.trim().length > 80 ? "First and last name are limited to 80 characters each."
    : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? "Enter the email address this person will sign in with."
    : accTyped.length === 0 ? "Enter the ACC #, for example HI296."
    : "That ACC # is not in ACC format. It is a two-letter state abbreviation followed by the number, such as HI296, or HI296Y for a youth official.";
  async function submit() {
    if (!complete || busy) return;
    setBusy(true); setMessage(`Saving ${label[role]}…`);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup-officials/${role}`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), accNumber: normalizeAccNumberInput(accNumber), operationId: crypto.randomUUID() }) });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data !== "object") {
        // The server already told us exactly why. Show that instead of blaming
        // the director's typing, which is almost never the actual cause.
        const code = data && typeof data === "object" ? (data as Record<string, unknown>).code : undefined;
        setMessage(officialRejectionMessage(code, role));
        return;
      }
      const result = data as Record<string, unknown>;
      setMessage(result.status === "registered_approved" ? `${label[role]} is Registered & Approved.` : result.status === "invitation_email_sent" ? `Not Registered — invitation email sent.` : "The official was saved, but email delivery could not be confirmed.");
      setFirstName(""); setLastName(""); setEmail(""); setAccNumber(""); router.refresh();
    } catch { setMessage("The result could not be confirmed. Refresh before trying again."); } finally { setBusy(false); }
  }
  async function manage(nominationId: string, action: "remove" | "restore") {
    if (busy) return; setBusy(true); setMessage(action === "remove" ? "Removing official authority…" : "Restoring official authority…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup-officials/${role}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ nominationId, action, operationId: crypto.randomUUID() }) });
      const patched: unknown = response.ok ? null : await response.json().catch(() => null);
      const patchCode = patched && typeof patched === "object" ? (patched as Record<string, unknown>).code : undefined;
      setMessage(response.ok ? action === "remove" ? "Official authority was removed immediately." : "Official authority was restored." : officialRejectionMessage(patchCode, role));
      if (response.ok) router.refresh();
    } catch { setMessage("The result could not be confirmed. Refresh before trying again."); } finally { setBusy(false); }
  }
  return <section className="director-admin-workspace"><p className="auth-note" role="status">{message || `${initial.entries.length} of ${initial.capacity} ${label[role].toLowerCase()} positions are active or awaiting secure sign-in.`}</p><ul className="director-admin-list">{initial.entries.map((entry) => <li key={entry.nominationId}><div><strong>{entry.displayName}</strong>{entry.accNumber || entry.email ? <span>{[entry.accNumber, entry.email].filter(Boolean).join(" · ")}</span> : <span>Historic official identity</span>}<span>{entry.status === "registered_approved" ? "Registered & Approved" : entry.status === "invitation_email_sent" ? "Not Registered — invitation email sent" : "Invitation delivery unavailable"}</span></div><div className="director-admin-buttons"><button type="button" className="secondary" disabled={busy} onClick={() => void manage(entry.nominationId, "remove")}>Remove</button></div></li>)}</ul>{initial.canManage ? <section className="manual-roster-panel"><h2>Add {label[role]}</h2><div className="manual-roster-form"><label><span className="required-label">First name (<span className="required-field" aria-hidden="true">*</span>required)</span><input required aria-required="true" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label><span className="required-label">Last name (<span className="required-field" aria-hidden="true">*</span>required)</span><input required aria-required="true" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label><span className="required-label">Email (<span className="required-field" aria-hidden="true">*</span>required)</span><input required aria-required="true" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span className="required-label">ACC # (<span className="required-field" aria-hidden="true">*</span>required)</span><input required aria-required="true" value={accNumber} pattern="[A-Z]{2}[0-9]+Y?" onChange={(event) => setAccNumber(normalizeAccNumberInput(event.target.value))} /><span className="field-help">Use HI296, or HI296Y for a youth official. The pattern input attribute never reaches the director here, because Save stays disabled and the form is never submitted.</span></label></div>{unavailableReason ? <p className="field-help" role="status">{unavailableReason}</p> : null}<button className="primary" type="button" disabled={busy || !complete || initial.entries.length >= initial.capacity} onClick={() => void submit()}>Save</button></section> : null}</section>;
}
