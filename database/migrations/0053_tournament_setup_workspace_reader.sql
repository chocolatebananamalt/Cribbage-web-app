-- Private director/co-director read model for configuration drafts only. It is
-- deliberately separate from operational events, scoring, finance, results,
-- and any public flyer or ACC integration.

create or replace function public.get_tournament_setup_workspace(
  p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'current', (
      select jsonb_build_object(
        'revisionId', r.id, 'version', r.version, 'tournamentName', r.tournament_name,
        'city', r.city, 'venue', r.venue, 'startsAt', r.starts_at,
        'endsAt', r.ends_at, 'timezone', r.timezone_name,
        'contactDetails', r.contact_details, 'sanctioningFeeCents', r.sanctioning_fee_cents,
        'createdAt', r.created_at,
        'officials', coalesce((
          select jsonb_agg(jsonb_build_object('profileId', o.profile_id, 'role', o.role)
            order by case o.role when 'director' then 0 else 1 end, o.profile_id)
          from app.tournament_setup_official_versions o
          where o.setup_revision_id = r.id and o.tournament_id = r.tournament_id
        ), '[]'::jsonb),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'clientRowId', e.client_row_id, 'eventKind', e.event_kind,
            'displayName', e.display_name, 'startsAt', e.starts_at,
            'timezone', e.timezone_name, 'styleCode', e.style_code,
            'formatCode', e.format_code, 'gameCount', e.game_count,
            'entryFeeCents', e.entry_fee_cents, 'feeIncludesNote', e.fee_includes_note,
            'payoutNote', e.payout_note, 'qualificationNote', e.qualification_note,
            'eligibilityNote', e.eligibility_note, 'mugginsStatus', e.muggins_status,
            'sourceStatus', e.source_status,
            'qPools', coalesce((
              select jsonb_agg(jsonb_build_object('slot', q.slot, 'poolTypeCode', q.pool_type_code,
                'entryFeeCents', q.entry_fee_cents, 'note', q.note, 'sourceStatus', q.source_status)
                order by q.slot)
              from app.tournament_setup_q_pool_versions q
              where q.setup_event_version_id = e.id and q.tournament_id = e.tournament_id
                and q.setup_revision_id = e.setup_revision_id
            ), '[]'::jsonb)
          ) order by e.ordinal)
          from app.tournament_setup_event_versions e
          where e.setup_revision_id = r.id and e.tournament_id = r.tournament_id
        ), '[]'::jsonb)
      )
      from app.tournament_setup_revisions r
      where r.tournament_id = p_tournament_id
      order by r.version desc
      limit 1
    ),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'revisionId', r.id, 'version', r.version, 'createdAt', r.created_at,
        'eventCount', (select count(*) from app.tournament_setup_event_versions e
          where e.setup_revision_id = r.id and e.tournament_id = r.tournament_id)
      ) order by r.version desc)
      from app.tournament_setup_revisions r where r.tournament_id = p_tournament_id
    ), '[]'::jsonb)
  ) else null end
$$;

revoke all on function public.get_tournament_setup_workspace(uuid) from public, anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;
