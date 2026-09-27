import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminUserId } from '@/lib/require-admin';

export const runtime = 'nodejs';

// Allowed moves. Rejecting returns the money to the creator's available
// balance automatically, because the ledger ignores rejected payouts.
const TRANSITIONS: Record<string, string[]> = {
  processing: ['requested'],
  paid: ['requested', 'processing'],
  rejected: ['requested', 'processing'],
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await getAdminUserId())) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  const from = TRANSITIONS[action];
  if (!from) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: action };
  if (action === 'processing') patch.processed_at = now;
  if (action === 'paid') {
    patch.paid_at = now;
    patch.bank_reference = String(body?.bankReference ?? '').trim().slice(0, 80) || null;
  }
  if (action === 'rejected') {
    const reason = String(body?.reason ?? '').trim().slice(0, 200);
    if (!reason) return NextResponse.json({ error: 'Give the creator a reason.' }, { status: 400 });
    patch.failure_reason = reason;
  }

  // Conditional on the current status, so two admins clicking at once can't
  // mark the same payout twice.
  const { data, error } = await createAdminClient()
    .from('payouts')
    .update(patch)
    .eq('id', params.id)
    .in('status', from)
    .select('id, status')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'This payout already moved on — refresh.' }, { status: 409 });
  return NextResponse.json({ ok: true, status: data.status });
}
