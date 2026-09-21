'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CreatorSettings } from '@/lib/database.types';

export function IntegrationsForm({ settings }: { settings: CreatorSettings }) {
  const supabase = createClient();
  const router = useRouter();

  const [tiktokUsername, setTiktokUsername] = useState(settings.tiktok_username ?? '');
  const [workerEnabled, setWorkerEnabled] = useState(settings.tiktok_worker_enabled);
  const [ttsEnabled, setTtsEnabled] = useState(settings.tts_enabled);
  const [minTts, setMinTts] = useState((settings.min_tts_amount_cents / 100).toString());
  const [songRequestEnabled, setSongRequestEnabled] = useState(settings.song_request_enabled);
  const [songCommand, setSongCommand] = useState(settings.song_request_command);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('creator_settings')
      .update({
        tiktok_username: tiktokUsername.replace('@', '').trim() || null,
        tiktok_worker_enabled: workerEnabled,
        tts_enabled: ttsEnabled,
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

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h2 className="font-semibold">TikTok Live</h2>
        <div>
          <label className="label">TikTok username</label>
          <input
            className="input"
            value={tiktokUsername}
            onChange={(e) => setTiktokUsername(e.target.value)}
            placeholder="yourtiktokhandle"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={workerEnabled}
            onChange={(e) => setWorkerEnabled(e.target.checked)}
          />
          Listen to my live chat &amp; gifts when I go live
        </label>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
          Read chat aloud (TTS) on the chat overlay
        </label>
        <div>
          <label className="label">Minimum donation amount to trigger TTS on alerts</label>
          <input className="input" type="number" min={0} value={minTts} onChange={(e) => setMinTts(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Spotify song requests</h2>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={songRequestEnabled}
            onChange={(e) => setSongRequestEnabled(e.target.checked)}
          />
          Let viewers queue songs on my Spotify with a chat command
        </label>
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
