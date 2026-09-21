-- Atomic helper for the always-on TikTok worker.
-- Records a completed gift without making multiple read/write round trips.

create or replace function public.record_tiktok_gift(
  p_profile_id uuid,
  p_gift_id text,
  p_gift_name text,
  p_image_url text default null,
  p_diamond_count integer default null,
  p_sender_name text default null,
  p_sender_unique_id text default null,
  p_repeat_count integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tiktok_seen_gifts (
    profile_id,
    gift_id,
    gift_name,
    image_url,
    diamond_count,
    times_received,
    first_seen_at,
    last_seen_at
  )
  values (
    p_profile_id,
    p_gift_id,
    p_gift_name,
    p_image_url,
    p_diamond_count,
    1,
    now(),
    now()
  )
  on conflict (profile_id, gift_id)
  do update set
    gift_name = excluded.gift_name,
    image_url = coalesce(excluded.image_url, public.tiktok_seen_gifts.image_url),
    diamond_count = coalesce(excluded.diamond_count, public.tiktok_seen_gifts.diamond_count),
    times_received = public.tiktok_seen_gifts.times_received + 1,
    last_seen_at = now();

  insert into public.tiktok_gift_events (
    profile_id,
    gift_id,
    gift_name,
    sender_name,
    sender_unique_id,
    repeat_count,
    diamond_count,
    gift_image_url
  )
  values (
    p_profile_id,
    p_gift_id,
    p_gift_name,
    p_sender_name,
    p_sender_unique_id,
    greatest(coalesce(p_repeat_count, 1), 1),
    p_diamond_count,
    p_image_url
  );
end;
$$;

revoke all on function public.record_tiktok_gift(uuid, text, text, text, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.record_tiktok_gift(uuid, text, text, text, integer, text, text, integer) to service_role;
