import Link from 'next/link';
import { signIn } from '@/app/auth/actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-ink-900 px-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-white/60">Welcome back to your Klaups dashboard.</p>

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

      <form action={signIn} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        <button className="btn-primary w-full" type="submit">
          Log in
        </button>
      </form>

      <p className="mt-6 text-sm text-white/60">
        No account yet?{' '}
        <Link href="/signup" className="text-brand-400 hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
