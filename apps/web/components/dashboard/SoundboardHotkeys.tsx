'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  comboFromEvent,
  isModifierOnly,
  isTypingTarget,
  KEYBIND_RECORDING_EVENT,
  SOUNDBOARD_CHANGED_EVENT,
} from '@/lib/keybind';
import { useSoundboardPlayer, type PlayableSound } from '@/lib/soundboard-client';

type HotkeySound = PlayableSound & { keybind: string | null; enabled: boolean };

/**
 * Soundboard hotkeys for the whole dashboard, not just the soundboard page.
 *
 * Browsers only deliver keypresses to the focused tab, so this works while a
 * Klaups dashboard tab is focused. System-wide hotkeys (while in a game) need
 * a desktop app, which a website can't provide.
 */
export function SoundboardHotkeys({
  profileId,
  overlayToken,
}: {
  profileId: string;
  overlayToken: string;
}) {
  const { play } = useSoundboardPlayer(overlayToken);
  const sounds = useRef<HotkeySound[]>([]);
  const recording = useRef(false);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from('soundboard_sounds')
      .select('id, name, sound_url, keybind, enabled, volume')
      .eq('profile_id', profileId);
    sounds.current = (data ?? []) as HotkeySound[];
  }, [profileId]);

  useEffect(() => {
    void load();
    const onChanged = () => void load();
    const onRecording = (event: Event) => {
      recording.current = Boolean((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener(SOUNDBOARD_CHANGED_EVENT, onChanged);
    window.addEventListener(KEYBIND_RECORDING_EVENT, onRecording);
    return () => {
      window.removeEventListener(SOUNDBOARD_CHANGED_EVENT, onChanged);
      window.removeEventListener(KEYBIND_RECORDING_EVENT, onRecording);
    };
  }, [load]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The recorder owns the keyboard while it is capturing a new binding.
      if (recording.current) return;
      // Holding a key auto-repeats keydown; one press = one sound.
      if (event.repeat) return;
      if (isModifierOnly(event)) return;
      if (isTypingTarget(event.target)) return;

      const combo = comboFromEvent(event);
      const sound = sounds.current.find((item) => item.enabled && item.keybind === combo);
      if (!sound) return;

      event.preventDefault();
      // A select keeps focus after you pick from it; blur it so arrow keys
      // don't also change the dropdown value while the sound plays.
      if ((event.target as HTMLElement | null)?.tagName === 'SELECT') {
        (event.target as HTMLElement).blur();
      }
      void play(sound).catch((err) => console.error('soundboard hotkey failed', err));
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [play]);

  return null;
}
