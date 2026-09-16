-- The guarded legacy-team upgrade appends a new ruleset version.  Keep its
-- Appendix-B source/approval normalization at the database boundary even when
-- a deployment has already applied migration 0200 before this trigger exists.

drop trigger if exists ruleset_enable_supported_doubles on app.ruleset_versions;
create trigger ruleset_enable_supported_doubles
before insert on app.ruleset_versions
for each row execute function app.enable_supported_doubles_ruleset_v1();

notify pgrst, 'reload schema';
