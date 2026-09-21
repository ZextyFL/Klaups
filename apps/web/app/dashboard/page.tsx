import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatTile } from '@/components/dashboard/StatTile';
import { Icons } from '@/components/dashboard/icons';
import { CopyField } from './copy-field';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function DashboardOverview() {
  const { settings, balance, supabase, user, profile } = await getCurrentCreator();

  const [{ data: goal }, { data: todayDonations }, { data: recentDonations }, { data: songRequests }] =
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
        .limit(6),
      supabase
        .from('song_requests')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  const todayCents = (todayDonations ?? []).reduce((sum, d) => sum + d.amount_cents, 0);
  const goalPct = goal?.target_amount_cents
    ? Math.min(100, Math.round((goal.current_amount_cents / goal.target_amount_cents) * 100))
    : 0;

  const live = settings.tiktok_worker_enabled && settings.tiktok_status === 'live';
  const connected = settings.tiktok_worker_enabled && !!settings.tiktok_username;

  const nextPayout = balance?.last_payout_at
    ? new Date(new Date(balance.last_payout_at).getTime() + settings.payout_interval_days * 86_400_000)
    : null;

  const donateUrl = `${siteUrl()}/donate/${settings.donation_slug}`;

  return (
    <div>
      <PageHeader
        title={`Hey ${profile.display_name || profile.username}`}
        description={live ? 'You are live right now.' : 'Here is your stream at a glance.'}
      />

      {/* Live status hero */}
      <div
        className={`relative mb-6 overflow-hidden rounded-3xl border p-6 ${
          live
            ? 'border-green-500/20 bg-[radial-gradient(ellipse_70%_100%_at_0%_50%,rgba(34,197,94,0.14),transparent)]'
            : 'border-white/10 bg-ink-800/60'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {connected && settings.tiktok_avatar_url ? (
              <div
                className="h-12 w-12 shrink-0 rounded-2xl bg-ink-700 bg-cover bg-center"
                style={{ backgroundImage: `url(${settings.tiktok_avatar_url})` }}
              />
            ) : (
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  live ? 'bg-green-500/15 text-green-300' : 'bg-white/[0.06] text-white/50'
                }`}
              >
                <Icons.eye className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-sm text-white/50">
                {connected
                  ? `${settings.tiktok_display_name || settings.tiktok_username} · @${settings.tiktok_username}`
                  : 'TikTok not connected'}
              </p>
              {live ? (
                <p className="text-2xl font-semibold tracking-tight">
                  {settings.tiktok_viewer_count.toLocaleString()}{' '}
                  <span className="text-base font-normal text-white/50">watching now</span>
                </p>
              ) : (
                <p className="text-2xl font-semibold tracking-tight">
                  {connected ? 'Waiting for you to go live' : 'Connect to start'}
                </p>
              )}
            </div>
          </div>
          <Link href="/dashboard/integrations" className={connected ? 'btn-secondary' : 'btn-accent'}>
            {connected ? 'Manage connection' : 'Connect TikTok'}
            <Icons.arrow className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Today's donations"
          value={formatCents(todayCents, settings.currency)}
          hint={`${(todayDonations ?? []).length} donation${(todayDonations ?? []).length === 1 ? '' : 's'}`}
          accent
        />
        <StatTile
          label="Daily goal"
          value={`${goalPct}%`}
          hint={`${formatCents(goal?.current_amount_cents ?? 0, settings.currency)} of ${formatCents(
            goal?.target_amount_cents ?? 0,
            settings.currency
          )}`}
          href="/dashboard/goals"
        />
        <StatTile
          label="Available balance"
          value={formatCents(balance?.available_cents ?? 0, settings.currency)}
          hint={
            settings.stripe_connect_onboarded
              ? nextPayout
                ? `Next payout ${nextPayout.toLocaleDateString()}`
                : 'Paid out on the next run'
              : 'Set up payouts to get paid'
          }
          href="/dashboard/payouts"
        />
        <StatTile
          label="Payout cycle"
          value={`${settings.payout_interval_days}d`}
          hint="Automatic via Stripe"
          href="/dashboard/payouts"
        />
      </div>

      {/* Goal bar */}
      <div className="card mt-4 rounded-2xl">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Today&apos;s goal</span>
          <span className="text-white/50">
            {formatCents(goal?.current_amount_cents ?? 0, settings.currency)} /{' '}
            {formatCents(goal?.target_amount_cents ?? 0, settings.currency)}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-400 transition-all duration-700"
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="card mt-6 rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Your donation link</h2>
          <Link href="/dashboard/widgets" className="btn-ghost text-sm">
            All overlays <Icons.arrow className="h-4 w-4" />
          </Link>
        </div>
        <CopyField label="Share this anywhere" value={donateUrl} />
      </div>

      {/* Activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card rounded-2xl lg:col-span-3">
          <h2 className="font-semibold">Recent donations</h2>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {(recentDonations ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-white/40">
                No donations yet — share your link to get the first one.
              </p>
            )}
            {(recentDonations ?? []).map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.donor_name}</p>
                  {d.message && <p className="truncate text-sm text-white/50">{d.message}</p>}
                  <p className="mt-0.5 text-xs text-white/35">{new Date(d.created_at).toLocaleString()}</p>
                </div>
                <p className="shrink-0 font-semibold text-brand-400">{formatCents(d.amount_cents, d.currency)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card rounded-2xl lg:col-span-2">
          <div className="flex items-center gap-2">
            <Icons.music className="h-4 w-4 text-white/50" />
            <h2 className="font-semibold">Song requests</h2>
          </div>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {(songRequests ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-white/40">
                {settings.song_request_enabled
                  ? 'Nothing queued yet.'
                  : 'Turn on song requests under Connections & TTS.'}
              </p>
            )}
            {(songRequests ?? []).map((s) => (
              <div key={s.id} className="py-3">
                <p className="truncate text-sm font-medium">
                  {s.track_name ? `${s.track_name} — ${s.artist_name}` : s.query}
                </p>
                <p className="text-xs text-white/40">
                  {s.requested_by} ·{' '}
                  <span className={s.status === 'queued' ? 'text-green-400' : 'text-yellow-400'}>
                    {s.status.replace('_', ' ')}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
