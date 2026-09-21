import { getOverlayContext } from '@/lib/get-overlay-context';
import { TikTokGiftOverlay } from './tiktok-gift-overlay';

export default async function TikTokGiftOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);
  return <TikTokGiftOverlay overlayToken={settings.overlay_token} />;
}
