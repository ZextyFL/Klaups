'use client';

import { useRef, useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';

interface ChatMessagePayload {
  username: string;
  message: string;
  type: 'chat' | 'gift' | 'song_request';
}

interface Line extends ChatMessagePayload {
  id: number;
}

const MAX_LINES = 8;

export function ChatFeed({ overlayToken }: { overlayToken: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const counter = useRef(0);
  const speechQueue = useRef<string[]>([]);
  const speaking = useRef(false);

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

  return (
    <div className="flex min-h-screen flex-col justify-end gap-2 p-6">
      {lines.map((line) => (
        <div
          key={line.id}
          className="w-fit max-w-xl rounded-xl bg-black/60 px-4 py-2 text-white shadow"
        >
          <span className="font-semibold text-brand-400">{line.username}: </span>
          <span>{line.message}</span>
        </div>
      ))}
    </div>
  );
}
