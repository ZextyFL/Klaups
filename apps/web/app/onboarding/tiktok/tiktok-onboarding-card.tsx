'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Connection = {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  profile_deep_link?: string | null;
} | null;

export function TikTokOnboardingCard({
  displayName,
  verified,
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
  const [liveUsername, setLiveUsername] = useState(username ?? connection?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? null);

  async function finishUsername() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/tiktok/live-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: liveUsername }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not save TikTok username.');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save TikTok username.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-white/[0.09] bg-white/[0.045] p-6 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">Creator setup</p>
          <h2 className="mt-1 text-xl font-semibold">{verified ? 'TikTok verified' : 'Verify TikTok'}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          verified ? 'bg-green-500/10 text-green-300' : 'bg-white/[0.06] text-white/45'
        }`}>
          {verified ? 'Verified' : 'Required'}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/15 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!verified ? (
        <>
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/30 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
              ♪
            </div>
            <p className="mt-4 font-medium">Connect with TikTok Login Kit</p>
            <p className="mt-2 text-sm leading-6 text-white/45">
              TikTok will ask you to authorize Klaups. Your OAuth tokens stay server-side.
            </p>
          </div>

          <a href="/api/tiktok/connect" className="btn-accent mt-5 w-full">
            Continue with TikTok
          </a>

          <p className="mt-4 text-xs leading-5 text-white/30">
            TikTok does not expose the private email used to create an account, so Klaups verifies
            ownership through TikTok&apos;s own authorization instead of comparing Gmail addresses.
          </p>
        </>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-green-400/15 bg-green-500/[0.06] p-4">
            <div
              className="h-14 w-14 shrink-0 rounded-full bg-white/[0.08] bg-cover bg-center"
              style={connection?.avatar_url ? { backgroundImage: `url(${connection.avatar_url})` } : undefined}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">{connection?.display_name || displayName}</p>
              <p className="mt-0.5 text-xs text-green-300">TikTok ownership verified</p>
            </div>
          </div>

          {!username ? (
            <div className="mt-5">
              <label className="label">TikTok LIVE username</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">@</span>
                <input
                  className="input pl-8"
                  value={liveUsername}
                  onChange={(e) => setLiveUsername(e.target.value)}
                  placeholder="yourusername"
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-white/35">
                This is only needed when TikTok has not approved Klaups for the profile username scope yet.
              </p>
              <button type="button" className="btn-accent mt-4 w-full" onClick={finishUsername} disabled={busy}>
                {busy ? 'Saving…' : 'Finish setup'}
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-white/45">LIVE account</p>
              <p className="mt-1 text-lg font-semibold">@{username}</p>
              <button type="button" className="btn-accent mt-5 w-full" onClick={() => router.push('/dashboard')}>
                Enter dashboard
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
