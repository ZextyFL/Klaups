import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { TikTokOnboardingCard } from './tiktok-onboarding-card';

export default async function TikTokOnboardingPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const { settings, supabase, user, profile } = await getCurrentCreator();

  const { data: connection } = await supabase
    .from('tiktok_connections')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle();

  const complete = Boolean(settings.tiktok_verified && settings.tiktok_username);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-indigo-500/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Kl<span className="text-brand-500">aups</span>
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div className="pt-4">
            <p className="eyebrow">Step 2 of 2</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
              Connect the TikTok you actually stream on.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/50">
              Google secures your Klaups login. TikTok Login Kit separately proves ownership of the
              TikTok account, so gift alerts, LIVE chat and creator tools stay tied to the right streamer.
            </p>

            <div className="mt-7 space-y-3">
              {[
                ['1', 'Google account', 'Your Klaups identity and secure login.'],
                ['2', 'TikTok verification', 'Proves which TikTok creator account belongs to you.'],
                ['3', 'Go live', 'Klaups listens for gifts, chat, viewers and commands.'],
              ].map(([number, title, text]) => (
                <div key={number} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xs font-semibold text-brand-300">
                    {number}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/40">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <TikTokOnboardingCard
            displayName={profile.display_name || profile.username}
            verified={Boolean(settings.tiktok_verified)}
            username={settings.tiktok_username}
            connection={connection}
            error={searchParams.error}
          />
        </div>

        {complete && (
          <div className="mt-6 flex justify-end">
            <Link href="/dashboard" className="btn-accent">
              Open Klaups dashboard →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
