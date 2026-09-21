import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

// Looks up a creator by their overlay_token (a secret, unguessable UUID
// embedded in the OBS browser source URL). This is intentionally the only
// way overlays authenticate — no login, so OBS can load them directly.
export async function getOverlayContext(token: string | undefined) {
  if (!token) notFound();

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from('creator_settings')
    .select('*')
    .eq('overlay_token', token)
    .single();

  if (!settings) notFound();

  const { data: goal } = await supabase.rpc('get_or_create_today_goal', {
    p_profile_id: settings.profile_id,
  });

  return { settings, goal };
}
