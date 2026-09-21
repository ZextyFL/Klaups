import { getOverlayContext } from '@/lib/get-overlay-context';
import { SoundboardOverlay } from './soundboard-overlay';

export default async function SoundboardOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);
  return <SoundboardOverlay overlayToken={settings.overlay_token} />;
}
