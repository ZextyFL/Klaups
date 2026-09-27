'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatIban, validateHolderName, validateIban } from '@/lib/iban';
import type { PayoutAccount } from '@/lib/get-current-creator';

// Survives the round trip when the creator clicks the emailed link instead
// of typing the code. Holds name + IBAN only for the minutes that takes.
const PENDING_KEY = 'klaups:payout-account-pending';

type Step = 'view' | 'edit' | 'code';

async function saveAccount(accountHolderName: string, iban: string) {
  const response = await fetch('/api/payouts/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountHolderName, iban }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Could not save your bank details.');
}

export function PayoutAccountCard({ email, account }: { email: string; account: PayoutAccount | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>(account ? 'view' : 'edit');
  const [holder, setHolder] = useState(account?.account_holder_name ?? '');
  const [iban, setIban] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ibanCheck = iban ? validateIban(iban) : null;
  const holderCheck = holder ? validateHolderName(holder) : null;

  // Returning from the emailed link: the session now carries a fresh OTP, so
  // finish the save that was waiting on it.
  useEffect(() => {
    if (params.get('email_verified') !== '1') return;
    let pending: { holder: string; iban: string } | null = null;
    try {
      pending = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? 'null');
    } catch {
      pending = null;
    }
    if (!pending) return;
    setBusy(true);
    saveAccount(pending.holder, pending.iban)
      .then(() => {
        window.localStorage.removeItem(PENDING_KEY);
        setNotice('Email confirmed — your bank details are saved.');
        setStep('view');
        router.replace('/dashboard/payouts');
        router.refresh();
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not save your bank details.'))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    setError(null);
    setNotice(null);
    const h = validateHolderName(holder);
    if (!h.ok) return setError(h.error);
    const i = validateIban(iban);
    if (!i.ok) return setError(i.error);

    setBusy(true);
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify({ holder: h.name, iban: i.iban }));
    } catch {
      // Code entry still works without storage; only the link path needs it.
    }
    const { error: otpError } = await createClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/dashboard/payouts?email_verified=1')}`,
      },
    });
    setBusy(false);
    if (otpError) {
      setError(
        /rate|seconds/i.test(otpError.message)
          ? 'A code was sent very recently — wait a minute and try again.'
          : otpError.message
      );
      return;
    }
    setStep('code');
    setNotice(`We emailed a code to ${email}. Enter it below, or click the link in that email.`);
  }

  async function confirmCode() {
    setError(null);
    const token = code.replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(token)) return setError('Enter the code from the email.');

    setBusy(true);
    try {
      const { error: verifyError } = await createClient().auth.verifyOtp({ email, token, type: 'email' });
      if (verifyError) throw new Error('That code is wrong or expired. Send a new one.');

      const h = validateHolderName(holder);
      const i = validateIban(iban);
      if (!h.ok || !i.ok) throw new Error('Check your name and IBAN.');
      await saveAccount(h.name, i.iban);

      try {
        window.localStorage.removeItem(PENDING_KEY);
      } catch {
        // ignore
      }
      setCode('');
      setIban('');
      setNotice('Email confirmed — your bank details are saved.');
      setStep('view');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Bank account</p>
          <h2 className="mt-1 text-lg font-semibold">Where we send your money</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            account ? 'bg-green-500/10 text-green-300' : 'bg-amber-500/10 text-amber-300'
          }`}
        >
          {account ? '✓ Email verified' : 'Required for payouts'}
        </span>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {notice && !error && (
        <p className="mt-4 rounded-xl bg-green-500/10 px-3 py-2 text-sm text-green-300">{notice}</p>
      )}

      {step === 'view' && account && (
        <div className="mt-5">
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-lg">🏦</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{account.account_holder_name}</p>
              <p className="font-mono text-sm text-white/45">
                {account.iban_country}•• •••• •••• {account.iban_last4}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/35">
            Verified via {account.verified_email} on {new Date(account.verified_at).toLocaleDateString()}.
          </p>
          <button type="button" className="btn-secondary mt-4 text-sm" onClick={() => setStep('edit')}>
            Change bank account
          </button>
        </div>
      )}

      {step === 'edit' && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="label">Account holder name</label>
            <input
              className="input"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="Name exactly as on your bank account"
              autoComplete="name"
            />
            {holderCheck && !holderCheck.ok && <p className="mt-1.5 text-xs text-red-300">{holderCheck.error}</p>}
          </div>
          <div>
            <label className="label">IBAN</label>
            <input
              className="input font-mono tracking-wide"
              value={iban}
              onChange={(e) => setIban(formatIban(e.target.value).slice(0, 42))}
              placeholder="NL91 ABNA 0417 1643 00"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
            {ibanCheck && !ibanCheck.ok && iban.replace(/\s/g, '').length >= 15 && (
              <p className="mt-1.5 text-xs text-red-300">{ibanCheck.error}</p>
            )}
            {ibanCheck?.ok && <p className="mt-1.5 text-xs text-green-300">✓ Valid {ibanCheck.country} IBAN</p>}
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs leading-5 text-white/45">
            To protect your money we confirm it&apos;s you with a code sent to{' '}
            <span className="text-white/75">{email}</span> — every time bank details are added or changed.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-accent"
              onClick={sendCode}
              disabled={busy || !ibanCheck?.ok || !holderCheck?.ok}
            >
              {busy ? 'Sending…' : 'Send verification code'}
            </button>
            {account && (
              <button type="button" className="btn-ghost text-sm" onClick={() => setStep('view')}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="label">Code from your email</label>
            <input
              className="input text-center font-mono text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmCode();
              }}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-accent" onClick={confirmCode} disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Confirm & save'}
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={sendCode} disabled={busy}>
              Resend code
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setStep('edit')} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
