import Link from 'next/link';
import { signIn } from '@/app/auth/actions';
import { AuthShell } from '@/components/AuthShell';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string };
}) {
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-1 text-white/50">Welcome back to your Klaups dashboard.</p>

      {searchParams.notice && (
        <p className="mt-4 rounded-lg bg-brand-500/10 p-3 text-sm text-brand-400">
          {searchParams.notice}
        </p>
      )}
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {searchParams.error}
        </p>
      )}

      <div className="mt-6">
        <GoogleAuthButton source="login" />
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/30">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form action={signIn} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button className="btn-accent w-full" type="submit">
          Log in
        </button>
      </form>

      <p className="mt-6 text-sm text-white/50">
        No account yet?{' '}
        <Link href="/signup" className="text-brand-400 hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
