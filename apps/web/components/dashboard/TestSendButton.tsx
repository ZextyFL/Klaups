'use client';

import { useState } from 'react';

export function TestSendButton({
  endpoint,
  body,
  label = 'Send test',
  className = 'btn-secondary text-sm',
}: {
  endpoint: '/api/test/donation' | '/api/test/chat';
  body?: Record<string, unknown>;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function send() {
    setState('sending');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button type="button" className={className} onClick={send} disabled={state === 'sending'}>
      {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent ✓' : state === 'error' ? 'Failed' : label}
    </button>
  );
}
