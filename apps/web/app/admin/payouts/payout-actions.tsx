'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PayoutActions({
  id,
  status,
  reference,
}: {
  id: string;
  status: 'requested' | 'processing';
  reference: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'processing' | 'paid' | 'rejected') {
    const extra: Record<string, string> = {};
    if (action === 'paid') {
      const ref = window.prompt('Bank transfer reference (optional):', reference);
      if (ref === null) return;
      extra.bankReference = ref;
    }
    if (action === 'rejected') {
      const reason = window.prompt('Reason shown to the creator (e.g. "IBAN name mismatch"):');
      if (!reason) return;
      extra.reason = reason;
    }

    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/payouts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(body?.error || 'Failed');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      {status === 'requested' && (
        <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => act('processing')}>
          Mark sending
        </button>
      )}
      <button type="button" className="btn-accent text-xs" disabled={busy} onClick={() => act('paid')}>
        Mark paid
      </button>
      <button type="button" className="btn-ghost text-xs text-red-300" disabled={busy} onClick={() => act('rejected')}>
        Reject
      </button>
      {error && <p className="w-full text-xs text-red-300 lg:text-right">{error}</p>}
    </div>
  );
}
