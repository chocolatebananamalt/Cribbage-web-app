# ACC public flyer-source review — 2026-09-10

## Authoritative public sources reviewed

- [ACC Tournament Director Resources](https://www.cribbage.org/NewSite/sched/tournament_dir.asp)
  states that the applicable regional Sanctioning Request must be completed
  and approved, and that a flyer may be sent to the regional commissioner for
  website posting.
- [ACC Policy Manual](https://www.cribbage.org/NewSite/about/Policy%20Manual%2008162017A.pdf),
  Tournament Flier section, lists the fields a flyer must include and fields it
  should include. The PDF is an older published edition, so its field list is
  a source-backed implementation inventory, not proof that no current regional
  form has changed it.

## Source-backed flyer inventory

The planned Events and Flyer workflow needs fields for:

1. Main and Consolation game counts and formats.
2. Qualifier percentage for each tournament and the playoff format.
3. Tournament, Q-pool/insurance-pool costs, Q-pool payback type and payout
   ratio, and any charity name/amount.
4. Entry deadline, walk-in policy, trophy count, Muggins policy, and what the
   entry fee includes (meals, coffee, snacks, and similar benefits).
5. Director/co-director name and phone number.
6. The required ACC-sanctioned wording and ACC logo on the flyer front.
7. Recommended satellite type/time, smoking policy, hotel information, and
   facility directions.

## What remains deliberately unconfirmed

- The current regional sanctioning form, current fee/payout tables, current
  Q-pool option vocabulary, and whether a supported ACC API/import exists.
- Any automatic claim that a generated flyer is ACC-approved. The product must
  continue to label it a draft until the director obtains regional approval.

No portal login, submission, or tournament data was accessed or changed in
this review.

## Verification record

On 2026-09-10, after this source inventory was added, the repository passed
the complete local `pnpm verify` suite (production dependency audit, lint,
155 application checks, optimized production build, and workspace integrity)
and the local private-handoff integrity check. The clean GitHub Actions
`Verify` run for commit `38beb5190b20209f9a82bbafae7953c1c37b83e1` also
completed successfully:

- https://github.com/chocolatebananamalt/Cribbage-web-app/actions/runs/34484328460

Those checks verify the documentation change and current source build; they
do not verify a regional ACC form or authorize flyer publication.
