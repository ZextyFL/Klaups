'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Spinner({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand-400" />
        <p className="mt-4 text-sm text-white/50">{label}</p>
      </div>
    </main>
  );
}

function OAuthPopupComplete() {
  const params = useSearchParams();
  const router = useRouter();
  const ok = params.get('ok') === '1';
  const error = params.get('error') || 'Authentication failed.';

  useEffect(() => {
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(
        { type: 'klaups-oauth-complete', ok, error: ok ? null : error },
        window.location.origin
      );
      window.close();
      return;
    }

    router.replace(ok ? '/onboarding/tiktok' : `/login?error=${encodeURIComponent(error)}`);
  }, [error, ok, router]);

  return <Spinner label={ok ? 'Finishing sign in…' : 'Returning to Klaups…'} />;
}

// useSearchParams() opts the route into client-side rendering, so it has to
// sit behind a Suspense boundary or `next build` fails prerendering this page
// (which was breaking every deploy).
export default function OAuthPopupCompletePage() {
  return (
    <Suspense fallback={<Spinner label="Finishing sign in…" />}>
      <OAuthPopupComplete />
    </Suspense>
  );
}
