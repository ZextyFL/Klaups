'use client';

import { useState } from 'react';

const PRESETS_CENTS = [500, 1000, 2500, 5000];

export function DonateForm({ slug, currency }: { slug: string; currency: string }) {
  const [amount, setAmount] = useState(1000);
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCents = custom ? Math.round(parseFloat(custom || '0') * 100) : amount;

  async function submit() {
    if (!activeCents || activeCents < 100) {
      setError('Minimum donation is 1.00');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/donate/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          amountCents: activeCents,
          donorName: name || 'Anonymous',
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS_CENTS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setAmount(c);
              setCustom('');
            }}
            className={`rounded-xl border px-2 py-2 text-sm font-semibold ${
              !custom && amount === c
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-white/15 text-white/70 hover:border-white/30'
            }`}
          >
            {(c / 100).toFixed(0)}
          </button>
        ))}
      </div>

      <div>
        <label className="label">Custom amount ({currency.toUpperCase()})</label>
        <input
          className="input"
          type="number"
          min={1}
          step="0.5"
          placeholder="Other amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Your name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Anonymous"
          maxLength={40}
        />
      </div>

      <div>
        <label className="label">Message (optional)</label>
        <textarea
          className="input"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button className="btn-primary w-full" onClick={submit} disabled={loading} type="button">
        {loading ? 'Redirecting…' : `Donate ${(activeCents / 100).toFixed(2)} ${currency.toUpperCase()}`}
      </button>
    </div>
  );
}
