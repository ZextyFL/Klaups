-- Username-first TikTok linking.
--
-- Login Kit stays supported, but it is no longer required to use Klaups:
-- a creator can sign in with Google, type their @username, confirm the public
-- profile we show them, and go. That means a connection row can exist without
-- an OAuth open_id, so the column has to be nullable and its uniqueness has to
-- become partial (many username-only rows would otherwise collide on NULL in
-- some Postgres configurations, and a plain unique index cannot express intent
-- here as clearly as a partial one).

alter table public.tiktok_connections
  alter column open_id drop not null;

alter table public.tiktok_connections
  add column if not exists link_method text not null default 'username';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tiktok_connections_link_method_check'
  ) then
    alter table public.tiktok_connections
      add constraint tiktok_connections_link_method_check
      check (link_method in ('username', 'login_kit'));
  end if;
end $$;

-- Rows that already carry an open_id came from Login Kit.
update public.tiktok_connections
set link_method = 'login_kit'
where open_id is not null and link_method <> 'login_kit';

-- Replace the total unique index/constraint with a partial one so NULL open_ids
-- (username-only links) never contend for uniqueness.
alter table public.tiktok_connections
  drop constraint if exists tiktok_connections_open_id_key;
drop index if exists public.tiktok_connections_open_id_idx;
create unique index if not exists tiktok_connections_open_id_idx
  on public.tiktok_connections(open_id)
  where open_id is not null;

-- One TikTok username may only be claimed by one Klaups creator at a time.
create unique index if not exists tiktok_connections_username_idx
  on public.tiktok_connections(lower(username))
  where username is not null;

-- Live-status bookkeeping for the "Connect TikTok LIVE" button. The button
-- checks TikTok's public LIVE page before enabling the worker, so the dashboard
-- can tell the creator they are offline instead of spinning on "Connecting…".
alter table public.creator_settings
  add column if not exists tiktok_live_checked_at timestamptz,
  add column if not exists tiktok_live_title text;
