// Retry cadence for the TikTok LIVE supervisor.
//
// Two different rhythms, because "we failed to connect" and "the creator is
// not streaming" are not the same problem:
//
//   - A technical failure gets a short fast burst (feels instant when it's a
//     blip) then an exponential backoff capped at a minute.
//   - A confirmed-offline channel is polled far more slowly. Hammering TikTok
//     every few seconds for a creator who isn't broadcasting is pure waste.
//
// Neither gives up while the creator still wants Klaups listening.

const FAST_BURST_DELAYS_MS = [1_000, 2_000, 3_000, 5_000];
const STEADY_BACKOFF_BASE_MS = 10_000;
const STEADY_BACKOFF_FACTOR = 2;
const STEADY_BACKOFF_CAP_MS = 60_000;

const WAITING_LIVE_BASE_MS = 30_000;
const WAITING_LIVE_FACTOR = 2;
const WAITING_LIVE_CAP_MS = 5 * 60 * 1_000;

/** @param consecutiveFailures 1-based (first failure = 1) */
export function nextRetryDelayMs(consecutiveFailures: number) {
  const burstIndex = consecutiveFailures - 1;
  if (burstIndex < FAST_BURST_DELAYS_MS.length) return FAST_BURST_DELAYS_MS[burstIndex];
  const steadyIndex = burstIndex - FAST_BURST_DELAYS_MS.length;
  return Math.min(STEADY_BACKOFF_BASE_MS * STEADY_BACKOFF_FACTOR ** steadyIndex, STEADY_BACKOFF_CAP_MS);
}

/** @param consecutiveWaits 0-based (first wait = 0) */
export function nextWaitingLiveDelayMs(consecutiveWaits: number) {
  return Math.min(WAITING_LIVE_BASE_MS * WAITING_LIVE_FACTOR ** consecutiveWaits, WAITING_LIVE_CAP_MS);
}

/**
 * How long a connection may emit nothing at all before we treat it as dead.
 *
 * TikTok pushes a viewer-count update periodically even in a silent room, so
 * total silence for this long means the socket died without telling us — the
 * failure mode a `disconnected` listener alone never catches.
 */
export const WATCHDOG_TIMEOUT_MS = 90_000;

/** Why a connect() attempt failed. Only ever produced from a rejection. */
export type FailureOutcome =
  /** TikTok told us the creator is not broadcasting. */
  | { kind: 'not_live'; message: string }
  /** We could not determine anything — never report this as "offline". */
  | { kind: 'unknown'; message: string };

/**
 * Classify a failed connect().
 *
 * Deliberately generous in what counts as "not live", because the wording has
 * moved between releases of the upstream client: it has variously been
 * "LIVE has ended", "isn't online" and "user_not_found". Anything we don't
 * recognise stays `unknown` so the creator is never wrongly told their stream
 * is offline when the truth is that our check failed.
 */
export function classifyAttempt(err: unknown): FailureOutcome {
  const message =
    err instanceof Error
      ? err.message || String(err)
      : typeof err === 'string'
        ? err
        : ((err as { message?: string } | null)?.message ?? 'unknown error');

  const code = (err as { code?: string } | null)?.code;
  if (code === 'NOT_LIVE') return { kind: 'not_live', message };

  if (/isn'?t\s+online|is\s+not\s+online|not\s+live|LIVE\s+has\s+ended|offline|user_not_found/i.test(message)) {
    return { kind: 'not_live', message };
  }

  return { kind: 'unknown', message };
}
