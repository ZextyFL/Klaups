'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreatorSettings } from '@/lib/database.types';

const STATUS_LABEL: Record<CreatorSettings['tiktok_status'], { text: string; className: string }> = {
  disconnected: { text: 'Not listening', className: 'bg-white/[0.06] text-white/50' },
  connecting: { text: 'Connecting…', className: 'bg-amber-500/10 text-amber-300' },
  live: { text: 'LIVE', className: 'bg-green-500/10 text-green-300' },
  offline: { text: 'Ready for LIVE', className: 'bg-brand-500/10 text-brand-300' },
  error: { text: 'Connection issue', className: 'bg-red-500/10 text-red-300' },
};

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase();
}

export function TikTokConnectCard({ settings }: { settings: CreatorSettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verified = Boolean(settings.tiktok_verified);
  const ready = verified && Boolean(settings.tiktok_username);
  const status = STATUS_LABEL[ready ? settings.tiktok_status : 'disconnected'];

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/tiktok/disconnect', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not disconnect TikTok.');
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
          {verified && (
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              ✓ Ownership verified
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.text}
          </span>
        </div>
      </div>

      {ready ? (
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

          {settings.tiktok_status_message && (
            <p className="mt-3 rounded-xl bg-white/[0.035] px-3 py-2 text-xs text-white/40">
              {settings.tiktok_status_message}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/dashboard/tiktok-gifts" className="btn-accent text-sm">Gift alerts</a>
            <a href="/onboarding/tiktok" className="btn-secondary text-sm">Account setup</a>
            <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost px-3 text-sm text-red-300">
              {busy ? 'Disconnecting…' : 'Disconnect TikTok'}
            </button>
          </div>
        </>
      ) : verified ? (
        <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] p-4">
          <p className="font-medium text-amber-200">One step left</p>
          <p className="mt-1 text-sm text-white/45">
            Your TikTok identity is verified. Add your LIVE username to let Klaups listen for gifts and chat.
          </p>
          <a href="/onboarding/tiktok" className="btn-accent mt-4 text-sm">Finish TikTok setup</a>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="font-medium">Verify ownership with TikTok</p>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Klaups uses TikTok Login Kit for identity verification. Your private TikTok credentials never pass through Klaups.
          </p>
          <a href="/api/tiktok/connect" className="btn-accent mt-4 text-sm">Connect TikTok</a>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
    </div>
  );
}
