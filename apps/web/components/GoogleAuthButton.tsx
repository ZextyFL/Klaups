'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#EA4335" d="M12 10.2v4.02h5.59c-.25 1.29-.98 2.38-2.07 3.12l3.35 2.6c1.96-1.81 3.09-4.48 3.09-7.64 0-.74-.07-1.45-.19-2.1H12Z" />
      <path fill="#4285F4" d="M12 22c2.8 0 5.15-.93 6.87-2.52l-3.35-2.6c-.93.63-2.12 1-3.52 1-2.7 0-4.99-1.82-5.81-4.27l-3.47 2.68A10.39 10.39 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.19 13.61A6.24 6.24 0 0 1 5.86 11.6c0-.7.12-1.38.33-2.01L2.72 6.9A10.38 10.38 0 0 0 1.64 11.6c0 1.68.4 3.27 1.08 4.7l3.47-2.69Z" />
      <path fill="#34A853" d="M12 5.32c1.52 0 2.88.52 3.95 1.54l2.96-2.96C17.14 2.25 14.8 1.2 12 1.2A10.39 10.39 0 0 0 2.72 6.9l3.47 2.69C7.01 7.14 9.3 5.32 12 5.32Z" />
    </svg>
  );
}

export function GoogleAuthButton({ label = 'Continue with Google' }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'klaups-oauth-complete') return;

      setLoading(false);
      if (event.data?.ok) {
        router.push('/onboarding/tiktok');
        router.refresh();
      } else {
        setError(event.data?.error || 'Google sign in failed.');
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  async function signIn() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?popup=1`;
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (authError || !data.url) {
      setLoading(false);
      setError(authError?.message || 'Could not start Google sign in.');
      return;
    }

    const width = 520;
    const height = 680;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      data.url,
      'klaups-google-auth',
      `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`
    );

    if (!popup) {
      setLoading(false);
      setError('Your browser blocked the Google sign-in popup. Allow popups for Klaups and try again.');
      return;
    }

    popup.focus();

    const watcher = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(watcher);
      setLoading(false);
    }, 500);
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-[0_12px_36px_-16px_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:bg-white/95 disabled:cursor-wait disabled:opacity-70"
      >
        <GoogleIcon />
        {loading ? 'Opening Google…' : label}
      </button>
      {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
