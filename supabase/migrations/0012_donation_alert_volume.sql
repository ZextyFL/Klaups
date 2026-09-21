-- Per-donation alert volume so creators can balance uploaded MP3s.
alter table public.alert_settings
  add column if not exists volume integer not null default 100;

alter table public.alert_settings
  drop constraint if exists alert_settings_volume_check;

alter table public.alert_settings
  add constraint alert_settings_volume_check check (volume between 0 and 100);
