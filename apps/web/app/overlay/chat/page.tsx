import { getOverlayContext } from '@/lib/get-overlay-context';
import { ChatFeed } from './chat-feed';

export default async function ChatOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);

  return <ChatFeed overlayToken={settings.overlay_token} />;
}
