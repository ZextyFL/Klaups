'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Connection = {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  link_method?: string | null;
} | null;

type Preview = {
  username: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
  liveNow: boolean;
};

export function TikTokOnboardingCard({
  displayName,
  username,
  connection,
  error: initialError,
}: {
  displayName: string;
  verified: boolean;
  username: string | null;
  connection: Connection;
  error?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState(username ?? connection?.username ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? null);

  async function lookup() {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const response = await fetch(`/api/tiktok/lookup?username=${encodeURIComponent(input)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not find that TikTok account.');
      setPreview(body as Preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find that TikTok account.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/tiktok/live-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: preview.username }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not save your TikTok account.');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your TikTok account.');
      setBusy(false);
    }
  }

  if (username) {
    return (
      <section className="rounded-[30px] border border-white/[0.09] bg-white/[0.045] p-6 shadow-2xl backdrop-blur-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">Creator setup</p>
        <h2 className="mt-1 text-xl font-semibold">TikTok connected</h2>
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-green-400/15 bg-green-500/[0.06] p-4">
          <div
            className="h-14 w-14 shrink-0 rounded-full bg-white/[0.08] bg-cover bg-center"
            style={connection?.avatar_url ? { backgroundImage: `url(${connection.avatar_url})` } : undefined}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{connection?.display_name || displayName}</p>
            <p className="mt-0.5 truncate text-sm text-white/45">@{username}</p>
          </div>
        </div>
        <button type="button" className="btn-accent mt-5 w-full" onClick={() => router.push('/dashboard')}>
          Enter dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-white/[0.09] bg-white/[0.045] p-6 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">Creator setup</p>
          <h2 className="mt-1 text-xl font-semibold">Add your TikTok</h2>
        </div>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/45">Required</span>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/15 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      {!preview ? (
        <>
          <label className="label mt-5">TikTok username</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">@</span>
            <input
              className="input pl-8"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && input.trim() && !busy) void lookup();
              }}
              placeholder="yourusername"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn-accent mt-4 w-full"
            onClick={lookup}
            disabled={busy || !input.trim()}
          >
            {busy ? 'Looking up…' : 'Find my account'}
          </button>
          <p className="mt-4 text-xs leading-5 text-white/30">
            We only read your public TikTok profile — the same page anyone can visit. Klaups never
            asks for your TikTok password.
          </p>
        </>
      ) : (
        <>
          <p className="mt-5 text-sm text-white/45">Is this you?</p>
          <div className="mt-3 flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
            <div
              className="h-16 w-16 shrink-0 rounded-full bg-white/[0.08] bg-cover bg-center"
              style={preview.avatarUrl ? { backgroundImage: `url(${preview.avatarUrl})` } : undefined}
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-semibold">
                {preview.nickname}
                {preview.verified && <span className="text-sm text-brand-300">✓</span>}
              </p>
              <p className="mt-0.5 truncate text-sm text-white/45">@{preview.username}</p>
              {preview.liveNow && (
                <p className="mt-1 text-xs font-medium text-green-300">● LIVE right now</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              No, try again
            </button>
            <button type="button" className="btn-accent flex-1" onClick={confirm} disabled={busy}>
              {busy ? 'Saving…' : "Yes, that's me"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
