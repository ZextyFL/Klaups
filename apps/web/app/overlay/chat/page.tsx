import { OverlayRuntime } from '@/components/overlay/OverlayRuntime';
import { getOverlayContext } from '@/lib/get-overlay-context';
import { ChatFeed } from './chat-feed';

export default async function ChatOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string; side?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);

  return (
    <>
      <ChatFeed
        overlayToken={settings.overlay_token}
        voiceName={settings.tts_voice}
        language={settings.tts_language}
        speak={settings.tts_enabled}
        side={searchParams.side === 'right' ? 'right' : 'left'}
      />
      <OverlayRuntime overlayToken={settings.overlay_token} kind="chat" />
    </>
  );
}
