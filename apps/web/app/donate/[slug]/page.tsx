import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { DonateForm } from './donate-form';

export default async function DonatePage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from('creator_settings')
    .select('profile_id, currency, donation_slug')
    .eq('donation_slug', params.slug)
    .single();

  if (!settings) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, banner_url, bio')
    .eq('id', settings.profile_id)
    .single();

  if (!profile) notFound();

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="absolute inset-x-0 top-0 h-72 bg-cover bg-center opacity-50"
        style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
      />
      <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-black/20 via-black/70 to-black" />
      <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-500/15 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col px-5 pb-14 pt-20 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <div
            className="h-24 w-24 rounded-[28px] border border-white/15 bg-ink-800 bg-cover bg-center shadow-2xl ring-4 ring-black/60"
            style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
          />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            Support the live
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
            {profile.display_name ?? profile.username}
          </h1>
          <p className="mt-1 text-sm text-white/40">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-4 max-w-md text-sm leading-6 text-white/50">{profile.bio}</p>
          )}
        </div>

        <div className="mt-7 rounded-[30px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
          <DonateForm slug={settings.donation_slug} currency={settings.currency} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] text-white/30">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3">Instant alert</div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3">Secure payment</div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3">Creator support</div>
        </div>

        <Link href="/" className="mx-auto mt-8 text-xs text-white/25 transition hover:text-white/50">
          Powered by Klaups
        </Link>
      </div>
    </main>
  );
}
