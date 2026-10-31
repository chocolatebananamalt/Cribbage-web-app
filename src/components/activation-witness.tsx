import type { ActivationRedemptionResult } from "../lib/api/roster-account-activation";
import { ActivationDeadline } from "./activation-deadline";

export function ActivationWitness({ pending }: { pending: ActivationRedemptionResult }) {
  return <section className="correction-item" aria-labelledby="witness-title">
    <h2 id="witness-title">Confirm with the tournament director</h2>
    <p>Show the director both values in person. The director must be signed in separately and cannot approve their own request.</p>
    <ActivationDeadline expiresAt={pending.expiresAt} />
    <p><strong>Request ID</strong><br /><code>{pending.requestId}</code></p>
    <p><strong>Witness phrase</strong><br /><code>{pending.confirmationPhrase}</code></p>
  </section>;
}
