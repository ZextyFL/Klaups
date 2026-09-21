import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';

export default async function DashboardOverview() {
  const { settings, balance, supabase, user } = await getCurrentCreator();

  const { data: goal } = await supabase.rpc('get_or_create_today_goal', {
    p_profile_id: user.id,
  });

  const { data: recentDonations } = await supabase
    .from('donations')
    .select('*')
    .eq('profile_id', user.id)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(5);

  const donateUrl = `/donate/${settings.donation_slug}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="mt-1 text-white/60">Your live dashboard at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-white/50">Available balance</p>
          <p className="mt-2 text-3xl font-bold">
            {formatCents(balance?.available_cents ?? 0, settings.currency)}
          </p>
          <p className="mt-1 text-xs text-white/40">Paid out every {settings.payout_interval_days} days</p>
        </div>
        <div className="card">
          <p className="text-sm text-white/50">Today&apos;s goal</p>
          <p className="mt-2 text-3xl font-bold">
            {formatCents(goal?.current_amount_cents ?? 0, settings.currency)}
            <span className="text-base font-normal text-white/40">
              {' '}
              / {formatCents(goal?.target_amount_cents ?? 0, settings.currency)}
            </span>
          </p>
          <Link href="/dashboard/goals" className="mt-1 inline-block text-xs text-brand-400">
            Edit goal →
          </Link>
        </div>
        <div className="card">
          <p className="text-sm text-white/50">Your donation link</p>
          <p className="mt-2 truncate text-lg font-semibold text-brand-400">{donateUrl}</p>
          <Link href="/dashboard/donation-link" className="mt-1 inline-block text-xs text-brand-400">
            Customize →
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Recent donations</h2>
        <div className="mt-4 divide-y divide-white/10">
          {(recentDonations ?? []).length === 0 && (
            <p className="py-4 text-sm text-white/50">No donations yet.</p>
          )}
          {(recentDonations ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{d.donor_name}</p>
                {d.message && <p className="text-white/50">{d.message}</p>}
              </div>
              <p className="font-semibold text-brand-400">
                {formatCents(d.amount_cents, d.currency)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
