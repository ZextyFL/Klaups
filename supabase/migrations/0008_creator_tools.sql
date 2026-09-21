-- Creator tools: alert presets and soundboard
-- Adds lightweight styling metadata to alerts plus a creator-owned soundboard.

alter table alert_settings
  add column if not exists preset text not null default 'clean';

create table if not exists soundboard_sounds (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  sound_url text not null,
  keybind text,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, keybind)
);

create index if not exists soundboard_sounds_profile_idx
  on soundboard_sounds(profile_id, sort_order, created_at);

alter table soundboard_sounds enable row level security;

create policy "owner can manage own soundboard" on soundboard_sounds for all
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

insert into storage.buckets (id, name, public)
values ('soundboard', 'soundboard', true)
on conflict (id) do nothing;

create policy "public read soundboard" on storage.objects for select
  using (bucket_id = 'soundboard');

create policy "owner can write own soundboard media" on storage.objects for insert
  with check (
    bucket_id = 'soundboard'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owner can update own soundboard media" on storage.objects for update
  using (
    bucket_id = 'soundboard'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'soundboard'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owner can delete own soundboard media" on storage.objects for delete
  using (
    bucket_id = 'soundboard'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
