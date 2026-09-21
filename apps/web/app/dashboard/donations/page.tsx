import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/PageHeader';

export default async function DonationsPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const [{ data: statsRows }, { data: topSupporters }, { data: recentDonations }] =
    await Promise.all([
      supabase.rpc('get_creator_donation_stats', { p_profile_id: user.id }),
      supabase.rpc('get_creator_top_supporters', { p_profile_id: user.id, p_limit: 5 }),
      supabase
        .from('donations')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  const stats = statsRows?.[0] ?? {
    today_cents: 0,
    today_count: 0,
    month_cents: 0,
    month_count: 0,
    total_cents: 0,
    total_count: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donations"
        description="Revenue, supporters and every incoming creator payment in one place."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Today', Number(stats.today_cents ?? 0), Number(stats.today_count ?? 0)],
          ['This month', Number(stats.month_cents ?? 0), Number(stats.month_count ?? 0)],
          ['All time', Number(stats.total_cents ?? 0), Number(stats.total_count ?? 0)],
        ].map(([label, cents, count], index) => (
          <div key={String(label)} className="card rounded-3xl p-5">
            <p className="text-sm text-white/45">{String(label)}</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight ${index === 2 ? 'text-brand-300' : ''}`}>
              {formatCents(Number(cents), settings.currency)}
            </p>
            <p className="mt-1 text-xs text-white/35">
              {Number(count).toLocaleString()} paid {Number(count) === 1 ? 'donation' : 'donations'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden rounded-3xl p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="eyebrow">Activity</p>
              <h2 className="mt-1 font-semibold">Donation feed</h2>
            </div>
            <span className="text-xs text-white/30">Newest first</span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {(recentDonations ?? []).map((donation) => (
              <div
                key={donation.id}
                className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.02] md:grid-cols-[1.1fr_2fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-medium">{donation.donor_name}</p>
                  <p className="text-xs text-white/35">{new Date(donation.created_at).toLocaleString()}</p>
                </div>
                <p className="truncate text-sm text-white/55">{donation.message || 'No message'}</p>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                    donation.status === 'paid'
                      ? 'bg-green-500/10 text-green-300'
                      : donation.status === 'refunded'
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-white/[0.06] text-white/50'
                  }`}
                >
                  {donation.status}
                </span>
                <p className="font-semibold tabular-nums">{formatCents(donation.amount_cents, donation.currency)}</p>
              </div>
            ))}

            {(recentDonations ?? []).length === 0 && (
              <div className="px-5 py-14 text-center">
                <p className="font-medium">No donations yet</p>
                <p className="mt-1 text-sm text-white/40">Share your creator page to receive your first one.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card h-fit rounded-3xl">
          <p className="eyebrow">Community</p>
          <h2 className="mt-1 font-semibold">Top supporters</h2>
          <p className="mt-1 text-xs text-white/35">All-time paid support</p>
          <div className="mt-4 space-y-2">
            {(topSupporters ?? []).map((supporter, index) => (
              <div key={supporter.donor_name} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-xs font-semibold text-white/45">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{supporter.donor_name}</p>
                  <p className="text-xs text-white/30">{Number(supporter.donation_count).toLocaleString()} donations</p>
                </div>
                <span className="text-sm font-semibold text-brand-300">
                  {formatCents(Number(supporter.total_cents), settings.currency)}
                </span>
              </div>
            ))}
            {(topSupporters ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-white/35">
                Your top supporters will show here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
