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
const presenceKeys = new Map<string, string>();

/** This page's presence key on a creator's topic (stable for the page's life). */
export function getPresenceKey(overlayToken: string) {
  const topic = overlayTopic(overlayToken);
  let key = presenceKeys.get(topic);
  if (!key) {
    key = crypto.randomUUID();
    presenceKeys.set(topic, key);
  }
  return key;
}

export function getOverlayChannel(overlayToken: string) {
  return createClient().channel(overlayTopic(overlayToken), {
    config: {
      // self: the browser LIVE connector broadcasts from inside an overlay
      // page, and that same page (e.g. Stream Kit) must receive its own
      // chat/gift events too.
      broadcast: { self: true },
      presence: { key: getPresenceKey(overlayToken), enabled: true },
    },
  });
}

export type OverlayKind = 'stream-kit' | 'alerts' | 'gifts' | 'chat' | 'goal' | 'soundboard' | 'viewers';
export type AudioState = 'running' | 'suspended' | 'unsupported';

export type ConnectorPresenceState =
  | 'standby'
  | 'idle'
  | 'connecting'
  | 'live'
  | 'offline'
  | 'error'
  | 'worker'
  | 'unconfigured';

export type OverlayPresence = {
  kind: OverlayKind;
  audio: AudioState;
  host: 'obs' | 'other';
  /** When this overlay page joined; the oldest open overlay runs the connector. */
  since: number;
  connector: ConnectorPresenceState;
  detail?: string;
};

/** Flattens Realtime presence state into overlay entries with their keys. */
export function readOverlayPresence(state: Record<string, unknown[]>): (OverlayPresence & { key: string })[] {
  const out: (OverlayPresence & { key: string })[] = [];
  for (const [key, metas] of Object.entries(state)) {
    for (const meta of metas as Partial<OverlayPresence>[]) {
      if (meta && typeof meta.since === 'number' && meta.kind) out.push({ ...(meta as OverlayPresence), key });
    }
  }
  return out;
}

export const OVERLAY_LABEL: Record<OverlayKind, string> = {
  'stream-kit': 'Stream Kit (all-in-one)',
  alerts: 'Donation alerts',
  gifts: 'TikTok gifts',
  chat: 'Chat & TTS',
  goal: 'Goal bar',
  soundboard: 'Soundboard',
  viewers: 'Viewer count',
};
