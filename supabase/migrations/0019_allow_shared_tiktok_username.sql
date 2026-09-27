-- A TikTok username may be linked by more than one Klaups account (e.g. the
-- same creator signing in with a second Google account). Keep a plain index
-- for lookups instead of the unique one from 0015.
drop index if exists public.tiktok_connections_username_idx;
create index if not exists tiktok_connections_username_lookup_idx
  on public.tiktok_connections(lower(username))
  where username is not null;
