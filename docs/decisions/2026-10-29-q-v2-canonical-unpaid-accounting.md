# Versioned Q liabilities and canonical unpaid accounting

The owner authorized local implementation/testing of the complete Q v2 unpaid accounting bridge. No publication, hosted migration, new access grant, payment or refund execution is authorized.

## Contract

Q v2 review is separate from immutable legacy v1 review history. The database owns an exact, versioned copy of the 320 approved friend-chart cells and recomputes liabilities from frozen policies, current finalized qualification, acknowledged elections and fully funded current receipt allocations. Equal policies pay paid playoff qualifiers, assign residual cents by finalized qualifying order and create unpaid contributor refund liabilities when nobody qualifies. Graduated policies select paid card ranks, including nonqualifiers, using the exact disclosed chart. These are configured operating policies, not a universal ACC formula. Unresolved Q-only numerical cash ties block even if an older physical-cut attestation exists.

Review requests contain source/version/reason/acknowledgment only, never amounts, recipients or paid flags. Full retained requests are hashed and reconciled server-side. History is append-only; only the latest current review is an active liability. A different operation key cannot duplicate the same source. V1/v2 domains cannot mix or reinterpret prior records.

Canonical accounting v6 is an isolated append-only draft/final domain. It does not lift v5's no-Q finalization guards. It binds exact current Q review, canonical playoff/qualification source, saved regular-prize schedule, receipt partition and classified expense evidence. Every receipt is partitioned exactly once into base entry fees and named Q funds. Base income funds only regular prizes and approved costs; each Q fund independently equals its award/refund liabilities. The base-entry 85% calculation excludes Q receipts and Q awards/refunds. There are no client-entered dollar overrides.

Regular-prize schedules remain director-selected, versioned and disclosed. Supported Q setup may save the existing structured schedule before any payment/election; prior unstructured events block instead of inventing retrospective disclosure. Existing no-Q financial helper identity and original behavior are retained. V2-policy events reject new v5 drafts with a structured domain conflict, while exact historical replay remains available under current authority. This prevents old clients from creating an incompatible draft before v6.

Finalization requires current sources, complete cross-check closure and once-only immutable accounting. All liabilities remain **unpaid**; recording final accounting never executes a transfer or refund and never marks somebody paid. Later source correction can make the historical final stale. It cannot rewrite it, create a second final or automatically reopen it; a supported reopen/correction lifecycle would be separate work.

## Supported boundary

First complete slice: one Standard Main, 12 qualifying games, four qualifiers, complete canonical three-series playoff, positive full base entry receipts, zero Side Pools and up to two supported Q pools. Unsupported formats/byes, disputed qualification, partial/stale funding, unknown classifications, absent structured schedule, out-of-chart combinations and unresolved cash ties fail closed. The 16-player fixtures are software tests, not ACC sanction certification.

Private forced-RLS tables and service-only RPCs follow existing authenticated-server actor derivation. They add no human database grants or credentials. Both modern JSON JWT context and existing individual role context are recognized, with missing/human roles rejected. Source and finalization races serialize through existing event/tournament/accounting locks; private append-only domain triggers are a backstop, not a substitute for controlled API receipts.
