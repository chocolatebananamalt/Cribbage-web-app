# Active-game progression

Date: 2026-09-12

For each participant within each published event, the active game is the earliest unresolved scheduled assignment ordered by game number, match instance, import row, and immutable game ID. Later assignments are visible as Upcoming but locked.

A game resolves for progression only through authoritative verified/corrected canonical state, an approved failed-device recovery, or an approved paper-game completion. Submission, confirmation-pending, mismatch, queued offline data, and unapproved staff evidence never advance the player.

The database enforces this rule at direct submission, offline-capability issuance, and offline replay. A participant/event advisory lock serializes competing new submissions. Existing immutable operation and replay receipts are checked first so an exact retry remains replayable even after progression changes; changed reuse still follows the prior conflict boundary.

This is event-scoped so separately scheduled Main, Consolation, and Satellite events under one tournament do not block one another.
