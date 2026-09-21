'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CreatorSettings } from '@/lib/database.types';
import { Toggle } from '@/components/ui/Toggle';
import { TikTokConnectCard } from './tiktok-connect-card';

export function IntegrationsForm({ settings }: { settings: CreatorSettings }) {
  const supabase = createClient();
  const router = useRouter();

  const [ttsEnabled, setTtsEnabled] = useState(settings.tts_enabled);
  const [minTts, setMinTts] = useState((settings.min_tts_amount_cents / 100).toString());
  const [songRequestEnabled, setSongRequestEnabled] = useState(settings.song_request_enabled);
  const [songCommand, setSongCommand] = useState(settings.song_request_command);
  const [ttsVoice, setTtsVoice] = useState(settings.tts_voice ?? 'default');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (ttsVoice !== 'default') {
      const voice = voices.find((v) => v.name === ttsVoice);
      if (voice) utterance.voice = voice;
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
          <label className="label">Voice</label>
          <div className="flex gap-2">
            <select className="input" value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}>
              <option value="default">Browser default</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button className="btn-secondary shrink-0 text-sm" onClick={previewVoice} type="button">
              Preview
            </button>
          </div>
          <p className="mt-1 text-xs text-white/40">
            Voices come from the browser running the overlay (OBS, TikTok LIVE Studio, etc.), not this
            dashboard — pick the one that sounds right here, it&apos;ll carry over as long as that app has
            a matching voice installed.
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
