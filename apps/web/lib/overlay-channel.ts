'use client';

import { createClient } from '@/lib/supabase/client';
import { overlayTopic } from '@/lib/realtime';

/**
 * The one way to open a creator's overlay topic in the browser.
 *
 * Realtime hands back the existing channel for a topic, so whichever caller
 * opens it first decides its config. Every caller must therefore ask for the
 * same config — in particular presence, which has to be enabled at join time
 * for the dashboard to see which overlays are connected.
 */
export function getOverlayChannel(overlayToken: string) {
  return createClient().channel(overlayTopic(overlayToken), {
    config: {
      broadcast: { self: false },
      presence: { key: crypto.randomUUID(), enabled: true },
    },
  });
}

export type OverlayKind = 'stream-kit' | 'alerts' | 'gifts' | 'chat' | 'goal' | 'soundboard' | 'viewers';
export type AudioState = 'running' | 'suspended' | 'unsupported';

export type OverlayPresence = {
  kind: OverlayKind;
  audio: AudioState;
  host: 'obs' | 'other';
  at: number;
};

export const OVERLAY_LABEL: Record<OverlayKind, string> = {
  'stream-kit': 'Stream Kit (all-in-one)',
  alerts: 'Donation alerts',
  gifts: 'TikTok gifts',
  chat: 'Chat & TTS',
  goal: 'Goal bar',
  soundboard: 'Soundboard',
  viewers: 'Viewer count',
};
