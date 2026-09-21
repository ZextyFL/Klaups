-- Preferred TTS language (BCP-47, e.g. 'en-US', 'es-ES'). Used to filter the
-- voice picker in the dashboard and as a fallback when the stored voice name
-- isn't available in whatever browser is actually running the overlay.
alter table creator_settings
  add column if not exists tts_language text;
