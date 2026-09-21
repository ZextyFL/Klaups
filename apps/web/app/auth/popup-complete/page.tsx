'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OAuthPopupCompletePage() {
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand-400" />
        <p className="mt-4 text-sm text-white/50">{ok ? 'Finishing sign in…' : 'Returning to Klaups…'}</p>
      </div>
    </main>
  );
}
