'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  forgetAccount,
  listenForAuthResult,
  readRecentAccounts,
  rememberAccount,
  type RecentAccount,
} from '@/lib/auth-handoff';

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

function initials(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || '?';
}

export function GoogleAuthButton({ label = 'Continue with Google' }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentAccount[]>([]);
  const finished = useRef(false);

  useEffect(() => setRecent(readRecentAccounts()), []);

  // Signed in: remember this account on this device and go in. Idempotent,
  // because the hand-off can arrive over more than one route.
  const complete = useCallback(async () => {
    if (finished.current) return;
    const { data } = await createClient().auth.getUser();
    const user = data.user;
    if (!user) return;
    finished.current = true;
    const meta = user.user_metadata ?? {};
    rememberAccount({
      email: user.email ?? '',
      name: meta.full_name || meta.name || user.email || 'Klaups creator',
      avatarUrl: meta.avatar_url || meta.picture || null,
    });
    router.replace('/dashboard');
    router.refresh();
  }, [router]);

  useEffect(() => {
    const stop = listenForAuthResult((result) => {
      setLoading(false);
      if (result.ok) void complete();
      else setError(result.error || 'Google sign in failed.');
    });
    // Belt and braces: the popup shares our cookies, so coming back to this
    // tab with a session means sign-in worked even if every message was lost.
    const onFocus = () => {
      if (!finished.current) void complete();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      stop();
      window.removeEventListener('focus', onFocus);
    };
  }, [complete]);

  async function signIn(loginHint?: string) {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?popup=1`;
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        // A remembered account goes straight to that Google account; otherwise
        // always offer the picker so people can switch accounts.
        queryParams: loginHint ? { login_hint: loginHint } : { prompt: 'select_account' },
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
      // Popup blocked: do the same sign-in in this tab instead of failing.
      window.location.assign(data.url.replace(encodeURIComponent('?popup=1'), ''));
      return;
    }

    popup.focus();

    // Once Google severs the opener, `closed` can read true while the popup is
    // still open, so treat it only as a cue to check the session.
    const watcher = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(watcher);
      void complete().finally(() => {
        if (!finished.current) setLoading(false);
      });
    }, 800);
  }

  return (
    <div>
      {recent.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-left text-xs font-medium uppercase tracking-[0.14em] text-white/35">Welcome back</p>
          {recent.map((account) => (
            <div key={account.email} className="group relative">
              <button
                type="button"
                onClick={() => void signIn(account.email)}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-70"
              >
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-semibold text-white/70">
                    {initials(account.name)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">Continue as {account.name}</span>
                  <span className="block truncate text-xs text-white/45">{account.email}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Forget ${account.email} on this device`}
                title="Forget on this device"
                onClick={() => {
                  forgetAccount(account.email);
                  setRecent(readRecentAccounts());
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-white/30 opacity-0 transition hover:bg-white/[0.08] hover:text-white/70 focus:opacity-100 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void signIn()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-[0_12px_36px_-16px_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:bg-white/95 disabled:cursor-wait disabled:opacity-70"
      >
        <GoogleIcon />
        {loading ? 'Waiting for Google…' : recent.length ? 'Use another Google account' : label}
      </button>
      {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
