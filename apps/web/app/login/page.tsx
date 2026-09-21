import { AuthShell } from '@/components/AuthShell';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <AuthShell>
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-400/20 bg-brand-500/10 text-2xl font-black text-brand-300">
          K
        </div>
        <p className="eyebrow">Creator OS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Run your live from one place.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">
          TikTok LIVE alerts, gift sounds, donations, TTS, goals, widgets and payouts — all inside Klaups.
        </p>
      </div>

      {searchParams.error && (
        <p className="mt-5 rounded-xl border border-red-400/15 bg-red-500/10 p-3 text-sm text-red-300">
          {searchParams.error}
        </p>
      )}

      <div className="mt-7">
        <GoogleAuthButton label="Login or Sign up with Google" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] text-white/35">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2 py-3">Google only</div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2 py-3">No password</div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2 py-3">Secure OAuth</div>
      </div>
    </AuthShell>
  );
}
