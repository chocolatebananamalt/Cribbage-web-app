import type { ActivationRedemptionResult } from "../lib/api/roster-account-activation";
import { ActivationDeadline } from "./activation-deadline";

export function ActivationWitness({ pending }: { pending: ActivationRedemptionResult }) {
  return <section className="correction-item" aria-labelledby="witness-title">
    <h2 id="witness-title">Confirm with the tournament director</h2>
    <p>Compare both values in the tournament activation workspace. Normal activations require an in-person independent witness; an explicitly labelled test simulation does not claim that witness. The approving account must be signed in separately and cannot approve its own request.</p>
    <ActivationDeadline expiresAt={pending.expiresAt} />
    <p><strong>Request ID</strong><br /><code>{pending.requestId}</code></p>
    <p><strong>Witness phrase</strong><br /><code>{pending.confirmationPhrase}</code></p>
  </section>;
}
