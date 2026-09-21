-- Reconciliation after two sessions built the TikTok gift schema in
-- parallel. The tables were created from the other branch's copy of this
-- schema, so 0010's "create table if not exists" skipped them and the
-- differences below never landed. Everything here is idempotent.

-- 1. tiktok_connections.profile_deep_link is written by the TikTok OAuth
--    callback but was missing, because the table already existed when 0010 ran.
alter table public.tiktok_connections
  add column if not exists profile_deep_link text;

-- 2. Converge on the single FOR ALL gift-settings policy that 0010 defines
--    (the superseded branch had split read/insert/update policies).
drop policy if exists "creator can read own gift settings" on public.tiktok_gift_settings;
drop policy if exists "creator can insert own gift settings" on public.tiktok_gift_settings;
drop policy if exists "creator can update own gift settings" on public.tiktok_gift_settings;
drop policy if exists "creator can manage own gift settings" on public.tiktok_gift_settings;
create policy "creator can manage own gift settings"
on public.tiktok_gift_settings for all to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);
grant select, insert, update on public.tiktok_gift_settings to authenticated;

-- 3. Only the 8-arg record_tiktok_gift (0011) should exist. A 5-arg overload
--    from the superseded branch made PostgREST RPC calls ambiguous.
drop function if exists public.record_tiktok_gift(uuid, text, text, text, integer);

-- 4. Keep provisioning gift settings for new creators. 0009 replaced
--    handle_new_user for OAuth display-name defaults and dropped this insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_username text;
  v_display_name text;
begin
  v_base := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'creator-' || substr(new.id::text, 1, 8)
  );

  v_base := lower(regexp_replace(v_base, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  v_base := substr(v_base, 1, 32);

  if v_base = '' then
    v_base := 'creator-' || substr(new.id::text, 1, 8);
  end if;

  v_username := v_base;
  if exists (select 1 from profiles where username = v_username) then
    v_username := substr(v_base, 1, 27) || '-' || substr(new.id::text, 1, 4);
  end if;

  v_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    v_username
  );

  insert into profiles (id, username, display_name)
  values (new.id, v_username, v_display_name)
  on conflict (id) do nothing;

  insert into creator_settings (profile_id, donation_slug)
  values (new.id, v_username)
  on conflict (profile_id) do nothing;

  insert into balances (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  insert into tiktok_gift_settings (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- 5. Postgres grants EXECUTE on functions to PUBLIC by default, so these
--    SECURITY DEFINER functions were reachable over the public REST API.
--    get_or_create_today_goal additionally accepted any profile_id, letting
--    anyone read/create another creator's daily goal row.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.get_or_create_today_goal(p_profile_id uuid)
returns daily_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  g daily_goals;
  s creator_settings;
begin
  if auth.uid() is not null and auth.uid() <> p_profile_id then
    raise exception 'forbidden';
  end if;

  select * into s from creator_settings where profile_id = p_profile_id;

  select * into g from daily_goals
    where profile_id = p_profile_id and goal_date = current_date;

  if not found then
    insert into daily_goals (profile_id, goal_date, target_amount_cents, currency)
    values (p_profile_id, current_date, coalesce(s.default_daily_goal_cents, 0), coalesce(s.currency, 'eur'))
    returning * into g;
  end if;

  return g;
end;
$$;

revoke all on function public.get_or_create_today_goal(uuid) from public, anon;
grant execute on function public.get_or_create_today_goal(uuid) to authenticated, service_role;
