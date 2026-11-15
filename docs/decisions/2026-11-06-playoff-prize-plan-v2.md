# Playoff prize layout V2

## Observable acceptance and scope

Implement the latest reviewed controls as a distinct local draft: all qualifiers/Top 2,4,8,16,32,64,128; Graduated adjustable factor, Equal, Equal with adjustable winner multiplier starting2, Winner Takes All; independent $1/$5/$10 rounding regular/Q/Side. No Stairstep. Preserve old drafts and dormant new values. Show first-round entry-fee comparison only for included first-round losers under Graduated or Winner Multiplier, not plain Equal. Unknown field never becomes zero or a certified paid count. Detect equality incompatible with the selected increment. Do not calculate operational awards or invent a rounding solver.

The new component and inspector have no route/transport/storage link. New version rejects a V1 object rather than coercing it; V1 remains untouched and recoverable. Full setup integration requires a separately reviewed versioned transaction and actual database/provider tests. Q/Side rounding selections here are intent only; existing pool settings and formulas are unchanged.

## Reuse and provenance

Reuse existing factor syntax/domain and owner-approved whole-finishing-group cutoff. Preserve equality within elimination groups as the owner's current design, not an ACC mandate. Field status and loser places are self-asserted local example inputs, not authenticated bracket evidence. Before enabling, bind event, bracket/generation, results revision and source digest and reject stale/unsupported results. Do not infer the first round from semifinal placement or qualifier count alone (byes matter).

Parent research (not independently re-fetched in this phase) cites ACC Policy Manual Chapter6.VI.C.1(b), PDF p39: backward playoffs may break trophy/prize ties; no further MRP after a loss. Source https://www.cribbage.org/NewSite/about/Policy%20Manual.pdf#page=39 . Daron has not requested placement-match implementation. Do not add a third-place match or silently change the current equal-group design.

## Exact remaining mathematical choices

1. Rounding residue/shortfall: selected increments, full fund conservation, equal per-person amounts and exact multipliers can conflict. Three equal recipients sharing $100 cannot all receive equal multiples of $5 while distributing exactly $100; nearest independent rounding gives $35 each ($105), while $30 each leaves $10. Even $1 increments cannot split $100 exactly among3 equal recipients. Winner Takes All with a $103 fund and $5 increments also cannot meet both requirements. No extra income, refund, automatic remainder recipient or unequal split is fabricated.
2. Entry-fee comparison: is Less/Equal/More a strict after-rounding target the calculation must satisfy, or an observed comparison with a warning? If a target conflicts with selected factor, available fund or increment, which may the director adjust? $53 exactly equal with $5 increments is impossible; the UI reports it and changes nothing. A zero/unknown fee requires review. Which entry fee applies when entry types, discounts or waivers differ also needs a source definition.
3. Top above actual field: current local candidate rejects Top16 when only8 qualify, rather than silently changing to8. Confirm if a future explicit 'up to TopN' behavior is wanted. Until then use All Qualifiers or a smaller selection.

Graduated group weighting, simple equal sharing, a winner multiple of each other equal recipient, and winner-only are the intended methods. No new denominator/recipient-ratio proposal is introduced. Manual override history must remain separate from calculated suggestion, balance and method validation. New rounding must be versioned; historical $5 snapshots must not be recalculated.

## Stop condition

This checkpoint is a reviewable local layout plus rejection/visibility/compatibility proof. It is not complete prize calculation, database save, provider acceptance, official bracket validation or release readiness. Keep the paused Finance readback outside this candidate.
