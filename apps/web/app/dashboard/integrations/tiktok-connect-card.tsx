'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreatorSettings } from '@/lib/database.types';

const STATUS_LABEL: Record<CreatorSettings['tiktok_status'], { text: string; className: string }> = {
  disconnected: { text: 'Not listening', className: 'bg-white/[0.06] text-white/50' },
  connecting: { text: 'Connecting…', className: 'bg-amber-500/10 text-amber-300' },
  live: { text: 'LIVE', className: 'bg-green-500/10 text-green-300' },
  offline: { text: 'Waiting for your LIVE', className: 'bg-brand-500/10 text-brand-300' },
  error: { text: 'Connection issue', className: 'bg-red-500/10 text-red-300' },
};

type OfflineNotice = { title: string; body: string[]; details: string };

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase();
}

export function TikTokConnectCard({ settings }: { settings: CreatorSettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<OfflineNotice | null>(null);

  const linked = Boolean(settings.tiktok_username);
  const listening = Boolean(settings.tiktok_worker_enabled);
  const status = STATUS_LABEL[linked ? settings.tiktok_status : 'disconnected'];

  async function connectLive() {
    setBusy(true);
    setError(null);
    setOffline(null);
    try {
      const response = await fetch('/api/tiktok/live-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));

      // 409 is the expected "you're not streaming yet" answer, not a failure.
      if (response.status === 409 && body?.offline) {
        setOffline({ title: body.title, body: body.body, details: body.details });
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error(body?.error || 'Could not connect to TikTok LIVE.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to TikTok LIVE.');
    } finally {
      setBusy(false);
    }
  }

  async function stopListening() {
    setBusy(true);
    setError(null);
    setOffline(null);
    try {
      const response = await fetch('/api/tiktok/live-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      if (!response.ok) throw new Error('Could not stop listening.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop listening.');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/tiktok/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Could not disconnect TikTok.');
      router.push('/onboarding/tiktok');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect TikTok.');
      setBusy(false);
    }
  }

  return (
    <div className="card rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">TikTok LIVE</p>
          <h2 className="mt-1 text-xl font-semibold">Creator connection</h2>
        </div>
        <div className="flex items-center gap-2">
          {settings.tiktok_verified && (
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              ✓ Linked
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.text}
          </span>
        </div>
      </div>

      {linked ? (
        <>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/[0.06] bg-cover bg-center font-semibold text-white/50"
              style={settings.tiktok_avatar_url ? { backgroundImage: `url(${settings.tiktok_avatar_url})` } : undefined}
            >
              {!settings.tiktok_avatar_url && initials(settings.tiktok_display_name || settings.tiktok_username || '?')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{settings.tiktok_display_name || settings.tiktok_username}</p>
              <p className="truncate text-sm text-white/40">@{settings.tiktok_username}</p>
            </div>
            {settings.tiktok_status === 'live' && (
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{settings.tiktok_viewer_count.toLocaleString()}</p>
                <p className="text-xs text-white/35">watching</p>
              </div>
            )}
          </div>

          {offline && (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] p-4">
              <p className="font-medium text-amber-200">{offline.title}</p>
              {offline.body.map((line) => (
                <p key={line} className="mt-2 text-sm leading-6 text-white/55">
                  {line}
                </p>
              ))}
              <p className="mt-3 border-t border-white/[0.08] pt-3 text-xs text-white/35">
                Details: {offline.details}
              </p>
            </div>
          )}

          {!offline && settings.tiktok_status_message && (
            <p className="mt-3 rounded-xl bg-white/[0.035] px-3 py-2 text-xs text-white/40">
              {settings.tiktok_status_message}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {listening ? (
              <button type="button" onClick={stopListening} disabled={busy} className="btn-secondary text-sm">
                {busy ? 'Stopping…' : 'Stop listening'}
              </button>
            ) : (
              <button type="button" onClick={connectLive} disabled={busy} className="btn-accent text-sm">
                {busy ? 'Checking your LIVE…' : 'Connect TikTok LIVE'}
              </button>
            )}
            <a href="/dashboard/tiktok-gifts" className="btn-secondary text-sm">Gift alerts</a>
            <button type="button" onClick={unlink} disabled={busy} className="btn-ghost px-3 text-sm text-red-300">
              Unlink TikTok
            </button>
          </div>

          {listening && (
            <p className="mt-3 text-xs leading-5 text-white/30">
              Klaups stays connected while you stream, reconnects automatically if the room drops,
              and waits for your next LIVE when the stream ends.
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="font-medium">Add your TikTok account</p>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Tell Klaups which TikTok you stream on, confirm the profile we show you, and you&apos;re set.
          </p>
          <a href="/onboarding/tiktok" className="btn-accent mt-4 text-sm">Add TikTok</a>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
    </div>
  );
}
