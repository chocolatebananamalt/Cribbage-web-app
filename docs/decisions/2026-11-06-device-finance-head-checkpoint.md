# Device Finance reviewed-head checkpoint

Status: disabled local candidate; no live storage, provider, schema or hosted change.

The existing device port can read a scope key and atomically transition it while copying an immutable archive. It cannot read the archive history. Clearing pending to null after archive therefore loses the local head guard when constructing a new operation instance.

For new-client archives, use the existing atomic transition to replace pending with an explicit finance-provider-reviewed-head-v1 checkpoint. It contains only scope, operation ID, exact reviewed head and deterministic archive ID. The immutable accepted archive keeps its existing bytes and ID. No new store, schema, port method, timestamp, authority or financial amount is added.

Initialization validates exact keys, matching account/tournament/event, UUIDs, digests, version and archive ID. It restores a stale-save barrier, not a receipt or pending operation. The raw read bytes become the next CAS expected value; no normalization/write occurs on read. Invalid or future formats block without clearing. An existing higher/same-version conflicting guard cannot be downgraded. The next deliberate save replaces checkpoint with pending; its later successful archive advances the checkpoint and preserves previous archives.

This is device recovery evidence, not authenticated server truth, award approval or money movement. The server must independently authenticate and check versions/sources. An explicit read-only retained-record action handles an uncertain archive acknowledgment without resending.

Compatibility: old exact-kind pending readers block the checkpoint. Their real binary/storage behavior still needs acceptance. Previously completed archives that left null have no checkpoint: null remains ambiguous and needs an authenticated current workspace plus legacy recovery before enablement. Do not infer zero history from null. The host must reuse an operation object while a save/archive/readback is in flight; tested new-instance reconstruction occurs after a settled checkpoint exists.

Rollback: no real device was written in this work. Before publication, plan old-client blocking/recovery; reverting website code would not transform existing checkpoints into old pending records. Never delete an unknown checkpoint to make an old reader proceed. Preserve archives and use an approved current client/recovery path. Actual IndexedDB transaction/persistence and full-page reload are separate, not established by Map tests.
