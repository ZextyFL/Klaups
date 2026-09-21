'use client';

import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { playSoundUrl } from '@/lib/play-sound';

export function SoundboardOverlay({ overlayToken }: { overlayToken: string }) {
  useOverlayChannel(overlayToken, ['soundboard'], (event, payload) => {
    if (event !== 'soundboard') return;
    const sound = payload as { soundUrl?: string };
    playSoundUrl(sound.soundUrl);
  });

  return null;
}
