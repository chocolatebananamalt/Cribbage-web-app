-- Paper scoring required two different signed-in officials, so one person could
-- not record a single score. Three separate gates enforced it:
--
--   1. only a cross_checker could record the two cards
--      (complete_paper_vs_paper_game_v1, 'cross checker role required')
--   2. an official's identity had to be confirmed by a DIFFERENT official
--      (bind_paper_official_identity_v1, 'self_confirmation_denied'), and the
--      workspace never listed you among the officials you could bind
--   3. the reviewer had to differ from the recorder
--      (review_paper_vs_paper_game_v1, 'reviewer not independent'), and the
--      workspace excluded your own completions from reviewCases
--
-- Luke's instruction on 2026-09-18 was to remove the blocker: the two players
-- verify the result at the table regardless, and a small club event does not
-- staff a second official.
--
-- This removes the SEPARATION of duties and nothing else. Specifically it KEEPS:
--
--   * both paper cards, which must still agree with each other
--     ('nonreciprocal card claims' is untouched)
--   * the review step, which still compares the reviewer's re-entered claims
--     against what was recorded ('review claims mismatch' is untouched). The
--     result is still entered twice, even when the same person enters it twice.
--   * the rule that an official may not score a game they are playing in.
--     app.paper_official_is_independent is deliberately untouched, so a binding
--     to a roster entry sitting at that game still fails.
--   * the whole audit trail. paper_game_completions.cross_checker_profile_id,
--     paper_game_completion_reviews.reviewer_profile_id and the state events
--     still record who did what. When one person does both, both carry their
--     id, which is the honest record of what happened.
--
-- Every replacement asserts its target text verbatim and asserts the exact
-- number of occurrences, because each of these bodies repeats its logic inside
-- its exception handler and a blind replace would silently edit only half.

create or replace function app.assert_replace_once(p_body text, p_old text, p_new text, p_expected integer, p_label text)
returns text language plpgsql as $$
declare v_found integer;
begin
  if position(p_old in p_body) = 0 then
    raise exception '% : target text not found verbatim', p_label;
  end if;
  v_found := (length(p_body) - length(replace(p_body, p_old, ''))) / length(p_old);
  if v_found <> p_expected then
    raise exception '% : expected % occurrences, found %', p_label, p_expected, v_found;
  end if;
  return replace(p_body, p_old, p_new);
end;
$$;

do $do$
declare v_def text; v_new text;
begin
  -- 1. The workspace decides what the screen offers. Without these three the
  --    database would allow a lone official through but the page would never
  --    render the forms.
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_paper_game_completion_workspace_v1' and p.prokind = 'f';
  if v_def is null then raise exception 'get_paper_game_completion_workspace_v1 is missing'; end if;

  v_new := app.assert_replace_once(v_def,
    'if v_role=''cross_checker'' then',
    'if v_role in (''director'',''co_director'',''cross_checker'') then',
    1, 'workspace: who may record cards');
  v_new := app.assert_replace_once(v_new,
    ' and completion.cross_checker_profile_id<>p_actor_id', '',
    1, 'workspace: own completions hidden from own review queue');
  v_new := app.assert_replace_once(v_new,
    ' and role_row.profile_id<>p_actor_id', '',
    1, 'workspace: self absent from bindable officials');
  execute v_new;

  -- 2. An official may confirm their own identity. The target must still hold
  --    an official role, and binding to a roster entry is still validated.
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bind_paper_official_identity_v1' and p.prokind = 'f';
  if v_def is null then raise exception 'bind_paper_official_identity_v1 is missing'; end if;

  v_new := app.assert_replace_once(v_def,
'  if p_actor_id=p_official_profile_id then
    v_rejection_code:=''self_confirmation_denied'';
  else
    select role into v_target_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_official_profile_id and role in (''director'',''co_director'',''cross_checker'') order by case role when ''director'' then 1 when ''co_director'' then 2 else 3 end limit 1 for update;
    if v_target_role is null then v_rejection_code:=''official_unavailable''; end if;
  end if;',
'  select role into v_target_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_official_profile_id and role in (''director'',''co_director'',''cross_checker'') order by case role when ''director'' then 1 when ''co_director'' then 2 else 3 end limit 1 for update;
  if v_target_role is null then v_rejection_code:=''official_unavailable''; end if;',
    1, 'bind: self confirmation denied');
  if position('self_confirmation_denied' in v_new) > 0 then
    raise exception 'bind: the self confirmation code survived the replacement';
  end if;
  execute v_new;

  -- 3. A director or co-director may record the two cards, not only a
  --    cross_checker. The role select appears twice: once in the main path and
  --    once in the exception handler that files the rejection receipt.
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'complete_paper_vs_paper_game_v1' and p.prokind = 'f';
  if v_def is null then raise exception 'complete_paper_vs_paper_game_v1 is missing'; end if;

  v_new := app.assert_replace_once(v_def,
    'and profile_id=p_actor_id and role=''cross_checker'' limit 1 for update;',
    'and profile_id=p_actor_id and role in (''director'',''co_director'',''cross_checker'') order by case role when ''director'' then 1 when ''co_director'' then 2 else 3 end limit 1 for update;',
    2, 'complete: recorder role');
  v_new := app.assert_replace_once(v_new,
    'if v_role=''cross_checker'' and p_game_id is not null then',
    'if v_role is not null and p_game_id is not null then',
    1, 'complete: exception handler role guard');
  v_new := app.assert_replace_once(v_new,
    ',''pending_review'',1,p_actor_id,''cross_checker'',v_receipt_id)',
    ',''pending_review'',1,p_actor_id,v_role,v_receipt_id)',
    1, 'complete: recorded actor_role must be the real role');
  execute v_new;

  -- 4. The reviewer may be the same official who recorded the cards. Their
  --    re-entered claims are still compared against the recorded ones.
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'review_paper_vs_paper_game_v1' and p.prokind = 'f';
  if v_def is null then raise exception 'review_paper_vs_paper_game_v1 is missing'; end if;

  v_new := app.assert_replace_once(v_def,
    '    if p_actor_id=v_completion.cross_checker_profile_id then raise exception using errcode=''P0001'',message=''reviewer not independent''; end if;
', '',
    1, 'review: reviewer independence');
  v_new := app.assert_replace_once(v_new,
    'and profile_id=v_completion.cross_checker_profile_id and role=''cross_checker'' limit 1 for update;',
    'and profile_id=v_completion.cross_checker_profile_id and role in (''director'',''co_director'',''cross_checker'') order by case role when ''director'' then 1 when ''co_director'' then 2 else 3 end limit 1 for update;',
    2, 'review: first official role lookup');
  v_new := app.assert_replace_once(v_new,
    'v_first_role is distinct from ''cross_checker''', 'v_first_role is null',
    2, 'review: first official must still hold a role');
  v_new := app.assert_replace_once(v_new,
    'if v_role is not null and p_actor_id<>v_completion.cross_checker_profile_id then',
    'if v_role is not null then',
    1, 'review: exception handler independence');
  -- The phrase also appears in the error-code mapping further down, which is
  -- harmless and stays: it maps an error that can no longer be raised. Assert
  -- only that the raise itself is gone.
  if position('message=''reviewer not independent''' in v_new) > 0 then
    raise exception 'review: the independence guard survived the replacement';
  end if;
  execute v_new;
end
$do$;

drop function app.assert_replace_once(text, text, text, integer, text);

-- Separation of duties was enforced in a fourth place as well, as a table
-- constraint, so relaxing the four functions above was not enough on its own:
--
--   paper_official_identity_bindings_check CHECK (official_profile_id <> confirming_profile_id)
--
-- An official confirming their own identity produced
-- "new row for relation paper_official_identity_bindings violates check
-- constraint", which is a raw database error rather than a handled rejection,
-- so the screen would have shown an unexplained failure. Found by calling the
-- function rather than by reading it.
alter table app.paper_official_identity_bindings drop constraint if exists paper_official_identity_bindings_check;

notify pgrst,'reload schema';
