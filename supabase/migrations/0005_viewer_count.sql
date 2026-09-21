-- Live viewer count, updated by apps/worker from TikTok's roomUser event.
alter table creator_settings
  add column if not exists tiktok_viewer_count integer not null default 0;
