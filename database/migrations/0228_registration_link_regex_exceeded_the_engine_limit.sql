-- The registration QR link could never be created, and never could have been
-- since 0203 shipped the reveal envelope.
--
-- issue_registration_link_v3 and rotate_registration_link_v3 both validate the
-- sealed ciphertext with:
--
--   p_reveal_ciphertext !~ '^[A-Za-z0-9_-]{24,1024}$'
--
-- PostgreSQL's regular expression engine caps a bound repetition count at 255.
-- 1024 is over that cap, so the pattern is not merely wrong, it is an invalid
-- regular expression, and evaluating it raises:
--
--   ERROR: 2201B: invalid regular expression: invalid repetition count(s)
--
-- The raise happens on the guard itself, before any work, so EVERY call throws
-- regardless of input. The app surfaced that as a bare 503 operation_unavailable
-- and the director saw only "The registration link could not be created. No QR
-- code was shown."
--
-- Measured on production 2026-09-19 by calling the function with a valid
-- service_role payload inside a transaction that was rolled back. The error
-- above came back from line 4, the IF, and app.registration_link_reveal_envelopes
-- holds zero rows, which is consistent with the feature never once having run.
--
-- This also explains why a code-reading audit concluded the path worked: the
-- logic around it IS correct. Only executing it shows the guard cannot run.
--
-- The intent of the check is preserved exactly. The length bound moves out of
-- the regex, where the engine limit does not apply, and the character class is
-- checked separately.
do $do$
declare
  v_name text;
  v_src text;
  v_new text;
  v_patched integer := 0;
begin
  foreach v_name in array array['issue_registration_link_v3', 'rotate_registration_link_v3'] loop
    select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_name;
    if v_src is null then raise exception '% is not present', v_name; end if;

    v_new := replace(
      v_src,
      'p_reveal_ciphertext !~ ''^[A-Za-z0-9_-]{24,1024}$''',
      '(length(p_reveal_ciphertext) not between 24 and 1024 or p_reveal_ciphertext !~ ''^[A-Za-z0-9_-]+$'')');
    if v_new = v_src then
      raise exception '%: the ciphertext guard was not found, refusing to apply', v_name;
    end if;
    execute v_new;
    v_patched := v_patched + 1;
  end loop;
  if v_patched <> 2 then raise exception 'expected to patch 2 functions, patched %', v_patched; end if;
end
$do$;

-- The same over-limit pattern is also a CHECK constraint on the table the
-- function writes to, so fixing the two functions alone only moved the identical
-- error from the guard to the INSERT. Confirmed by re-running the probe after
-- the functions were patched: the link was issued and then the insert into
-- app.registration_link_reveal_envelopes raised
-- "invalid regular expression: invalid repetition count(s)".
--
-- Same intent, expressed so the engine can evaluate it: the length bound leaves
-- the regex and becomes an ordinary comparison.
alter table app.registration_link_reveal_envelopes
  drop constraint registration_link_reveal_envelopes_ciphertext_check;
alter table app.registration_link_reveal_envelopes
  add constraint registration_link_reveal_envelopes_ciphertext_check
  check (length(ciphertext) between 24 and 1024 and ciphertext ~ '^[A-Za-z0-9_-]+$');
