'use client';

import { useState } from 'react';

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input className="input" readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn-secondary shrink-0 text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
