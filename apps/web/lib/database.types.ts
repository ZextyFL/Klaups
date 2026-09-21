// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked.

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorSettings {
  profile_id: string;
  donation_slug: string;
  overlay_token: string;
  currency: string;
  default_daily_goal_cents: number;
  min_tts_amount_cents: number;
  tts_enabled: boolean;
  tts_voice: string | null;
  song_request_enabled: boolean;
  song_request_command: string;
  tiktok_username: string | null;
  tiktok_worker_enabled: boolean;
  tiktok_status: 'disconnected' | 'connecting' | 'live' | 'offline' | 'error';
  tiktok_status_message: string | null;
  tiktok_viewer_count: number;
  tiktok_display_name: string | null;
  tiktok_avatar_url: string | null;
  tiktok_last_seen_at: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  stripe_payouts_enabled: boolean;
  payout_interval_days: number;
  created_at: string;
  updated_at: string;
}

export interface AlertSetting {
  id: string;
  profile_id: string;
  min_amount_cents: number;
  sound_url: string | null;
  image_url: string | null;
  display_seconds: number;
  message_template: string;
  created_at: string;
}

export interface DailyGoal {
  id: string;
  profile_id: string;
  goal_date: string;
  target_amount_cents: number;
  current_amount_cents: number;
  currency: string;
  created_at: string;
}

export interface Donation {
  id: string;
  profile_id: string;
  donor_name: string;
  message: string | null;
  amount_cents: number;
  currency: string;
  application_fee_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  created_at: string;
}

export interface Balance {
  profile_id: string;
  available_cents: number;
  currency: string;
  last_payout_at: string | null;
  updated_at: string;
}

export interface Payout {
  id: string;
  profile_id: string;
  amount_cents: number;
  currency: string;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  status: 'pending' | 'transferred' | 'in_transit' | 'paid' | 'failed';
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface SpotifyTokens {
  profile_id: string;
  access_token: string;
  refresh_token: string;
  scope: string | null;
  expires_at: string;
  spotify_user_id: string | null;
  updated_at: string;
}

export interface SongRequest {
  id: string;
  profile_id: string;
  requested_by: string;
  query: string;
  track_uri: string | null;
  track_name: string | null;
  artist_name: string | null;
  status: 'queued' | 'failed' | 'no_match';
  created_at: string;
}
