# Expense-only authoring journal alongside funded optional pools

Date: 2026-11-12. Local/default off; no hosted installation approval implied.

The original native allocator holds optional funding. New expense shares therefore use a distinct, audited expense-only journal rather than manufactured native allocation rows or a relaxed native guard. A primary Director explicitly supplies Main/Consolation dollar amounts and cost categories for every current physical expense. Whole physical amounts must conserve exactly; receipt, Q and Side allocations are untouched.

The current expense-intent reader prefers the new journal once present, validates its operation/outcome and current physical rows, and never falls back to older intent after a stale latest review. Existing V3 ownership and fund reviews consume its distinct provenance. A fresh ownership review is required. New share authoring is held after any fund review or award; post-approval amendments remain outside this slice.

Uncertain requests remain retained. A serialized resolver recovers an accepted operation or records an immutable cancellation that blocks future execution before local archive-and-clear. This is not reversal of an accepted review.

Regular-only Consolation closure uses a separate snapshot foreign key and the existing Close Event lifecycle transaction, with explicit Director confirmation and current source replay. It neither pays awards nor submits ACC results.
