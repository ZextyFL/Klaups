-- Soundboard volume, gift "stay until the sound ends", and wider audio support.

alter table public.soundboard_sounds
  add column if not exists volume integer not null default 100;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'soundboard_sounds_volume_check') then
    alter table public.soundboard_sounds
      add constraint soundboard_sounds_volume_check check (volume between 0 and 100);
  end if;
end $$;

-- When true the alert stays on screen until its sound has finished playing
-- (display_seconds becomes the minimum, 60s the hard cap), so a long MP3 is
-- never cut off mid-way.
alter table public.tiktok_gift_alerts
  add column if not exists wait_for_sound boolean not null default false;

-- The gift-sounds bucket accepted only five exact MIME strings, so M4A/AAC
-- (the default on iPhone and many Windows recorders) and MP3s that some
-- browsers label audio/x-mpeg were rejected with an opaque storage error.
update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mpeg-3',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
  'audio/ogg', 'audio/webm', 'audio/aac', 'audio/x-aac',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/flac', 'audio/x-flac'
]
where id = 'gift-sounds';

-- Same 15 MB ceiling for soundboard uploads, which previously had none.
update storage.buckets
set file_size_limit = 15728640
where id = 'soundboard' and file_size_limit is null;
