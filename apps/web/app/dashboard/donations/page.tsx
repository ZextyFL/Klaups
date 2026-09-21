import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/PageHeader';

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export default async function DonationsPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const [{ data: totalRows }, { data: todayRows }, { data: monthRows }, { data: recentDonations }] =
    await Promise.all([
      supabase
        .from('donations')
        .select('amount_cents')
        .eq('profile_id', user.id)
        .eq('status', 'paid'),
      supabase
        .from('donations')
        .select('amount_cents')
        .eq('profile_id', user.id)
        .eq('status', 'paid')
        .gte('created_at', startOfToday()),
      supabase
        .from('donations')
        .select('amount_cents')
        .eq('profile_id', user.id)
        .eq('status', 'paid')
        .gte('created_at', startOfMonth()),
      supabase
        .from('donations')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  const sum = (rows: { amount_cents: number }[] | null) =>
    (rows ?? []).reduce((total, row) => total + row.amount_cents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donations"
        description="Track incoming support, donor messages and payment status."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card rounded-3xl p-5">
          <p className="text-sm text-white/45">Today</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCents(sum(todayRows), settings.currency)}
          </p>
          <p className="mt-1 text-xs text-white/35">{todayRows?.length ?? 0} paid donations</p>
        </div>
        <div className="card rounded-3xl p-5">
          <p className="text-sm text-white/45">This month</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCents(sum(monthRows), settings.currency)}
          </p>
          <p className="mt-1 text-xs text-white/35">{monthRows?.length ?? 0} paid donations</p>
        </div>
        <div className="card rounded-3xl p-5">
          <p className="text-sm text-white/45">All time</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-brand-400">
            {formatCents(sum(totalRows), settings.currency)}
          </p>
          <p className="mt-1 text-xs text-white/35">{totalRows?.length ?? 0} paid donations</p>
        </div>
      </div>

      <div className="card overflow-hidden rounded-3xl p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="font-semibold">Donation activity</h2>
            <p className="mt-0.5 text-xs text-white/35">Newest first</p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {(recentDonations ?? []).map((donation) => (
            <div
              key={donation.id}
              className="grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_2fr_auto_auto] md:items-center"
            >
              <div>
                <p className="font-medium">{donation.donor_name}</p>
                <p className="text-xs text-white/35">
                  {new Date(donation.created_at).toLocaleString()}
                </p>
              </div>
              <p className="truncate text-sm text-white/55">
                {donation.message || 'No message'}
              </p>
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
              <p className="font-semibold tabular-nums">
                {formatCents(donation.amount_cents, donation.currency)}
              </p>
            </div>
          ))}

          {(recentDonations ?? []).length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="font-medium">No donations yet</p>
              <p className="mt-1 text-sm text-white/40">
                Share your Klaups donation link to receive your first donation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
