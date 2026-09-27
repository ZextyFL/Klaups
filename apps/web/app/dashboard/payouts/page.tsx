import { Suspense } from 'react';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PayoutAccountCard } from './payout-account-card';
import { PayoutRequestCard, type OpenPayout } from './payout-request-card';

const STATUS: Record<string, { label: string; className: string }> = {
  requested: { label: 'Requested', className: 'bg-amber-500/10 text-amber-300' },
  processing: { label: 'Being sent', className: 'bg-cyan-500/10 text-cyan-200' },
  paid: { label: 'Paid', className: 'bg-green-500/10 text-green-300' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-300' },
  cancelled: { label: 'Cancelled', className: 'bg-white/[0.06] text-white/40' },
  in_transit: { label: 'In transit', className: 'bg-cyan-500/10 text-cyan-200' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-300' },
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-300' },
  transferred: { label: 'Transferred', className: 'bg-cyan-500/10 text-cyan-200' },
};

export default async function PayoutsPage() {
  const { balance, payoutAccount, supabase, user, settings } = await getCurrentCreator();
  const currency = balance?.currency ?? settings.currency;

  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, amount_cents, currency, status, requested_at, expected_by, processed_at, paid_at, bank_reference, failure_reason, iban_last4, created_at')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(25);

  const open = (payouts ?? []).find((p) => p.status === 'requested' || p.status === 'processing') as
    | OpenPayout
    | undefined;
  const holdDays = balance?.hold_days ?? 7;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="Your donations, straight to your bank. Add your IBAN once, request a payout whenever you like."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Available', balance?.available_cents ?? 0, 'Ready to cash out', 'text-brand-300'],
          [
            'On hold',
            balance?.pending_cents ?? 0,
            balance?.next_available_at
              ? `Next release ${new Date(balance.next_available_at).toLocaleDateString()}`
              : `${holdDays}-day safety hold`,
            '',
          ],
          ['On its way', balance?.requested_cents ?? 0, 'Requested payouts', ''],
          ['Paid out', balance?.paid_out_cents ?? 0, 'All time', ''],
        ].map(([label, cents, hint, tone]) => (
          <div key={String(label)} className="card rounded-3xl p-5">
            <p className="text-sm text-white/45">{String(label)}</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${tone}`}>
              {formatCents(Number(cents), currency)}
            </p>
            <p className="mt-1 text-xs text-white/35">{String(hint)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Suspense fallback={<div className="card h-64 animate-pulse rounded-3xl" />}>
          <PayoutAccountCard email={user.email ?? ''} account={payoutAccount} />
        </Suspense>
        <PayoutRequestCard
          availableCents={balance?.available_cents ?? 0}
          minPayoutCents={balance?.min_payout_cents ?? 1000}
          currency={currency}
          hasAccount={Boolean(payoutAccount)}
          open={open ?? null}
        />
      </div>

      <div className="card rounded-3xl">
        <p className="eyebrow">How payouts work</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ['1', 'Donation received', `Each donation is held ${holdDays} days to protect against chargebacks.`],
            ['2', 'Becomes available', 'After the hold it moves to your available balance automatically.'],
            ['3', 'You request a payout', `Any amount from ${formatCents(balance?.min_payout_cents ?? 1000, currency)}, one request at a time.`],
            ['4', 'We send it', 'Sent by SEPA within 4 days; banks usually credit it in 1–2 business days.'],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/15 text-xs font-semibold text-brand-300">
                {n}
              </span>
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-5 text-white/40">{text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="card rounded-3xl">
        <h2 className="font-semibold">Payout history</h2>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {(payouts ?? []).length === 0 && <p className="py-6 text-sm text-white/40">No payouts yet.</p>}
          {(payouts ?? []).map((p) => {
            const status = STATUS[p.status] ?? { label: p.status, className: 'bg-white/[0.06] text-white/50' };
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{new Date(p.requested_at ?? p.created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-white/35">
                    {p.iban_last4 ? `To •••• ${p.iban_last4}` : 'Stripe payout'}
                    {p.status === 'paid' && p.paid_at && ` · paid ${new Date(p.paid_at).toLocaleDateString()}`}
                    {p.bank_reference && ` · ref ${p.bank_reference}`}
                    {p.status === 'rejected' && p.failure_reason && ` · ${p.failure_reason}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  <p className="font-semibold tabular-nums">{formatCents(p.amount_cents, p.currency)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
