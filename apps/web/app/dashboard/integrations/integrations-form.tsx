'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CreatorSettings } from '@/lib/database.types';

const STATUS_LABEL: Record<CreatorSettings['tiktok_status'], { text: string; className: string }> = {
  disconnected: { text: 'Not connected', className: 'bg-white/10 text-white/60' },
  connecting: { text: 'Connecting…', className: 'bg-yellow-500/15 text-yellow-300' },
  live: { text: 'Live — reading chat', className: 'bg-green-500/15 text-green-300' },
  offline: { text: 'Connected — waiting for you to go live', className: 'bg-brand-500/15 text-brand-400' },
  error: { text: 'Connection problem', className: 'bg-red-500/15 text-red-300' },
};

export function IntegrationsForm({ settings }: { settings: CreatorSettings }) {
  const supabase = createClient();
  const router = useRouter();

  const [tiktokUsername, setTiktokUsername] = useState(settings.tiktok_username ?? '');
  const [ttsEnabled, setTtsEnabled] = useState(settings.tts_enabled);
  const [minTts, setMinTts] = useState((settings.min_tts_amount_cents / 100).toString());
  const [songRequestEnabled, setSongRequestEnabled] = useState(settings.song_request_enabled);
  const [songCommand, setSongCommand] = useState(settings.song_request_command);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = settings.tiktok_worker_enabled && !!settings.tiktok_username;
  const status = STATUS_LABEL[connected ? settings.tiktok_status : 'disconnected'];

  // Poll while connected so the badge follows the worker's status updates.
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [connected, router]);

  async function update(patch: Partial<CreatorSettings>) {
    const { error: updateError } = await supabase
      .from('creator_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('profile_id', settings.profile_id);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  async function connectTikTok() {
    const username = tiktokUsername.replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '').split(/[/?]/)[0].trim();
    if (!username) {
      setError('Enter your TikTok username first');
      return;
    }
    setBusy(true);
    setError(null);
    setTiktokUsername(username);
    await update({ tiktok_username: username, tiktok_worker_enabled: true, tiktok_status: 'connecting', tiktok_status_message: null });
    setBusy(false);
  }

  async function disconnectTikTok() {
    setBusy(true);
    setError(null);
    await update({ tiktok_worker_enabled: false, tiktok_status: 'disconnected', tiktok_status_message: null });
    setBusy(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    await update({
      tts_enabled: ttsEnabled,
      min_tts_amount_cents: Math.round(parseFloat(minTts || '0') * 100),
      song_request_enabled: songRequestEnabled,
      song_request_command: songCommand || '!sr',
    });
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">TikTok LIVE</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.text}</span>
        </div>

        {connected ? (
          <>
            <p className="text-sm text-white/70">
              Connected as <span className="font-semibold text-white">@{settings.tiktok_username}</span>
            </p>
            {settings.tiktok_status_message && (
              <p className="text-xs text-white/40">{settings.tiktok_status_message}</p>
            )}
            {settings.tiktok_last_seen_at && (
              <p className="text-xs text-white/40">
                Last live: {new Date(settings.tiktok_last_seen_at).toLocaleString()}
              </p>
            )}
            <button className="btn-secondary text-sm" onClick={disconnectTikTok} disabled={busy} type="button">
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-white/60">
              No login needed — just your TikTok username. Chat and gifts are picked up automatically whenever
              you go live.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                value={tiktokUsername}
                onChange={(e) => setTiktokUsername(e.target.value)}
                placeholder="@yourtiktokhandle"
                onKeyDown={(e) => e.key === 'Enter' && connectTikTok()}
              />
              <button className="btn-primary shrink-0" onClick={connectTikTok} disabled={busy} type="button">
                {busy ? 'Connecting…' : 'Connect TikTok'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Text-to-speech</h2>
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
