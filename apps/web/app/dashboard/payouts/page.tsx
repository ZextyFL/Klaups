import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/PageHeader';

export default async function PayoutsPage() {
  const { settings, balance, supabase, user } = await getCurrentCreator();

  const { data: payouts } = await supabase
    .from('payouts')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Payouts"
        description={`We collect your donations and pay you out to your bank via Stripe every ${settings.payout_interval_days} days.`}
      />

      <div className="card">
        <p className="text-sm text-white/50">Available balance</p>
        <p className="mt-2 text-3xl font-bold">
          {formatCents(balance?.available_cents ?? 0, settings.currency)}
        </p>

        {!settings.stripe_connect_account_id && (
          <form action="/api/stripe/connect/onboard" method="POST" className="mt-4">
            <button className="btn-primary" type="submit">
              Set up payouts with Stripe
            </button>
          </form>
        )}

        {settings.stripe_connect_account_id && !settings.stripe_connect_onboarded && (
          <div className="mt-4">
            <p className="text-sm text-yellow-400">
              Your Stripe account is created but onboarding isn&apos;t finished yet.
            </p>
            <form action="/api/stripe/connect/onboard" method="POST" className="mt-2">
              <button className="btn-secondary" type="submit">
                Finish onboarding
              </button>
            </form>
          </div>
        )}

        {settings.stripe_connect_onboarded && (
          <p className="mt-4 text-sm text-green-400">
            ✓ Payouts enabled — next run will include your available balance.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold">Payout history</h2>
        <div className="mt-4 divide-y divide-white/10">
          {(payouts ?? []).length === 0 && (
            <p className="py-4 text-sm text-white/50">No payouts yet.</p>
          )}
          {(payouts ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{new Date(p.created_at).toLocaleDateString()}</p>
                <p className="text-white/40 capitalize">{p.status}</p>
              </div>
              <p className="font-semibold text-brand-400">{formatCents(p.amount_cents, p.currency)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
