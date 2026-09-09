-- Preserve the original public registration claim. Future director resolution
-- must use a separate auditable decision/event rather than rewriting the claim.
drop trigger if exists registration_claims_immutable on app.registration_claims;
create trigger registration_claims_immutable before update or delete on app.registration_claims
for each row execute function app.reject_immutable_history();
