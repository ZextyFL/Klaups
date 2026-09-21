import { getOverlayContext } from '@/lib/get-overlay-context';
import { AlertPopup } from '../alerts/alert-popup';
import { TikTokGiftOverlay } from '../tiktok-gifts/tiktok-gift-overlay';
import { SoundboardOverlay } from '../soundboard/soundboard-overlay';
import { GoalBar } from '../goal/goal-bar';

export default async function StreamKitOverlayPage({
  searchParams,
}: {
  searchParams: { token?: string; goal?: string };
}) {
  const { settings, goal } = await getOverlayContext(searchParams.token);
  const showGoal = searchParams.goal !== '0';

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-transparent">
      {showGoal && (
        <div className="pointer-events-none absolute left-5 top-5 z-10">
          <GoalBar
            overlayToken={settings.overlay_token}
            initial={{
              currentAmountCents: goal?.current_amount_cents ?? 0,
              targetAmountCents: goal?.target_amount_cents ?? 0,
              currency: goal?.currency ?? settings.currency,
            }}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-30">
        <AlertPopup
          overlayToken={settings.overlay_token}
          voiceName={settings.tts_enabled ? settings.tts_voice : null}
          language={settings.tts_language}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <TikTokGiftOverlay overlayToken={settings.overlay_token} />
      </div>

      <SoundboardOverlay overlayToken={settings.overlay_token} />
    </div>
  );
}
