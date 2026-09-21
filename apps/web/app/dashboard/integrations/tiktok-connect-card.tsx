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

interface LookupResult {
  username: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function TikTokConnectCard({ settings }: { settings: CreatorSettings }) {
  const supabase = createClient();
  const router = useRouter();

  const [tiktokUsername, setTiktokUsername] = useState(settings.tiktok_username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<LookupResult | null>(null);
  const [lookupFailed, setLookupFailed] = useState<string | null>(null);

  const connected = settings.tiktok_worker_enabled && !!settings.tiktok_username;
  const status = STATUS_LABEL[connected ? settings.tiktok_status : 'disconnected'];

  // Poll while connected so the badge/viewer count follow the worker's updates.
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

  function normalizeUsername(raw: string) {
    return raw
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '')
      .split(/[/?]/)[0]
      .trim();
  }

  async function lookup() {
    const username = normalizeUsername(tiktokUsername);
    if (!username) {
      setError('Enter your TikTok username first');
      return;
    }
    setTiktokUsername(username);
    setBusy(true);
    setError(null);
    setLookupFailed(null);

    try {
      const res = await fetch(`/api/tiktok/lookup?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupFailed(username);
      } else {
        setPending(data as LookupResult);
      }
    } catch {
      setLookupFailed(username);
    } finally {
      setBusy(false);
    }
  }

  async function confirmConnect(result: LookupResult) {
    setBusy(true);
    setError(null);
    await update({
      tiktok_username: result.username,
      tiktok_display_name: result.nickname,
      tiktok_avatar_url: result.avatarUrl,
      tiktok_worker_enabled: true,
      tiktok_status: 'connecting',
      tiktok_status_message: null,
    });
    setPending(null);
    setLookupFailed(null);
    setBusy(false);
  }

  async function connectAnyway() {
    const username = normalizeUsername(tiktokUsername);
    setBusy(true);
    setError(null);
    await update({
      tiktok_username: username,
      tiktok_display_name: null,
      tiktok_avatar_url: null,
      tiktok_worker_enabled: true,
      tiktok_status: 'connecting',
      tiktok_status_message: null,
    });
    setLookupFailed(null);
    setBusy(false);
  }

  async function disconnectTikTok() {
    setBusy(true);
    setError(null);
    await update({
      tiktok_worker_enabled: false,
      tiktok_status: 'disconnected',
      tiktok_status_message: null,
    });
    setBusy(false);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">TikTok LIVE</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.text}</span>
      </div>

      {connected ? (
        <>
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 shrink-0 rounded-full bg-ink-700 bg-cover bg-center"
              style={settings.tiktok_avatar_url ? { backgroundImage: `url(${settings.tiktok_avatar_url})` } : undefined}
            >
              {!settings.tiktok_avatar_url && (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/50">
                  {initials(settings.tiktok_display_name || settings.tiktok_username || '?')}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">
                {settings.tiktok_display_name || settings.tiktok_username}
              </p>
              <p className="truncate text-sm text-white/50">@{settings.tiktok_username}</p>
            </div>
          </div>

          {settings.tiktok_status === 'live' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-2xl font-semibold tabular-nums">
                {settings.tiktok_viewer_count.toLocaleString()}
              </span>
              <span className="text-white/50">watching right now</span>
            </div>
          )}
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
      ) : pending ? (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/[0.06] p-4">
          <p className="mb-3 text-sm font-medium text-white/70">Is this you?</p>
          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 shrink-0 rounded-full bg-ink-700 bg-cover bg-center"
              style={pending.avatarUrl ? { backgroundImage: `url(${pending.avatarUrl})` } : undefined}
            >
              {!pending.avatarUrl && (
                <div className="flex h-full w-full items-center justify-center font-semibold text-white/50">
                  {initials(pending.nickname)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate font-semibold text-white">
                {pending.nickname}
                {pending.verified && <span className="text-brand-400">✓</span>}
              </p>
              <p className="truncate text-sm text-white/50">@{pending.username}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-accent flex-1 text-sm"
              onClick={() => confirmConnect(pending)}
              disabled={busy}
              type="button"
            >
              Yes, that&apos;s me — Connect
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() => setPending(null)}
              disabled={busy}
              type="button"
            >
              Not me
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-white/60">
            No TikTok login required — just your username. We&apos;ll look up your public profile so
            you can confirm it&apos;s really you before we connect.
          </p>
          <div className="flex gap-2">
            <input
              className="input"
              value={tiktokUsername}
              onChange={(e) => {
                setTiktokUsername(e.target.value);
                setLookupFailed(null);
              }}
              placeholder="@yourtiktokhandle"
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
            />
            <button className="btn-primary shrink-0" onClick={lookup} disabled={busy} type="button">
              {busy ? 'Looking up…' : 'Connect TikTok'}
            </button>
          </div>
          {lookupFailed && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
              <p>Couldn&apos;t verify @{lookupFailed} on TikTok right now.</p>
              <button
                className="mt-2 font-medium underline underline-offset-2"
                onClick={connectAnyway}
                disabled={busy}
                type="button"
              >
                Connect anyway
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
