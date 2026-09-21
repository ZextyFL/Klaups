-- Cached public profile info (avatar/display name) shown on the "is this
-- you?" confirmation card when connecting a TikTok username, and afterwards
-- on the dashboard.
alter table creator_settings
  add column if not exists tiktok_display_name text,
  add column if not exists tiktok_avatar_url text;
