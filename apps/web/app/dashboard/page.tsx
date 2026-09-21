import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Icons } from '@/components/dashboard/icons';
import { CopyField } from './copy-field';
import { TestSendButton } from '@/components/dashboard/TestSendButton';

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export default async function DashboardOverview() {
  const { settings, balance, supabase, user, profile } = await getCurrentCreator();

  const [{ data: goal }, { data: todayDonations }, { data: recentDonations }] =
    await Promise.all([
      supabase.rpc('get_or_create_today_goal', { p_profile_id: user.id }),
      supabase
        .from('donations')
        .select('amount_cents')
        .eq('profile_id', user.id)
        .eq('status', 'paid')
        .gte('created_at', startOfToday()),
      supabase
        .from('donations')
        .select('*')
        .eq('profile_id', user.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  const todayCents = (todayDonations ?? []).reduce(
    (sum, donation) => sum + donation.amount_cents,
    0
  );
  const latestDonation = recentDonations?.[0] ?? null;
  const goalPct = goal?.target_amount_cents
    ? Math.min(100, Math.round((goal.current_amount_cents / goal.target_amount_cents) * 100))
    : 0;

  const live = settings.tiktok_worker_enabled && settings.tiktok_status === 'live';
  const connected = settings.tiktok_worker_enabled && Boolean(settings.tiktok_username);
  const verified = settings.stripe_connect_onboarded && settings.stripe_payouts_enabled;
  const donateUrl = `${siteUrl()}/donate/${settings.donation_slug}`;

  return (
    <div>
      <PageHeader
        title={`Overview`}
        description={`Welcome back, ${profile.display_name || profile.username}.`}
        action={
          <TestSendButton
            endpoint="/api/test/donation"
            body={{ amountCents: 500, donorName: 'Klaups Test' }}
            label="Test alert"
            className="btn-secondary"
          />
        }
      />

      {!verified && (
        <Link
          href="/dashboard/verify"
          className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] px-5 py-4 transition hover:bg-amber-500/[0.09]"
        >
          <div>
            <p className="font-medium text-amber-200">Verify your account for payouts</p>
            <p className="mt-1 text-sm text-white/45">
              Complete Stripe verification so your Klaups balance can be paid to your bank.
            </p>
          </div>
          <span className="text-sm font-medium text-amber-200">Verify account →</span>
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="card overflow-hidden rounded-3xl p-0">
          <div className="relative p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(236,72,153,0.16),transparent_42%)]"
            />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/45">Available balance</p>
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.04em] tabular-nums">
                    {formatCents(balance?.available_cents ?? 0, settings.currency)}
                  </p>
                  <p className="mt-2 text-sm text-white/35">
                    {verified ? 'Ready for the next payout run.' : 'Verification required before payout.'}
                  </p>
                </div>
                <Link href="/dashboard/payouts" className="btn-primary">
                  Payouts <Icons.arrow className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Link
                  href="/dashboard/donations"
                  className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 transition hover:bg-white/[0.04]"
                >
                  <p className="text-xs text-white/40">Today</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCents(todayCents, settings.currency)}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {todayDonations?.length ?? 0} donations
                  </p>
                </Link>
                <Link
                  href="/dashboard/goals"
                  className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 transition hover:bg-white/[0.04]"
                >
                  <p className="text-xs text-white/40">Daily goal</p>
                  <p className="mt-1 text-xl font-semibold">{goalPct}%</p>
                  <p className="mt-1 text-xs text-white/30">
                    {formatCents(goal?.current_amount_cents ?? 0, settings.currency)}
                  </p>
                </Link>
                <Link
                  href="/dashboard/alerts"
                  className="col-span-2 rounded-2xl border border-white/[0.07] bg-black/20 p-4 transition hover:bg-white/[0.04] sm:col-span-1"
                >
                  <p className="text-xs text-white/40">Alerts</p>
                  <p className="mt-1 text-xl font-semibold">Ready</p>
                  <p className="mt-1 text-xs text-white/30">Test & customize</p>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card rounded-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/45">Stream status</p>
              <h2 className="mt-1 text-2xl font-semibold">{live ? 'You are live' : 'Offline'}</h2>
            </div>
            <span
              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                live ? 'bg-green-400 shadow-[0_0_14px_rgba(74,222,128,0.8)]' : 'bg-white/20'
              }`}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-sm text-white/45">
              {connected
                ? `@${settings.tiktok_username}`
                : 'TikTok is not connected yet.'}
            </p>
            {live && (
              <p className="mt-1 text-2xl font-semibold">
                {settings.tiktok_viewer_count.toLocaleString()}
                <span className="ml-2 text-sm font-normal text-white/40">watching</span>
              </p>
            )}
          </div>

          <Link
            href="/dashboard/integrations"
            className={`${connected ? 'btn-secondary' : 'btn-accent'} mt-4 w-full`}
          >
            {connected ? 'Manage connection' : 'Connect TikTok'}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card rounded-3xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/45">Most recent donation</p>
              <h2 className="mt-1 text-xl font-semibold">
                {latestDonation ? latestDonation.donor_name : 'No donations yet'}
              </h2>
            </div>
            {latestDonation && (
              <p className="text-xl font-semibold text-brand-300">
                {formatCents(latestDonation.amount_cents, latestDonation.currency)}
              </p>
            )}
          </div>
          <p className="mt-4 min-h-6 text-sm text-white/45">
            {latestDonation?.message || 'Your latest donor message will appear here.'}
          </p>
          <Link href="/dashboard/donations" className="btn-ghost mt-4 text-sm">
            View all donations <Icons.arrow className="h-4 w-4" />
          </Link>
        </div>

        <div className="card rounded-3xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/45">Daily goal</p>
              <h2 className="mt-1 text-xl font-semibold">
                {formatCents(goal?.current_amount_cents ?? 0, settings.currency)}
                <span className="font-normal text-white/35">
                  {' '}of {formatCents(goal?.target_amount_cents ?? 0, settings.currency)}
                </span>
              </h2>
            </div>
            <span className="text-sm font-semibold text-brand-300">{goalPct}%</span>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-400 transition-all duration-700"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <Link href="/dashboard/goals" className="btn-ghost mt-4 text-sm">
            Edit goal <Icons.arrow className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="card mt-4 rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Your donation link</h2>
            <p className="mt-1 text-sm text-white/40">
              Share it in your TikTok bio, chat, Discord or stream description.
            </p>
          </div>
          <Link href="/dashboard/donation-link" className="btn-ghost text-sm">
            Customize page <Icons.arrow className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4">
          <CopyField label="Public donation page" value={donateUrl} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['/dashboard/alerts', 'Alerts', 'Customize & test', 'bell'],
          ['/dashboard/soundboard', 'Soundboard', 'Sounds & hotkeys', 'music'],
          ['/dashboard/widgets', 'Widgets', 'OBS browser sources', 'grid'],
          ['/dashboard/settings', 'Settings', 'Account & platform', 'settings'],
        ].map(([href, title, description, icon]) => {
          const Icon = Icons[icon as keyof typeof Icons];
          return (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]"
            >
              <Icon className="h-5 w-5 text-white/45" />
              <p className="mt-3 font-medium">{title}</p>
              <p className="mt-1 text-xs text-white/35">{description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
