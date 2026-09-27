import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Returns the signed-in user's id if they are a Klaups payout admin, else
 * null. Membership lives in public.platform_admins, which no client role can
 * read or write, so this can't be self-granted from the browser.
 */
export async function getAdminUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: row } = await createAdminClient()
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return row ? userId : null;
}

/** Short, human-readable reference to put on the SEPA transfer. */
export function payoutReference(payoutId: string) {
  return `KLAUPS-${payoutId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
