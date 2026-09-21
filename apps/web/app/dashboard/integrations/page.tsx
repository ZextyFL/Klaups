import { getCurrentCreator } from '@/lib/get-current-creator';
import { IntegrationsForm } from './integrations-form';
import { CopyField } from '../copy-field';
import { siteUrl } from '@/lib/site-url';


export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { spotify?: string };
}) {
  const { settings, supabase, user } = await getCurrentCreator();

  const { data: spotify } = await supabase
    .from('spotify_tokens')
    .select('spotify_user_id, updated_at')
    .eq('profile_id', user.id)
    .maybeSingle();

  const chatOverlayUrl = `${siteUrl()}/overlay/chat?token=${settings.overlay_token}`;
  const chatOverlayUrlRight = `${chatOverlayUrl}&side=right`;
  const viewerOverlayUrl = `${siteUrl()}/overlay/viewers?token=${settings.overlay_token}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">TikTok &amp; Spotify</h1>
        <p className="mt-1 text-white/60">
          Connect your live chat for TTS and song requests, and your Spotify to play them.
        </p>
      </div>

      {searchParams.spotify === 'connected' && (
        <p className="rounded-lg bg-green-500/10 p-3 text-sm text-green-400">Spotify connected.</p>
      )}
      {searchParams.spotify === 'error' && (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          Couldn&apos;t connect Spotify. Please try again.
        </p>
      )}

      <div className="card space-y-4">
        <CopyField label="OBS chat / TTS browser source URL" value={chatOverlayUrl} />
        <CopyField label="Same, docked on the right side" value={chatOverlayUrlRight} />
        <CopyField label="Live viewer count overlay" value={viewerOverlayUrl} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Spotify</h2>
        {spotify ? (
          <>
            <p className="text-sm text-green-400">✓ Connected as {spotify.spotify_user_id}</p>
            <form action="/api/spotify/disconnect" method="POST">
              <button className="btn-secondary text-sm" type="submit">
                Disconnect
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-white/60">
              Connect Spotify so viewer song requests get queued on your account. Spotify must be
              open with an active device while you&apos;re live.
            </p>
            <a href="/api/spotify/connect" className="btn-primary inline-flex text-sm">
              Connect Spotify
            </a>
          </>
        )}
      </div>

      <IntegrationsForm settings={settings} />

      <div className="card">
        <h2 className="font-semibold">How live chat reading works</h2>
        <p className="mt-2 text-sm text-white/60">
          TikTok LIVE has no public API for third-party TTS bots, so Klaups runs a small always-on
          worker (deployed separately from this website — see the README) that connects to your
          TikTok LIVE room while you&apos;re live, and forwards chat, gifts and song-request
          commands here in real time.
        </p>
      </div>
    </div>
  );
}
