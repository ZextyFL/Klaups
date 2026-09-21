'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function PasswordForm() {
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    setError(null);
    setSuccess(false);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setPassword('');
      setConfirm('');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">New password</label>
        <input
          className="input"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input
          className="input"
          type="password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">Password updated.</p>}

      <button className="btn-primary" onClick={save} disabled={saving} type="button">
        {saving ? 'Saving…' : 'Update password'}
      </button>
    </div>
  );
}
