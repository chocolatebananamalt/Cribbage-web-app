# Private Running Pool Totals Page

Built the previously missing app page around the existing aggregate reader and
display. No database change, migration, new API, grants or financial writer.

The default-off route `/tournament/[tournamentId]/pool-totals` is linked from the
existing Director desk only when enabled. It supports event selection and a
native GET refresh action. The existing official-only access boundary is kept:
Director/Co-director may read; players/public are not granted access.

The page validates tournament/event and actual signed-in identity, limits event
selection to the authorized event summary, binds the aggregate reader to that
initial official, and rechecks identity/role after reading. Closed gate means no
session/source IO. Late identity changes or wrong-event/malformed data yield no
summary. No raw participant, receipt, consent or membership rows are exposed.

The reused display distinguishes recorded entries, fully paid entries, paid-entry
eligibility, partial/held amounts, recorded and eligible totals, and projected
if-everyone-pays estimates. Unknown/stale values are not zero. Two matching reads
remain explicitly non-atomic observations. No automatic polling, bank balance,
award schedule, payment confirmation or payout authority is claimed.

Five focused page-boundary tests, TypeScript `--noEmit` and changed-file ESLint
passed. Existing calculation/source and display code were reused without a broad
test rerun. The new server route itself has not had actual signed-in provider or
browser acceptance; it remains off. No full build, database fixture, hosted read/
write, publication, access change or denied-operation retry occurred.

Player-wide running totals remain unfinished: they need the separately designed
aggregate-only publication/access path. This private operational page does not
substitute for that requirement or silently expand audience permissions.

Independent review caught a missing event-summary tournament binding. The page now rejects foreign tournament summaries and duplicate event IDs before showing names/options; a focused source regression covers this guard.

## Player View Follow-up

The missing player-view implementation is superseded by
`2026-11-10-player-pool-totals-v1.md`: minimal aggregate player page and revocable
Director event visibility are now built locally behind closed gates. No actual
player access has been enabled; runtime/privacy/provider/release acceptance is
still required.
