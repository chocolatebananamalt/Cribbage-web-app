# ChatGPT export audit — September 8, 2026

## Acceptance criteria

- Preserve both raw ChatGPT export ZIPs outside this repository.
- Add no credentials, private player data, personal correspondence, financial data, or raw general-account history.
- Determine whether the export contains the missing original development conversation.
- Record only recovery provenance; do not change product requirements based on absent evidence.

## Findings

Two renamed exports dated September 6 and September 7 were inspected read-only. Their outer ZIP hashes differ because of archive timestamps, but all 11 internal entries are byte-for-byte identical. Only one copy needs to be searched for recovery purposes.

The nested export contains 16 conversations. It does not contain the original August conversation that developed the ACC Digital Tournament System. It contains `Cribbage App Recovery` (`6a9ca7c8-2358-83ea-8b94-4a092abb8323`), a later recovery conversation with nine messages. That conversation says the surviving specifications, prototypes, graphics, correspondence, and recovery context were assembled into the maximal handoff already audited in this repository.

The export provides provenance and confirmation, but no newly recovered original requirements or production source code. It does not supersede specification v1.1, the existing recovery inventory, or the launch-blocking findings in `REVIEW.md`.

## Privacy disposition

The raw exports include unrelated authentication, payment, personal, email, financial, and conversation data. They must not be copied into this repository or pushed to GitHub. A sanitized audit note is sufficient; the existing private handoff remains excluded by `.gitignore`.

## Conclusion

No product or prototype change is warranted from this export. Continue from the established baseline: validate authoritative ACC rules and build a tested, authenticated two-player submission and dual-confirmation flow separately from the preserved prototype.

