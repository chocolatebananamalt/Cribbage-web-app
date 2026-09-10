# Pilot migration packet amendment — 0090–0104

**Status:** Preparation only; not authority to change the shared pilot.

This amendment supersedes the endpoint of the prior
`PILOT_MIGRATION_PACKET_0090_0103.md` packet. A future approved maintenance
window must apply its reviewed migrations `0090` through `0103` in their exact
recorded order, followed immediately by the additional source-only safety
migration below. Do not apply this amendment by itself and do not treat either
document as permission to change the shared pilot.

| Order | File | SHA-256 | Purpose |
| --- | --- | --- | --- |
| 0104 | `0104_rule12_disposition_and_qualification_notice_contract.sql` | `fd228da33c101f9669514df00f0833d4e105c2e8cb564e88260fa51bf2a408d6` | Keeps Rule 12.2(g)/(i) as effects of a correction rather than standalone dispositions; keeps the no-change (h) case from claiming a qualification change. It creates no writer, reader, or browser grant. |

Before the maintenance window, recompute this checksum against the reviewed
file, attach this amendment to the explicit approval record, validate the
complete range in the isolated synthetic project, and repeat the packet's
post-apply grant checks. Any existing private row using the formerly allowed
`12.2g` or `12.2i` value must be investigated rather than silently rewritten.
