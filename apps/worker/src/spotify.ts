import { supabase } from './supabase.js';

interface SpotifyTokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function getValidAccessToken(profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('spotify_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('profile_id', profileId)
    .maybeSingle<SpotifyTokenRow>();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return data.access_token;
  }

  // Refresh.
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString(
          'base64'
        ),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    }),
  });

  if (!res.ok) {
    console.error(`Spotify token refresh failed for ${profileId}`, await res.text());
    return null;
  }

  const refreshed = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  await supabase
    .from('spotify_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? data.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId);

  return refreshed.access_token;
}

export interface QueueResult {
  status: 'queued' | 'failed' | 'no_match';
  trackUri?: string;
  trackName?: string;
  artistName?: string;
}

// Searches the creator's Spotify for `query` and queues the first match on
// their active device. Requires the creator to have Spotify open with an
// active playback device — the Web API can't start playback on a device
// that hasn't been used recently.
export async function queueSongRequest(profileId: string, query: string): Promise<QueueResult> {
  const token = await getValidAccessToken(profileId);
  if (!token) return { status: 'failed' };

  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!searchRes.ok) return { status: 'failed' };

  const searchData = (await searchRes.json()) as {
    tracks?: { items?: { uri: string; name: string; artists: { name: string }[] }[] };
  };
  const track = searchData.tracks?.items?.[0];
  if (!track) return { status: 'no_match' };

  const queueRes = await fetch(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(track.uri)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  );

  if (!queueRes.ok && queueRes.status !== 204) {
    return {
      status: 'failed',
      trackUri: track.uri,
      trackName: track.name,
      artistName: track.artists[0]?.name,
    };
  }

  return {
    status: 'queued',
    trackUri: track.uri,
    trackName: track.name,
    artistName: track.artists[0]?.name,
  };
}
