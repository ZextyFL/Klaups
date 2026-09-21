-- Connection status written by apps/worker so the dashboard can show a
-- TikFinity-style "Connected / Live / Offline" badge for the TikTok room.
alter table creator_settings
  add column if not exists tiktok_status text not null default 'disconnected', -- disconnected | connecting | live | offline | error
  add column if not exists tiktok_status_message text,
  add column if not exists tiktok_last_seen_at timestamptz;
