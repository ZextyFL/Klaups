'use client';

import { useEffect, useRef } from 'react';

// Resolves a stored voice name (from creator_settings.tts_voice) to a live
// SpeechSynthesisVoice in *this* browser once the voice list has loaded.
// Falls back to the browser default when the name is unset/not found.
export function useSpeechVoice(voiceName: string | null | undefined) {
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!voiceName || voiceName === 'default') return;

    function resolve() {
      const match = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
      if (match) voiceRef.current = match;
    }

    resolve();
    window.speechSynthesis.onvoiceschanged = resolve;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceName]);

  return voiceRef;
}
