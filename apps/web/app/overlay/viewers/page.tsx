import { getOverlayContext } from '@/lib/get-overlay-context';
import { ViewerCount } from './viewer-count';

export default async function ViewersOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { settings } = await getOverlayContext(searchParams.token);

  return (
    <div className="flex min-h-screen items-start justify-start p-6">
      <ViewerCount overlayToken={settings.overlay_token} initial={settings.tiktok_viewer_count} />
    </div>
  );
}
