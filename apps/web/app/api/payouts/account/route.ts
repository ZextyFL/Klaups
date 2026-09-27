import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateHolderName, validateIban } from '@/lib/iban';

export const runtime = 'nodejs';

// How recently the email code must have been entered. Short on purpose: a
// stolen browser session must not be enough to redirect someone's payouts.
const FRESH_OTP_SECONDS = 15 * 60;

/**
 * Save (or replace) the creator's payout IBAN.
 *
 * Requires proof of email control *now*, not just a valid login: the session
 * must carry an `otp` authentication entry from the last 15 minutes, which
 * only exists after the creator typed the code (or clicked the link) we just
 * emailed them. getClaims() verifies the JWT signature, so the amr entry
 * can't be forged client-side.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  const freshOtp = amr.some(
    (entry) =>
      typeof entry === 'object' &&
      ['otp', 'magiclink'].includes(String(entry.method)) &&
      now - Number(entry.timestamp) <= FRESH_OTP_SECONDS
  );
  if (!freshOtp) {
    return NextResponse.json(
      { error: 'Please confirm the code we emailed you first.', code: 'email_verification_required' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const iban = validateIban(String(body?.iban ?? ''));
  if (!iban.ok) return NextResponse.json({ error: iban.error }, { status: 400 });
  const holder = validateHolderName(String(body?.accountHolderName ?? ''));
  if (!holder.ok) return NextResponse.json({ error: holder.error }, { status: 400 });

  const email = typeof claims.email === 'string' ? claims.email : '';
  const timestamp = new Date().toISOString();

  const { error } = await createAdminClient()
    .from('payout_accounts')
    .upsert(
      {
        profile_id: claims.sub,
        account_holder_name: holder.name,
        iban: iban.iban,
        iban_last4: iban.last4,
        iban_country: iban.country,
        verified_email: email,
        verified_at: timestamp,
        updated_at: timestamp,
      },
      { onConflict: 'profile_id' }
    );

  if (error) {
    console.error('payout account save failed', error);
    return NextResponse.json({ error: 'Could not save your bank details. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, last4: iban.last4, country: iban.country });
}
