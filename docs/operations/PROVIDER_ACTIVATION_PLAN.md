# Optional provider activation plan

Date: 2026-09-12

This is the release boundary for payments, SMS, and paper-card OCR. It keeps
the September 18 / October 3 Standard Singles release usable without any of
these vendors and defines the work that must pass before an optional provider
can be switched on.

## October release: no provider is required

| Operational need | Required October path | External provider |
| --- | --- | --- |
| Record fees and payments | Director/co-director records audited cash, check, or other manual payment evidence; voids preserve history. | None |
| Tell paper users where to start | View/search/sort the initial assignment and print the two-column Seating Assignments list. | None |
| Cross-check paper cards | Two independent officials enter/review the original paper evidence through the paper-versus-paper or digital-versus-paper workflow. | None |
| Recover a failed phone | Reconstruct from surviving server, opponent-device, and/or paper evidence with independent non-self review. | None |

These paths are release-critical. Online checkout, text-message delivery, and
machine OCR are enhancements and cannot be reported as blockers for the first
tournament.

## Executable preflight

Run `pnpm providers:check` in every release environment. With the optional
providers disabled, the command must report each manual fallback as declared
and exit successfully. This is a configuration-contract check; the dated
workflow evidence in `docs/quality/` remains the proof that a fallback works.
The repository's standard `pnpm verify` command runs this preflight between
the application tests and production build, so the existing GitHub release
checks cannot omit it.

While preparing one enhancement, require its complete configuration explicitly:

```text
pnpm providers:check --require=online_payments
pnpm providers:check --require=sms_seating
pnpm providers:check --require=paper_card_ocr
```

The `--require=` check validates preparation while the feature remains
disabled. Missing values, invalid providers, browser-exposed secrets, and
missing prerequisites exit unsuccessfully and name the exact problem. A
successful required-provider check reports `CONFIGURED; FEATURE DISABLED`.
This release rejects any attempt to set one of these optional gates to
`enabled`, even if all configuration is present, because no released adapter
has completed its live activation proof. A future implementation must replace
that closed gate with a versioned, tested adapter release—not merely flip an
environment value. Activation still requires the failure-matrix, independent
Preview test, policy approval, Production deployment, and post-deployment
smoke test below.

The public/non-secret portion of the variable contract is in `.env.example`.
This repository deliberately excludes even blank server-credential names from
that public template. The server-only provider values are:

| Capability | Server-only values |
| --- | --- |
| Online payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| SMS | `SMS_PROVIDER_API_KEY` |
| Paper-card OCR | `OCR_PROVIDER_API_KEY` only when `ACC_OCR_EXECUTION_MODE=external`; none for a proven `on_device` model |

Store those only in the deployment platform's encrypted server environment.
Provider credentials, webhook secrets, and API keys must never use a
`NEXT_PUBLIC_` name, appear in a public template, or be committed.

## Activation gates

### Online payments — later, Stripe

Stripe is the selected future processor because it is Vercel's current native
payments integration. Do not write a parallel hand-rolled processor or let a
checkout response mark a player paid directly.

Before enablement:

1. Install a Stripe sandbox through the Vercel Marketplace and connect it only
   to Preview.
2. Record the director/ACC decision for accepted payment methods, fees,
   refunds, chargebacks, receipt wording, and who is the merchant of record.
3. Add server-created Checkout Sessions and a signed webhook route. A verified
   webhook creates a separate immutable provider receipt; it then reconciles
   into the existing payment ledger without granting registration, check-in,
   seating, or scoring authority.
4. Test success, cancel, duplicate webhook, out-of-order webhook, refund,
   chargeback, wrong tournament/event, wrong amount, and lost browser response
   in Stripe test mode.
5. Reconcile a full sandbox event to the cent, run `pnpm verify`, complete an
   independent Preview browser test, then deliberately connect the live Stripe
   account and redeploy. Production remains off until this evidence exists.

External need: a Stripe account and merchant/refund policy. Cost is transaction
pricing chosen by Stripe; it is not required for October.

### SMS seating notices — later

Vercel's current Messaging marketplace page does not provide a native SMS
transport. It lists messaging products centered on email/workflow messaging,
so no SMS vendor is silently assumed. Printed seating remains the launch path.

Before enablement:

1. Select and contract an SMS provider and sender identity/number.
2. Approve opt-in wording, STOP/help handling, permitted message types,
   retention, delivery-failure handling, and who pays per-message charges.
3. Send only a minimal initial assignment notice after registration is closed
   and seating is published. Never include financial, score, or private roster
   details.
4. Store an immutable notification attempt/delivery/failure record and retain
   the printable list as the authoritative fallback.
5. Test invalid/missing numbers, no consent, duplicate publish, provider
   timeout, partial batch failure, opt-out, retry, and wrong-tournament denial
   before the feature gate can open.

External need: an approved SMS provider account, sender registration, consent
policy, and funded message balance. None is required for October.

### Paper-card OCR — desired after the core release

The repository contains the released, role-restricted immutable capture and
private Storage path. It stores only bounded JPEG/PNG/WebP originals, verifies
their byte count and SHA-256 digest, and lets a distinct eligible official
reopen the verified bytes through an audited server stream. It creates no OCR
or scoring authority. The October path remains human entry.

Before enablement:

1. Card-image access/retention is approved for restricted hold with no
   automatic deletion. Approve an OCR processor (or an on-device
   implementation) before sending any real card image to a third party.
2. The private Supabase Storage bucket, exact JPEG/PNG/WebP limits,
   server-issued upload authorization, byte-size/type/digest verification,
   authorized no-store viewing, and immutable access events are released. No
   public URL is allowed.
3. Add OCR processing that creates a confidence-labelled draft containing
   only candidate card rows. The draft is versioned and cannot write scores.
4. Require an eligible non-self cross checker to compare the image and every
   extracted value, correcting or rejecting the draft before comparison.
5. Feed an accepted transcription into the existing paper/digital or
   paper/paper comparison workflow. It never substitutes for the required
   independent official review and never verifies a game by itself.
6. Test supported layouts with real anonymized cards, rotated/glare/blurred
   images, handwriting false reads, wrong IDs, duplicate uploads, self-card
   denial, unauthorized view/download, provider failure, and exact-match versus
   mismatch routing. Run the full repository and real-device gates before
   enabling the production flag.

External need: an approved OCR account or a proven on-device model plus live
false-read evidence. The hosted pilot already has the approved private Storage
bucket; OCR is not ready to switch on and remains default-off.

## Press-go rule

There is no single production switch for an incomplete provider. The safe
"press go" sequence for each enhancement is: provision in Preview, pull its
real environment values, implement against that resource, pass the provider's
failure matrix and the normal repository gate, obtain the listed policy
approval, then open one exact production feature flag and smoke-test it. Until
all gates are green, the optional feature stays absent while the October manual
path continues to work.

## Sources checked

- Vercel Marketplace payments inventory and Stripe integration, checked
  2026-09-12: <https://vercel.com/marketplace/category/payments> and
  <https://vercel.com/marketplace/stripe>
- Vercel Marketplace messaging inventory, checked 2026-09-12:
  <https://vercel.com/marketplace/category/messaging>
- Supabase signed upload documentation, checked 2026-09-12:
  <https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl>
- Existing paper-card capture authority:
  `docs/decisions/2026-09-10-paper-scorecard-capture-contract.md`
