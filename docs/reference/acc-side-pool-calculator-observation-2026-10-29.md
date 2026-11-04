# ACC side-pool calculator — observed alternative, not active policy

Parent research observed the public ACC `SidePoolCalculator.php` client on 2026-10-29. Its reusable observation file was supplied on this executor as `acc-side-pool-observations.json`; initial SHA256 `8A441AA21D118EAC31F35BFD49968F401B2BCCF3B2A9CB6C8E557A7BFC38F525` and updated SHA256 `6D329A64DFD64165A1A5B528F0A0FC31094BED80C0CB6FBBFD82C4C3D0FAE85D` were verified locally. This note retains only the reported public calculation, not account/session material. The source file is separate research evidence, not application configuration.

Reported inline `prizeWizard` algorithm: let `k` be server-provided `topay`, `F` server-provided fund, `E` entry fee, `D=k(k+1)/2`, and `R(x)=5*Math.round(x/5)`. For place `j=1..k`:

- If `F/D > E`, suggested amount is `R(F/D*(k-j+1))`.
- Otherwise it is `E + R((F-E*k)/(D-k)*(k-j))`.

The function rounds each place independently to the nearest $5 (positive halves up) and has no balancing step inside the observed function. Recipient count `ceil(N/r)` and fund `N*E` matched ten observed examples; server derivation of these inputs was not inspected.

This is **different from the friend-supplied lookup charts**: 12 paid at $10, one-in-six, suggests $80/$40 instead of $75/$45; 16 at $10 suggests $80/$55/$25 instead of $80/$50/$30; 16 at $50 suggests $400/$265/$135 instead of $390/$250/$160. All ten supplied chart comparisons differed.

Initially, for 59 paid at $10, one-in-four, generated suggested fields summed to $595 for a $590 pot and Update was untested. In the later explicitly authorized synthetic test, the researcher clicked **Update** on the same calculator page. It displayed Prize Fund $590 and Total Prizes $595, kept the amounts unchanged, showed no visible warning/rejection/adjustment, and enabled Print (not clicked). Names stayed blank and no other account pages were accessed. This demonstrates the observed calculator accepts those displayed fields through Update; it does not establish actual money movement, undisclosed downstream processing or a universally mandated ACC formula.

The owner subsequently selected the ACC calculator as the preferred authoritative source for future payout policy. No active stored policy changed. Existing versioned reviews continue to use their exact disclosed chart/equal policies; unsupported/ambiguous cases block. A new calculator policy requires its own disclosed source version, explicit rounding/conservation handling and tests. The proposed director-visible balancing mechanism has not yet been approved. Historical policies and unpaid reviews must never be recalculated silently.

## Complete chart comparison, separate research

The subsequent local comparison used all 320 retained chart rows (314 visually reviewed and six user-read clarifications). Every chart row balances. The observed ACC formula balances 255 rows, exceeds the pot in 38 and leaves money in 27; the proposed exact largest-remainder variant balances all 320. Only one complete payout schedule matches the supplied charts. In 308 rows, at least one chart award lies outside the raw ACC amount's adjacent $5 rounding choices: the chart differences therefore reflect a different allocation, rather than rounding alone.

For the 100 $10 chart cases, the ACC formula balances 75; the proposed method repairs the other 25 while preserving those 75 balanced schedules. It is not monotonic in every individual prize: with a fixed recipient count, rank 22 can decline from $15 to $10 between 89 and 90 paid entrants at one-in-four. That tradeoff is part of the pending policy decision, not a hidden implementation choice.

Retained research artifact: `acc-comparison/chart-comparison.json`, SHA256 `28A4D38DF3D57C3DFA6E1FE63401ED3A522A86BB1C688A98D91FF490F1E5E9DA`, independently verified on the executor. These 320 comparisons are local calculations against the observed formula, not 320 website submissions. Representative live tests and mathematical review were conducted separately. No new payout method, rounding policy, historical recalculation or active setting is authorized by this research note.

## Subsequent owner decision

On2026-10-30 the owner approved local adoption of exact largest-remainder $5 rounding, acknowledging the fixed-recipient prize tradeoff. The [versioned decision](../decisions/2026-10-30-acc-weighted-balanced-q-policy.md) supersedes earlier pending-approval statements as current direction. Existing recorded policies and awards remain unchanged; standalone calculation verification is distinct from policy/accounting integration and any later rollout approval.
