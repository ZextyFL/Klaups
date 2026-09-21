import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client. NEVER import this from client components or expose the
// key to the browser — it bypasses Row Level Security. Only used by webhooks,
// OAuth callbacks, and the scheduled payout function.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
