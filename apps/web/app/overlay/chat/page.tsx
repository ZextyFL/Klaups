import { getOverlayContext } from '@/lib/get-overlay-context';
import { ChatFeed } from './chat-feed';

export default async function ChatOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string; side?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);

  return (
    <ChatFeed
      overlayToken={settings.overlay_token}
      voiceName={settings.tts_enabled ? settings.tts_voice : null}
      side={searchParams.side === 'right' ? 'right' : 'left'}
    />
  );
}
