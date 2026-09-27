import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminUserId, payoutReference } from '@/lib/require-admin';

export const runtime = 'nodejs';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  // Quote everything and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Open payouts as CSV for a bank bulk-transfer upload (or manual entry).
export async function GET() {
  if (!(await getAdminUserId())) return new Response('Not found', { status: 404 });

  const { data } = await createAdminClient()
    .from('payouts')
    .select('id, amount_cents, currency, account_holder_name, iban, requested_at, status')
    .in('status', ['requested', 'processing'])
    .order('requested_at', { ascending: true });

  const rows = [
    ['Name', 'IBAN', 'Amount', 'Currency', 'Reference', 'Requested', 'Status'],
    ...(data ?? []).map((p) => [
      p.account_holder_name,
      p.iban,
      (p.amount_cents / 100).toFixed(2),
      p.currency.toUpperCase(),
      payoutReference(p.id),
      p.requested_at,
      p.status,
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="klaups-payouts-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
