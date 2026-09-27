'use client';

import { useEffect } from 'react';
import { rememberAccount } from '@/lib/auth-handoff';

/** Keeps this device's "Welcome back" list current for whoever is signed in. */
export function RememberAccount({ email, name, avatarUrl }: { email: string; name: string; avatarUrl: string | null }) {
  useEffect(() => {
    rememberAccount({ email, name, avatarUrl });
  }, [email, name, avatarUrl]);
  return null;
}
