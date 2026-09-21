-- Lightweight creator donation analytics for faster dashboards.

create or replace function public.get_creator_donation_stats(p_profile_id uuid)
returns table (
  total_cents bigint,
  total_count bigint,
  month_cents bigint,
  month_count bigint,
  today_cents bigint,
  today_count bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::bigint as total_cents,
    count(*) filter (where status = 'paid')::bigint as total_count,
    coalesce(sum(amount_cents) filter (
      where status = 'paid'
        and created_at >= date_trunc('month', now())
    ), 0)::bigint as month_cents,
    count(*) filter (
      where status = 'paid'
        and created_at >= date_trunc('month', now())
    )::bigint as month_count,
    coalesce(sum(amount_cents) filter (
      where status = 'paid'
        and created_at >= date_trunc('day', now())
    ), 0)::bigint as today_cents,
    count(*) filter (
      where status = 'paid'
        and created_at >= date_trunc('day', now())
    )::bigint as today_count
  from public.donations
  where profile_id = p_profile_id
    and (select auth.uid()) = p_profile_id;
$$;

create or replace function public.get_creator_top_supporters(
  p_profile_id uuid,
  p_limit integer default 5
)
returns table (
  donor_name text,
  total_cents bigint,
  donation_count bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    d.donor_name,
    sum(d.amount_cents)::bigint as total_cents,
    count(*)::bigint as donation_count
  from public.donations d
  where d.profile_id = p_profile_id
    and d.status = 'paid'
    and (select auth.uid()) = p_profile_id
  group by d.donor_name
  order by total_cents desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

grant execute on function public.get_creator_donation_stats(uuid) to authenticated;
grant execute on function public.get_creator_top_supporters(uuid, integer) to authenticated;
