-- Klaups TikTok identity + gift alerts + creator onboarding.
-- Safe to run after 0008_creator_tools.sql and 0009_oauth_profile_defaults.sql.

create extension if not exists "pgcrypto";

create table if not exists public.tiktok_connections (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  open_id text not null unique,
  union_id text,
  username text,
  display_name text,
  avatar_url text,
  profile_deep_link text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tiktok_connections_open_id_idx
  on public.tiktok_connections(open_id);

alter table public.tiktok_connections enable row level security;

drop policy if exists "creator can read own tiktok connection" on public.tiktok_connections;
create policy "creator can read own tiktok connection"
on public.tiktok_connections for select to authenticated
using ((select auth.uid()) = profile_id);

revoke insert, update, delete on public.tiktok_connections from anon, authenticated;
grant select on public.tiktok_connections to authenticated;

create table if not exists public.tiktok_oauth_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tiktok_oauth_tokens enable row level security;
revoke all on public.tiktok_oauth_tokens from anon, authenticated;

create table if not exists public.tiktok_seen_gifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null,
  gift_name text not null,
  image_url text,
  diamond_count integer check (diamond_count is null or diamond_count >= 0),
  times_received bigint not null default 0 check (times_received >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(profile_id, gift_id)
);

create index if not exists tiktok_seen_gifts_profile_idx
  on public.tiktok_seen_gifts(profile_id, last_seen_at desc);

alter table public.tiktok_seen_gifts enable row level security;

drop policy if exists "creator can read own seen gifts" on public.tiktok_seen_gifts;
create policy "creator can read own seen gifts"
on public.tiktok_seen_gifts for select to authenticated
using ((select auth.uid()) = profile_id);

revoke insert, update, delete on public.tiktok_seen_gifts from anon, authenticated;
grant select on public.tiktok_seen_gifts to authenticated;

create table if not exists public.tiktok_gift_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null,
  gift_name text not null,
  enabled boolean not null default true,
  sound_url text,
  volume integer not null default 100 check (volume between 0 and 100),
  display_seconds numeric(5,2) not null default 5 check (display_seconds between 1 and 60),
  show_visual boolean not null default true,
  show_sender boolean not null default true,
  show_gift_image boolean not null default true,
  message_template text not null default '{name} sent {gift} x{count}!',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, gift_id)
);

create index if not exists tiktok_gift_alerts_profile_idx
  on public.tiktok_gift_alerts(profile_id);

alter table public.tiktok_gift_alerts enable row level security;

drop policy if exists "creator can read own gift alerts" on public.tiktok_gift_alerts;
create policy "creator can read own gift alerts"
on public.tiktok_gift_alerts for select to authenticated
using ((select auth.uid()) = profile_id);

drop policy if exists "creator can insert own gift alerts" on public.tiktok_gift_alerts;
create policy "creator can insert own gift alerts"
on public.tiktok_gift_alerts for insert to authenticated
with check ((select auth.uid()) = profile_id);

drop policy if exists "creator can update own gift alerts" on public.tiktok_gift_alerts;
create policy "creator can update own gift alerts"
on public.tiktok_gift_alerts for update to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

drop policy if exists "creator can delete own gift alerts" on public.tiktok_gift_alerts;
create policy "creator can delete own gift alerts"
on public.tiktok_gift_alerts for delete to authenticated
using ((select auth.uid()) = profile_id);

grant select, insert, update, delete on public.tiktok_gift_alerts to authenticated;

create table if not exists public.tiktok_gift_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  alerts_enabled boolean not null default true,
  default_volume integer not null default 100 check (default_volume between 0 and 100),
  default_display_seconds numeric(5,2) not null default 5 check (default_display_seconds between 1 and 60),
  show_gift_visuals boolean not null default true,
  config_revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.tiktok_gift_settings enable row level security;

drop policy if exists "creator can manage own gift settings" on public.tiktok_gift_settings;
create policy "creator can manage own gift settings"
on public.tiktok_gift_settings for all to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

grant select, insert, update on public.tiktok_gift_settings to authenticated;

create or replace function public.bump_tiktok_gift_config_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile uuid;
begin
  target_profile := coalesce(new.profile_id, old.profile_id);

  insert into public.tiktok_gift_settings(profile_id, config_revision, updated_at)
  values (target_profile, 1, now())
  on conflict (profile_id)
  do update set
    config_revision = public.tiktok_gift_settings.config_revision + 1,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists tiktok_gift_alert_config_changed on public.tiktok_gift_alerts;
create trigger tiktok_gift_alert_config_changed
after insert or update or delete on public.tiktok_gift_alerts
for each row execute function public.bump_tiktok_gift_config_revision();

create table if not exists public.tiktok_gift_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null,
  gift_name text not null,
  sender_name text,
  sender_unique_id text,
  repeat_count integer not null default 1 check (repeat_count >= 1),
  diamond_count integer check (diamond_count is null or diamond_count >= 0),
  gift_image_url text,
  received_at timestamptz not null default now()
);

create index if not exists tiktok_gift_events_profile_idx
  on public.tiktok_gift_events(profile_id, received_at desc);

alter table public.tiktok_gift_events enable row level security;

drop policy if exists "creator can read own gift history" on public.tiktok_gift_events;
create policy "creator can read own gift history"
on public.tiktok_gift_events for select to authenticated
using ((select auth.uid()) = profile_id);

revoke insert, update, delete on public.tiktok_gift_events from anon, authenticated;
grant select on public.tiktok_gift_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-sounds',
  'gift-sounds',
  true,
  15728640,
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg']
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read gift sounds" on storage.objects;
create policy "public can read gift sounds"
on storage.objects for select to public
using (bucket_id = 'gift-sounds');

drop policy if exists "creator can upload own gift sounds" on storage.objects;
create policy "creator can upload own gift sounds"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gift-sounds'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "creator can update own gift sounds" on storage.objects;
create policy "creator can update own gift sounds"
on storage.objects for update to authenticated
using (
  bucket_id = 'gift-sounds'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'gift-sounds'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "creator can delete own gift sounds" on storage.objects;
create policy "creator can delete own gift sounds"
on storage.objects for delete to authenticated
using (
  bucket_id = 'gift-sounds'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.creator_settings
  add column if not exists tiktok_verified boolean not null default false;

alter table public.creator_settings
  add column if not exists tiktok_verified_at timestamptz;

insert into public.tiktok_gift_settings(profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;
