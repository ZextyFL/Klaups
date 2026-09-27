-- LIVE worker heartbeat. The worker upserts its row every 30s; the web app
-- treats "no beat in 90s" as "connector offline" and says so, instead of
-- leaving creators on "Connecting…" forever when no worker is running.
create table if not exists public.worker_heartbeats (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  rooms integer not null default 0,
  live_rooms integer not null default 0,
  version text
);

alter table public.worker_heartbeats enable row level security;
-- Server-only (service role). No client role can read or write it.
revoke all on public.worker_heartbeats from anon, authenticated;
