import { createAdminClient } from '@/lib/supabase/admin';

// Server-side port of the worker's Spotify queueing, used when the LIVE
// connection runs in the browser overlay and a chat message is a song request.

async function getValidAccessToken(profileId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('spotify_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 60_000) return data.access_token;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }),
  });
  if (!res.ok) return null;

  const refreshed = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
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

export type QueueResult = {
  status: 'queued' | 'failed' | 'no_match';
  trackUri?: string;
  trackName?: string;
  artistName?: string;
};

export async function queueSongRequest(profileId: string, query: string): Promise<QueueResult> {
  const token = await getValidAccessToken(profileId);
  if (!token) return { status: 'failed' };

  const search = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!search.ok) return { status: 'failed' };

  const data = (await search.json()) as {
    tracks?: { items?: { uri: string; name: string; artists: { name: string }[] }[] };
  };
  const track = data.tracks?.items?.[0];
  if (!track) return { status: 'no_match' };

  const queued = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(track.uri)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = { trackUri: track.uri, trackName: track.name, artistName: track.artists[0]?.name };
  return queued.ok || queued.status === 204 ? { status: 'queued', ...result } : { status: 'failed', ...result };
}
