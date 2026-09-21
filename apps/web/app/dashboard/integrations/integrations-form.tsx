'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CreatorSettings } from '@/lib/database.types';
import { Toggle } from '@/components/ui/Toggle';
import { languageLabel } from '@/lib/voice-language';
import { TikTokConnectCard } from './tiktok-connect-card';

export function IntegrationsForm({ settings }: { settings: CreatorSettings }) {
  const supabase = createClient();
  const router = useRouter();

  const [ttsEnabled, setTtsEnabled] = useState(settings.tts_enabled);
  const [minTts, setMinTts] = useState((settings.min_tts_amount_cents / 100).toString());
  const [songRequestEnabled, setSongRequestEnabled] = useState(settings.song_request_enabled);
  const [songCommand, setSongCommand] = useState(settings.song_request_command);
  const [ttsVoice, setTtsVoice] = useState(settings.tts_voice ?? 'default');
  const [ttsLanguage, setTtsLanguage] = useState(settings.tts_language ?? '');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every language the local speech engine actually has a voice for.
  const languages = Array.from(new Set(voices.map((v) => v.lang)))
    .map((code) => ({ code, label: languageLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const visibleVoices = (ttsLanguage ? voices.filter((v) => v.lang === ttsLanguage) : voices)
    .slice()
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));

  // Voice list is only available client-side and can arrive asynchronously.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('creator_settings')
      .update({
        tts_enabled: ttsEnabled,
        tts_voice: ttsVoice,
        tts_language: ttsLanguage || null,
        min_tts_amount_cents: Math.round(parseFloat(minTts || '0') * 100),
        song_request_enabled: songRequestEnabled,
        song_request_command: songCommand || '!sr',
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', settings.profile_id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  function previewVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance('This is how your TikTok chat will sound.');
    const voice =
      (ttsVoice !== 'default' ? voices.find((v) => v.name === ttsVoice) : undefined) ??
      (ttsLanguage ? voices.find((v) => v.lang === ttsLanguage) : undefined);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="space-y-6">
      <TikTokConnectCard settings={settings} />

      <div className="card space-y-4">
        <h2 className="font-semibold">Text-to-speech</h2>
        <Toggle
          checked={ttsEnabled}
          onChange={setTtsEnabled}
          label="Read chat aloud"
          description="Every chat message is spoken on the Chat + TTS widget."
        />
        <div>
          <label className="label">Minimum donation amount to trigger TTS on alerts</label>
          <input className="input" type="number" min={0} value={minTts} onChange={(e) => setMinTts(e.target.value)} />
        </div>
        <div>
          <label className="label">Language</label>
          <select
            className="input"
            value={ttsLanguage}
            onChange={(e) => {
              const next = e.target.value;
              setTtsLanguage(next);
              // Drop the selected voice if it isn't in the new language.
              if (next && !voices.some((v) => v.name === ttsVoice && v.lang === next)) {
                setTtsVoice('default');
              }
            }}
          >
            <option value="">All languages ({voices.length} voices)</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} — {l.code} ({voices.filter((v) => v.lang === l.code).length})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-white/40">
            Picking a language filters the voice list below, and is used as a fallback if the exact
            voice you chose isn&apos;t installed on the machine running your overlay.
          </p>
        </div>

        <div>
          <label className="label">
            Voice{ttsLanguage ? ` — ${visibleVoices.length} in ${languageLabel(ttsLanguage)}` : ''}
          </label>
          <div className="flex gap-2">
            <select className="input" value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}>
              <option value="default">
                {ttsLanguage ? `Any ${languageLabel(ttsLanguage)} voice` : 'Browser default'}
              </option>
              {visibleVoices.map((v) => (
                <option key={`${v.name}-${v.lang}`} value={v.name}>
                  {v.name} — {languageLabel(v.lang)} ({v.lang}){v.localService ? '' : ' · online'}
                </option>
              ))}
            </select>
            <button className="btn-secondary shrink-0 text-sm" onClick={previewVoice} type="button">
              Preview
            </button>
          </div>
          <p className="mt-1 text-xs text-white/40">
            These {voices.length} voices come from the browser you&apos;re on right now. The overlay uses
            whatever the app running it (OBS, TikTok LIVE Studio, etc.) has installed — if your exact
            pick is missing there, it falls back to any voice in the language above.
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Spotify song requests</h2>
        <Toggle
          checked={songRequestEnabled}
          onChange={setSongRequestEnabled}
          label="Song requests"
          description="Viewers queue tracks on your Spotify with a chat command."
        />
        <div>
          <label className="label">Command</label>
          <input className="input" value={songCommand} onChange={(e) => setSongCommand(e.target.value)} />
          <p className="mt-1 text-xs text-white/40">
            Example: <code>!sr Never Gonna Give You Up</code>
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button className="btn-primary" onClick={save} disabled={saving} type="button">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
