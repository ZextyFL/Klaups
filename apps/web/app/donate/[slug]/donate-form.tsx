'use client';

import { useMemo, useState } from 'react';

const PRESETS_CENTS = [300, 500, 1000, 2500, 5000];

export function DonateForm({ slug, currency }: { slug: string; currency: string }) {
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCents = custom ? Math.round(parseFloat(custom || '0') * 100) : amount;
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  async function submit() {
    if (!Number.isFinite(activeCents) || activeCents < 100) {
      setError(`Minimum support amount is ${formatter.format(1)}.`);
      return;
    }
    if (activeCents > 500000) {
      setError(`For safety, the maximum online support amount is ${formatter.format(5000)}.`);
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
          donorName: name.trim() || 'Anonymous',
          message: message.trim(),
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
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">Choose an amount</label>
          <span className="text-xs text-white/35">{currency.toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PRESETS_CENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setAmount(c);
                setCustom('');
                setError(null);
              }}
              className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                !custom && amount === c
                  ? 'border-brand-400/50 bg-brand-500/15 text-brand-200 shadow-[0_8px_24px_-14px_rgba(236,72,153,0.9)]'
                  : 'border-white/[0.09] bg-white/[0.025] text-white/65 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {formatter.format(c / 100)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Custom amount</label>
        <div className="relative">
          <input
            className="input py-3 pr-16 text-lg font-semibold"
            type="number"
            min={1}
            max={5000}
            step="0.5"
            placeholder="Other amount"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError(null);
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/35">
            {currency.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Your name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anonymous"
            maxLength={40}
            autoComplete="name"
          />
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
          <p className="text-xs text-white/35">Your alert</p>
          <p className="mt-1 truncate text-sm font-medium">
            {name.trim() || 'Anonymous'} supports {formatter.format(activeCents > 0 ? activeCents / 100 : 0)}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label">Message to the streamer</label>
          <span className="text-xs text-white/30">{message.length}/200</span>
        </div>
        <textarea
          className="input min-h-24 resize-none"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          placeholder="Say something they’ll see on stream…"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-400/15 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        className="btn-accent w-full py-3.5 text-base"
        onClick={submit}
        disabled={loading || !activeCents}
        type="button"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Opening secure checkout…
          </>
        ) : (
          <>Support with {formatter.format(activeCents > 0 ? activeCents / 100 : 0)} →</>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-white/30">
        <span>🔒</span>
        <span>Secure checkout powered by Stripe</span>
      </div>
    </div>
  );
}
