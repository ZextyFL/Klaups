import { getOverlayContext } from '@/lib/get-overlay-context';
import { AlertPopup } from './alert-popup';

export default async function AlertsOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);

  return <AlertPopup overlayToken={settings.overlay_token} />;
}
