-- Rule 12.2(g) adjusts totals and (i) requires notice after a qualifying
-- changing correction; neither is an independent scorecard disposition. Keep
-- this private foundation aligned with the dated source before a writer or
-- grant is ever considered. This migration deliberately creates no reader,
-- writer, policy change, or execute grant.

alter table app.independent_card_corrections
  add column qualification_changed boolean not null default false;

alter table app.independent_card_corrections
  drop constraint if exists independent_card_corrections_rule_case_check;

alter table app.independent_card_corrections
  add constraint independent_card_corrections_rule_case_check
    check (rule_case in ('12.2a', '12.2b', '12.2c', '12.2d', '12.2e', '12.2f', '12.2h')),
  add constraint independent_card_corrections_no_harm_no_qualifying_change_check
    check (not (rule_case = '12.2h' and qualification_changed));

revoke all on table app.independent_card_corrections from public, anon, authenticated;
