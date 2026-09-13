-- Rule 12.2(a), (b), and (h) depend on which card(s) were apparent
-- qualifiers. Preserve that reviewed operational fact with the independent
-- correction case rather than leaving a future writer to infer it from names,
-- ranks, or the correction outcome. This remains private and ungranted.

alter table app.independent_card_corrections
  add column apparent_qualifier_sides text[] not null default array[]::text[];

alter table app.independent_card_corrections
  add constraint independent_card_corrections_apparent_qualifier_sides_check
    check (apparent_qualifier_sides in (array[]::text[], array['a']::text[], array['b']::text[], array['a', 'b']::text[], array['b', 'a']::text[])),
  add constraint independent_card_corrections_rule_case_qualifier_shape_check
    check (
      (rule_case in ('12.2a', '12.2h') and cardinality(apparent_qualifier_sides) = 1)
      or (rule_case = '12.2b' and cardinality(apparent_qualifier_sides) = 2)
      or (rule_case in ('12.2c', '12.2d', '12.2e', '12.2f') and cardinality(apparent_qualifier_sides) = 0)
    );

revoke all on table app.independent_card_corrections from public, anon, authenticated;
