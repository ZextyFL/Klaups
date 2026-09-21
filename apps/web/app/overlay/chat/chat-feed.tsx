'use client';

import { useRef, useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { useSpeechVoice } from '@/lib/use-speech-voice';

interface ChatMessagePayload {
  username: string;
  message: string;
  type: 'chat' | 'gift' | 'song_request';
}

interface Line extends ChatMessagePayload {
  id: number;
}

const MAX_LINES = 8;

export function ChatFeed({
  overlayToken,
  voiceName,
  side = 'left',
}: {
  overlayToken: string;
  voiceName?: string | null;
  side?: 'left' | 'right';
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const counter = useRef(0);
  const speechQueue = useRef<string[]>([]);
  const speaking = useRef(false);
  const voiceRef = useSpeechVoice(voiceName);

  function enqueueSpeech(text: string) {
    if (!('speechSynthesis' in window)) return;
    speechQueue.current.push(text);
    if (!speaking.current) drainSpeechQueue();
  }

  function drainSpeechQueue() {
    const next = speechQueue.current.shift();
    if (!next) {
      speaking.current = false;
      return;
    }
    speaking.current = true;
    const utterance = new SpeechSynthesisUtterance(next);
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.onend = drainSpeechQueue;
    utterance.onerror = drainSpeechQueue;
    window.speechSynthesis.speak(utterance);
  }

  useOverlayChannel(overlayToken, ['chat_message'], (event, payload) => {
    if (event !== 'chat_message') return;
    const data = payload as ChatMessagePayload;
    counter.current += 1;
    setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), { ...data, id: counter.current }]);
    enqueueSpeech(`${data.username} says ${data.message}`);
  });

  const isRight = side === 'right';

  return (
    <div
      className={`flex min-h-screen w-full flex-col justify-end gap-2 p-6 ${
        isRight ? 'items-end' : 'items-start'
      }`}
    >
      {lines.map((line) => (
        <div
          key={line.id}
          className={`w-fit max-w-xs rounded-xl bg-black/60 px-4 py-2 text-white shadow ${
            isRight ? 'text-right' : ''
          }`}
        >
          <span className="font-semibold text-brand-400">{line.username}: </span>
          <span>{line.message}</span>
        </div>
      ))}
    </div>
  );
}
