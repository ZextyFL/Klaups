import { getOverlayContext } from '@/lib/get-overlay-context';
import { GoalBar } from './goal-bar';

export default async function GoalOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { settings, goal } = await getOverlayContext(searchParams.token);

  return (
    <div className="flex min-h-screen items-start justify-start p-6">
      <GoalBar
        overlayToken={settings.overlay_token}
        initial={{
          currentAmountCents: goal?.current_amount_cents ?? 0,
          targetAmountCents: goal?.target_amount_cents ?? 0,
          currency: goal?.currency ?? settings.currency,
        }}
      />
    </div>
  );
}
