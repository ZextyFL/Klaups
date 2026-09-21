import Link from 'next/link';
import { signUp } from '@/app/auth/actions';

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-black px-6">
      <Link href="/" className="mb-8 text-[19px] font-semibold tracking-tight">
        Kl<span className="text-brand-500">aups</span>
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Create your page</h1>
      <p className="mt-1 text-white/50">
        Your donation link, overlays and payouts, set up in a minute.
      </p>

      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {searchParams.error}
        </p>
      )}

      <form action={signUp} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            className="input"
            id="username"
            name="username"
            placeholder="yourname"
            pattern="[a-zA-Z0-9_\-]+"
            required
          />
          <p className="mt-1 text-xs text-white/40">This becomes klaups.com/donate/yourname</p>
        </div>
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
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
          />
        </div>
        <button className="btn-accent w-full" type="submit">
          Create account
        </button>
      </form>

      <p className="mt-6 text-sm text-white/50">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
