'use client';

import { useState } from 'react';

export function TestSendButton({
  endpoint,
  body,
  label = 'Send test',
  className = 'btn-secondary text-sm',
}: {
  endpoint: '/api/test/donation' | '/api/test/chat' | '/api/test/tiktok-gift';
  body?: Record<string, unknown>;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send() {
    setState('sending');
    setError('');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok || data?.error) {
        setError(data?.error ?? `Request failed (${res.status})`);
        setState('error');
      } else {
        setState('sent');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Network request failed');
      setState('error');
    }

    setTimeout(() => {
      setState('idle');
      setError('');
    }, 3000);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={send}
      disabled={state === 'sending'}
      title={error || undefined}
    >
      {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent ✓' : state === 'error' ? 'Failed' : label}
    </button>
  );
}
