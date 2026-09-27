'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatCents } from '@/lib/format';

export type OpenPayout = {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'requested' | 'processing';
  requested_at: string | null;
  expected_by: string | null;
  processed_at: string | null;
  iban_last4: string | null;
};

const ERRORS: Record<string, string> = {
  no_payout_account: 'Add and verify your bank account first.',
  open_request_exists: 'You already have a payout on its way.',
  below_minimum: 'The minimum payout is higher than this amount.',
  insufficient_balance: 'That is more than your available balance.',
  not_cancellable: 'This payout is already being processed and can’t be cancelled.',
};

function friendly(message: string) {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : message;
}

export function PayoutRequestCard({
  availableCents,
  minPayoutCents,
  currency,
  hasAccount,
  open,
}: {
  availableCents: number;
  minPayoutCents: number;
  currency: string;
  hasAccount: boolean;
  open: OpenPayout | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState((availableCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(Number(amount.replace(',', '.')) * 100);
  const blocker = !hasAccount
    ? 'Add your bank account to request a payout.'
    : availableCents < minPayoutCents
      ? `You can request a payout from ${formatCents(minPayoutCents, currency)} available.`
      : null;

  async function request() {
    setError(null);
    if (!Number.isFinite(amountCents) || amountCents < minPayoutCents) {
      return setError(`The minimum payout is ${formatCents(minPayoutCents, currency)}.`);
    }
    if (amountCents > availableCents) return setError(ERRORS.insufficient_balance);

    setBusy(true);
    const { error: rpcError } = await createClient().rpc('request_payout', { p_amount_cents: amountCents });
    setBusy(false);
    if (rpcError) return setError(friendly(rpcError.message));
    router.refresh();
  }

  async function cancel() {
    if (!open) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc('cancel_payout', { p_payout_id: open.id });
    setBusy(false);
    if (rpcError) return setError(friendly(rpcError.message));
    router.refresh();
  }

  if (open) {
    const steps = [
      { label: 'Requested', at: open.requested_at, done: true },
      { label: 'Being sent', at: open.processed_at, done: open.status === 'processing' },
      { label: 'In your bank', at: null, done: false },
    ];
    return (
      <div className="card rounded-3xl">
        <p className="eyebrow">Payout on its way</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{formatCents(open.amount_cents, open.currency)}</p>
        <p className="mt-1 text-sm text-white/45">
          To the account ending in {open.iban_last4 ?? '••••'}
          {open.expected_by && <> · expected by {new Date(open.expected_by).toLocaleDateString()}</>}
        </p>

        <ol className="mt-6 grid grid-cols-3 gap-2">
          {steps.map((step, index) => (
            <li key={step.label} className="relative">
              <div className={`h-1.5 rounded-full ${step.done ? 'bg-brand-500' : 'bg-white/[0.08]'}`} />
              <p className={`mt-2 text-xs font-medium ${step.done ? 'text-white' : 'text-white/35'}`}>
                {index + 1}. {step.label}
              </p>
              {step.at && <p className="text-[11px] text-white/30">{new Date(step.at).toLocaleDateString()}</p>}
            </li>
          ))}
        </ol>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {open.status === 'requested' && (
          <button type="button" className="btn-ghost mt-5 text-sm text-red-300" onClick={cancel} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel request'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card rounded-3xl">
      <p className="eyebrow">Request payout</p>
      <h2 className="mt-1 text-lg font-semibold">Cash out your balance</h2>

      {blocker ? (
        <p className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm text-white/50">{blocker}</p>
      ) : (
        <>
          <label className="label mt-5">Amount ({currency.toUpperCase()})</label>
          <div className="flex gap-2">
            <input
              className="input text-lg tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
            />
            <button
              type="button"
              className="btn-secondary shrink-0 text-sm"
              onClick={() => setAmount((availableCents / 100).toFixed(2))}
            >
              Max
            </button>
          </div>
          <p className="mt-2 text-xs text-white/35">
            Available {formatCents(availableCents, currency)} · minimum {formatCents(minPayoutCents, currency)}
          </p>
          {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button type="button" className="btn-accent mt-4 w-full" onClick={request} disabled={busy}>
            {busy ? 'Requesting…' : `Request ${Number.isFinite(amountCents) && amountCents > 0 ? formatCents(amountCents, currency) : 'payout'}`}
          </button>
        </>
      )}
    </div>
  );
}
