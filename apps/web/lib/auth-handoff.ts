'use client';

// Popup → main-tab sign-in hand-off, and "remembered accounts".
//
// Google's sign-in pages send Cross-Origin-Opener-Policy, which permanently
// severs the popup's window.opener. postMessage to the opener therefore
// silently goes nowhere, and the popup used to fall back to opening the app
// inside itself. BroadcastChannel and the localStorage `storage` event are
// same-origin and don't depend on the opener, so they survive that.

export const AUTH_CHANNEL = 'klaups-auth';
const AUTH_STORAGE_KEY = 'klaups:auth-complete';

export type AuthResult = { type: 'klaups-oauth-complete'; ok: boolean; error: string | null; at: number };

export function announceAuthResult(ok: boolean, error: string | null) {
  const message: AuthResult = { type: 'klaups-oauth-complete', ok, error, at: Date.now() };
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Old browsers: the storage event below covers them.
  }
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(message));
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage blocked: the main tab still re-checks its session on focus.
  }
  try {
    // Still worth trying for browsers/flows where the opener survives.
    if (window.opener && window.opener !== window) window.opener.postMessage(message, window.location.origin);
  } catch {
    // Severed opener throws on access in some browsers.
  }
}

/** Calls `onResult` for sign-in results announced by any Klaups popup. */
export function listenForAuthResult(onResult: (result: AuthResult) => void) {
  const handle = (data: unknown) => {
    const message = data as AuthResult | null;
    if (message?.type === 'klaups-oauth-complete') onResult(message);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.onmessage = (event) => handle(event.data);
  } catch {
    channel = null;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY || !event.newValue) return;
    try {
      handle(JSON.parse(event.newValue));
    } catch {
      // ignore malformed
    }
  };
  const onMessage = (event: MessageEvent) => {
    if (event.origin === window.location.origin) handle(event.data);
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('message', onMessage);

  return () => {
    channel?.close();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('message', onMessage);
  };
}

// ---------------------------------------------------------------------------
// Remembered accounts: people who signed in on this device before get a
// one-click "Continue as …". Only display info is kept (never tokens); the
// email is passed to Google as login_hint so it can skip the account picker.
// ---------------------------------------------------------------------------

const RECENT_KEY = 'klaups:recent-accounts';
const MAX_RECENT = 5;

export type RecentAccount = { email: string; name: string; avatarUrl: string | null; lastUsed: number };

export function readRecentAccounts(): RecentAccount[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as RecentAccount[];
    return Array.isArray(list)
      ? list.filter((a) => a && typeof a.email === 'string').sort((a, b) => b.lastUsed - a.lastUsed)
      : [];
  } catch {
    return [];
  }
}

export function rememberAccount(account: Omit<RecentAccount, 'lastUsed'>) {
  if (!account.email) return;
  try {
    const rest = readRecentAccounts().filter((a) => a.email.toLowerCase() !== account.email.toLowerCase());
    const next = [{ ...account, lastUsed: Date.now() }, ...rest].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: nothing to remember, login still works.
  }
}

export function forgetAccount(email: string) {
  try {
    const next = readRecentAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase());
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
