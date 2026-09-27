'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { announceAuthResult } from '@/lib/auth-handoff';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-sm text-center">{children}</div>
    </main>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <Shell>
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand-400" />
      <p className="mt-4 text-sm text-white/50">{label}</p>
    </Shell>
  );
}

function OAuthPopupComplete() {
  const params = useSearchParams();
  const ok = params.get('ok') === '1';
  const error = params.get('error') || 'Authentication failed.';
  const [stillOpen, setStillOpen] = useState(false);

  useEffect(() => {
    // Tell the Klaups tab that started the sign-in, then get out of the way.
    // Never load the app in here: this window is only the sign-in popup.
    announceAuthResult(ok, ok ? null : error);
    window.close();
    // Some browsers refuse to close a window whose opener was severed.
    const timer = window.setTimeout(() => setStillOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, [error, ok]);

  if (!stillOpen) return <Spinner label={ok ? 'Signed in — returning to Klaups…' : 'Returning to Klaups…'} />;

  return (
    <Shell>
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${
          ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
        }`}
      >
        {ok ? '✓' : '!'}
      </div>
      <h1 className="mt-4 text-xl font-semibold">{ok ? 'You’re signed in' : 'Sign-in didn’t finish'}</h1>
      <p className="mt-2 text-sm leading-6 text-white/50">
        {ok ? 'Your Klaups tab has been updated. You can close this window.' : error}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn-accent text-sm" onClick={() => window.close()}>
          Close window
        </button>
        {/* Only if the original tab is gone: continue here instead. */}
        <a href={ok ? '/onboarding/tiktok' : '/login'} className="btn-secondary text-sm">
          {ok ? 'Continue here' : 'Back to login'}
        </a>
      </div>
    </Shell>
  );
}

// useSearchParams() needs a Suspense boundary or `next build` fails to
// prerender this page.
export default function OAuthPopupCompletePage() {
  return (
    <Suspense fallback={<Spinner label="Finishing sign in…" />}>
      <OAuthPopupComplete />
    </Suspense>
  );
}
