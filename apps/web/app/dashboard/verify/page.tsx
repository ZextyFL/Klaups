import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { PageHeader } from '@/components/dashboard/PageHeader';

export default async function VerifyAccountPage() {
  const { settings } = await getCurrentCreator();

  const hasAccount = Boolean(settings.stripe_connect_account_id);
  const onboardingComplete = settings.stripe_connect_onboarded;
  const payoutsEnabled = settings.stripe_payouts_enabled;
  const verified = onboardingComplete && payoutsEnabled;

  const status = verified
    ? 'Verified'
    : hasAccount && onboardingComplete
      ? 'In review'
      : hasAccount
        ? 'Verification incomplete'
        : 'Not verified';

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Verify account"
        description="Complete payout verification through Stripe Connect so Klaups can pay your balance to your bank."
      />

      <div className="card overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl ${
                verified
                  ? 'bg-green-500/10 text-green-300'
                  : 'bg-amber-500/10 text-amber-300'
              }`}
            >
              {verified ? '✓' : '!'}
            </div>
            <div>
              <p className="text-sm text-white/45">Account status</p>
              <h2 className="mt-1 text-2xl font-semibold">{status}</h2>
            </div>
          </div>

          {!verified && (
            <form action="/api/stripe/connect/onboard" method="POST">
              <button className="btn-accent" type="submit">
                {hasAccount ? 'Continue verification' : 'Verify with Stripe'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Identity', onboardingComplete, 'Confirm your personal or business identity.'],
          ['Payout account', hasAccount, 'Connect the bank account that receives payouts.'],
          ['Payouts enabled', payoutsEnabled, 'Stripe must approve the account for payouts.'],
        ].map(([label, done, text]) => (
          <div key={String(label)} className="card rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{String(label)}</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${
                  done ? 'bg-green-500/10 text-green-300' : 'bg-white/[0.06] text-white/40'
                }`}
              >
                {done ? 'Done' : 'Pending'}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/45">{String(text)}</p>
          </div>
        ))}
      </div>

      <div className="card rounded-3xl">
        <h2 className="font-semibold">Why Klaups asks for verification</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
          Stripe handles identity and bank verification for payouts. Klaups stores the resulting
          payout status, not your verification documents.
        </p>
        <Link href="/dashboard/payouts" className="btn-ghost mt-4">
          View payouts →
        </Link>
      </div>
    </div>
  );
}
