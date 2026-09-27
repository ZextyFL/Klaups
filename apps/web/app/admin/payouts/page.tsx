import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminUserId, payoutReference } from '@/lib/require-admin';
import { formatIban } from '@/lib/iban';
import { formatCents } from '@/lib/format';
import { PayoutActions } from './payout-actions';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  // Not a 403: non-admins shouldn't learn this page exists.
  if (!(await getAdminUserId())) notFound();

  const admin = createAdminClient();
  const [{ data: open }, { data: recent }] = await Promise.all([
    admin
      .from('payouts')
      .select('id, profile_id, amount_cents, currency, status, account_holder_name, iban, requested_at, expected_by, processed_at')
      .in('status', ['requested', 'processing'])
      .order('requested_at', { ascending: true }),
    admin
      .from('payouts')
      .select('id, amount_cents, currency, status, account_holder_name, iban_last4, paid_at, bank_reference, failure_reason, requested_at')
      .in('status', ['paid', 'rejected', 'cancelled'])
      .order('requested_at', { ascending: false })
      .limit(30),
  ]);

  const profileIds = [...new Set((open ?? []).map((p) => p.profile_id))];
  const { data: profiles } = profileIds.length
    ? await admin.from('profiles').select('id, username, display_name').in('id', profileIds)
    : { data: [] as { id: string; username: string; display_name: string | null }[] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p]));

  const totalOpen = (open ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
  const now = Date.now();

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Klaups admin</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Payout queue</h1>
            <p className="mt-2 text-sm text-white/45">
              {(open ?? []).length} open · {formatCents(totalOpen, 'eur')} to send. Promise to creators: sent within 4 days.
            </p>
          </div>
          <a href="/api/admin/payouts/export" className="btn-accent text-sm">
            ⬇ Export CSV for bank
          </a>
        </div>

        <div className="card overflow-hidden rounded-3xl p-0">
          <div className="divide-y divide-white/[0.06]">
            {(open ?? []).length === 0 && <p className="px-6 py-12 text-center text-sm text-white/40">Nothing to pay out. 🎉</p>}
            {(open ?? []).map((p) => {
              const creator = who.get(p.profile_id);
              const overdue = p.expected_by && new Date(p.expected_by).getTime() < now;
              return (
                <div key={p.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1.2fr_1.4fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.account_holder_name}</p>
                    <p className="truncate text-xs text-white/40">
                      @{creator?.username ?? 'unknown'} · requested {new Date(p.requested_at ?? '').toLocaleString()}
                    </p>
                    <p className={`mt-1 text-xs ${overdue ? 'text-red-300' : 'text-white/35'}`}>
                      {overdue ? 'Overdue — ' : 'Due '}
                      {p.expected_by ? new Date(p.expected_by).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="select-all font-mono text-sm">{formatIban(p.iban ?? '')}</p>
                    <p className="text-xs text-white/40">
                      Reference <span className="select-all font-mono text-white/70">{payoutReference(p.id)}</span>
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-brand-300">{formatCents(p.amount_cents, p.currency)}</p>
                  </div>
                  <PayoutActions id={p.id} status={p.status as 'requested' | 'processing'} reference={payoutReference(p.id)} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card rounded-3xl">
          <h2 className="font-semibold">Recently closed</h2>
          <div className="mt-4 divide-y divide-white/[0.06] text-sm">
            {(recent ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-white/70">
                  {p.account_holder_name} · •••• {p.iban_last4}
                </span>
                <span className="text-xs text-white/40">
                  {p.status}
                  {p.bank_reference && ` · ${p.bank_reference}`}
                  {p.failure_reason && ` · ${p.failure_reason}`}
                </span>
                <span className="font-medium tabular-nums">{formatCents(p.amount_cents, p.currency)}</span>
              </div>
            ))}
            {(recent ?? []).length === 0 && <p className="py-4 text-white/40">None yet.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
