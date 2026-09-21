import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface ActiveCreator {
  profile_id: string;
  overlay_token: string;
  tiktok_username: string;
  tts_enabled: boolean;
  song_request_enabled: boolean;
  song_request_command: string;
}

export async function fetchActiveCreators(): Promise<ActiveCreator[]> {
  const { data, error } = await supabase
    .from('creator_settings')
    .select(
      'profile_id, overlay_token, tiktok_username, tts_enabled, song_request_enabled, song_request_command'
    )
    .eq('tiktok_worker_enabled', true)
    .not('tiktok_username', 'is', null);

  if (error) {
    console.error('fetchActiveCreators failed', error);
    return [];
  }

  return (data ?? []) as ActiveCreator[];
}
