'use client';

import { useEffect, useRef } from 'react';

// Resolves a stored voice name (from creator_settings.tts_voice) to a live
// SpeechSynthesisVoice in *this* browser once the voice list has loaded.
// If that exact voice isn't installed here (different machine/OS than the
// one used to pick it in the dashboard), falls back to the first voice
// matching the preferred language, then finally the browser default.
export function useSpeechVoice(
  voiceName: string | null | undefined,
  language?: string | null
) {
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    function resolve() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      let match: SpeechSynthesisVoice | undefined;
      if (voiceName && voiceName !== 'default') {
        match = voices.find((v) => v.name === voiceName);
      }
      if (!match && language) {
        match = voices.find((v) => v.lang === language) ?? voices.find((v) => v.lang.startsWith(language.split('-')[0]));
      }
      voiceRef.current = match;
    }

    resolve();
    window.speechSynthesis.onvoiceschanged = resolve;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceName, language]);

  return voiceRef;
}
