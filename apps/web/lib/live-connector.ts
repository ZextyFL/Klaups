'use client';

import { CLOSE, parseFrame, type LiveEvent } from '@/lib/live-events';

// Runs a creator's TikTok LIVE connection from inside an overlay page (the OBS
// / TikTok LIVE Studio browser source), so Klaups needs no always-on server:
// the page that is open for the whole stream holds the socket.
//
// Behaviour mirrors the server worker: three outcomes kept apart (live /
// confirmed offline / couldn't connect), slow polling while offline, fast
// retries on blips, and a silence watchdog.

export type ConnectorState = 'idle' | 'connecting' | 'live' | 'offline' | 'error' | 'worker' | 'unconfigured';

type TokenResponse =
  | { mode: 'browser'; wsUrl: string; username: string; session: string; songRequestCommand: string | null }
  | { mode: 'idle' | 'worker' | 'unconfigured' | 'invalid' }
  | { mode: 'error'; message?: string };

type Broadcast = { event: string; payload: Record<string, unknown> };

const GIFT_COMBO_MS = 1_500;
const LIKE_FLUSH_MS = 2_000;
const VIEWER_BROADCAST_MS = 5_000;
const STATUS_REPORT_MS = 20_000;
const WATCHDOG_MS = 90_000;
const FAST_RETRY_MS = [1_000, 2_000, 3_000, 5_000, 10_000, 20_000, 40_000, 60_000];

export class LiveConnector {
  private ws: WebSocket | null = null;
  private stopped = true;
  private retryTimer: number | undefined;
  private watchdog: number | undefined;
  private failures = 0;
  private offlineWaits = 0;
  private session: string | null = null;
  private songCommand: string | null = null;
  private combos = new Map<string, { timer: number; event: Extract<LiveEvent, { kind: 'gift' }> }>();
  private finishedCombos = new Map<string, number>();
  private pendingLikes = 0;
  private likeTimer: number | undefined;
  private lastViewerBroadcast = 0;
  private lastStatusReport = 0;
  private viewers = 0;

  constructor(
    private readonly overlayToken: string,
    private readonly broadcast: (event: string, payload: Record<string, unknown>) => void,
    private readonly onState: (state: ConnectorState, detail?: string) => void
  ) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.connect();
  }

  /** Leadership lost or page closing. Leaves DB status to whoever takes over. */
  stop() {
    this.stopped = true;
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.watchdog);
    window.clearTimeout(this.likeTimer);
    for (const combo of this.combos.values()) window.clearTimeout(combo.timer);
    this.combos.clear();
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(CLOSE.NORMAL);
  }

  /** Best-effort "we're gone" for page unload while holding the connection. */
  reportClosed() {
    if (!this.session) return;
    const body = JSON.stringify({
      session: this.session,
      events: [{ kind: 'status', status: 'connecting', message: 'Klaups overlay closed — reopen it in OBS / LIVE Studio' }],
    });
    navigator.sendBeacon?.('/api/live/ingest', new Blob([body], { type: 'application/json' }));
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => void this.connect(), ms);
  }

  private async connect() {
    if (this.stopped) return;
    this.onState('connecting');

    let token: TokenResponse;
    try {
      const res = await fetch(`/api/live/token?token=${encodeURIComponent(this.overlayToken)}`, { cache: 'no-store' });
      token = (await res.json()) as TokenResponse;
    } catch {
      this.onState('error', 'Could not reach Klaups');
      return this.schedule(FAST_RETRY_MS[Math.min(this.failures++, FAST_RETRY_MS.length - 1)]);
    }
    if (this.stopped) return;

    switch (token.mode) {
      case 'idle':
        this.onState('idle');
        return this.schedule(15_000); // waiting for "Connect TikTok LIVE"
      case 'worker':
        this.onState('worker');
        return this.schedule(60_000);
      case 'unconfigured':
        this.onState('unconfigured');
        return this.schedule(5 * 60_000);
      case 'invalid':
        this.onState('error', 'Overlay link is invalid — copy it again from the dashboard');
        return this.schedule(5 * 60_000);
      case 'error':
        this.onState('error', token.message);
        return this.schedule(FAST_RETRY_MS[Math.min(this.failures++, FAST_RETRY_MS.length - 1)]);
    }

    this.session = token.session;
    this.songCommand = token.songRequestCommand?.toLowerCase() ?? null;
    this.open(token.wsUrl, token.username);
  }

  private open(url: string, username: string) {
    const ws = new WebSocket(url);
    this.ws = ws;
    let opened = false;

    ws.onmessage = (message) => {
      if (this.ws !== ws || typeof message.data !== 'string') return;
      this.armWatchdog(ws);
      for (const event of parseFrame(message.data)) this.handle(event);
    };

    ws.onopen = () => {
      opened = true;
      this.armWatchdog(ws);
    };

    ws.onclose = (close) => {
      if (this.ws !== ws) return;
      this.ws = null;
      window.clearTimeout(this.watchdog);
      if (this.stopped) return;

      switch (close.code) {
        case CLOSE.NOT_LIVE:
        case CLOSE.STREAM_END: {
          this.failures = 0;
          const wait = Math.min(30_000 * 2 ** this.offlineWaits++, 5 * 60_000);
          const message = `@${username} isn't live right now — Klaups will connect as soon as you go live.`;
          this.onState('offline', message);
          this.report({ kind: 'status', status: 'offline', message }, true);
          return this.schedule(wait);
        }
        case CLOSE.MAX_LIFETIME_EXCEEDED:
          return this.schedule(250); // Euler's 8h cap: reconnect straight away
        case CLOSE.TOO_MANY_CONNECTIONS:
          this.onState('error', 'Too many connections — retrying in a minute');
          return this.schedule(60_000);
        case CLOSE.INVALID_AUTH:
        case CLOSE.NO_PERMISSION:
        case CLOSE.INVALID_OPTIONS:
          this.onState('error', `Connection refused (${close.code})`);
          this.report({ kind: 'status', status: 'error', message: `TikTok LIVE connection refused (${close.code})` }, true);
          return this.schedule(60_000);
        default: {
          this.offlineWaits = 0;
          const wait = FAST_RETRY_MS[Math.min(this.failures++, FAST_RETRY_MS.length - 1)];
          this.onState('connecting', opened ? 'Reconnecting…' : 'Joining your LIVE…');
          return this.schedule(wait);
        }
      }
    };
  }

  private armWatchdog(ws: WebSocket) {
    window.clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => {
      // Silent for too long: the socket is dead without having said so.
      if (this.ws === ws) ws.close(4000);
    }, WATCHDOG_MS);
  }

  private handle(event: LiveEvent) {
    switch (event.kind) {
      case 'connected':
        this.failures = 0;
        this.offlineWaits = 0;
        this.onState('live');
        this.report({ kind: 'status', status: 'live', message: null, viewers: this.viewers }, true);
        return;

      case 'chat': {
        this.broadcast('chat_message', { username: event.user.name, message: event.message, type: 'chat' });
        const command = this.songCommand;
        if (command && event.message.toLowerCase().startsWith(command)) {
          const query = event.message.slice(command.length).trim();
          if (query) void this.ingest([{ kind: 'song_request', username: event.user.name, query }]);
        }
        return;
      }

      case 'gift':
        return this.gift(event);

      case 'like':
        this.pendingLikes += event.count;
        if (this.likeTimer === undefined) {
          this.likeTimer = window.setTimeout(() => {
            this.likeTimer = undefined;
            const count = this.pendingLikes;
            this.pendingLikes = 0;
            if (count > 0) this.broadcast('social', { kind: 'like', username: 'Viewers', uniqueId: null, count });
          }, LIKE_FLUSH_MS);
        }
        return;

      case 'join':
        this.broadcast('social', { kind: 'join', username: event.user.name, uniqueId: event.user.uniqueId, count: 1 });
        return;

      case 'follow':
      case 'share':
        this.broadcast('social', { kind: event.kind, username: event.user.name, uniqueId: event.user.uniqueId, count: 1 });
        void this.ingest([{ kind: event.kind, senderName: event.user.name, senderUniqueId: event.user.uniqueId }]);
        return;

      case 'viewers': {
        this.viewers = event.count;
        const now = Date.now();
        if (now - this.lastViewerBroadcast >= VIEWER_BROADCAST_MS) {
          this.lastViewerBroadcast = now;
          this.broadcast('viewer_count', { count: event.count });
        }
        this.report({ kind: 'status', status: 'live', message: null, viewers: event.count });
        return;
      }

      case 'stream_end':
        // Euler follows up with a STREAM_END close; that path handles it.
        return;
    }
  }

  /**
   * Gift streaks tick once per tap with a growing repeatCount. Fire one alert
   * per streak: immediately on repeatEnd, otherwise once ticks stop for
   * GIFT_COMBO_MS (TikTok doesn't always send the end flag).
   */
  private gift(event: Extract<LiveEvent, { kind: 'gift' }>) {
    const key = `${event.giftId}:${event.user.uniqueId ?? event.user.name}:${event.groupId ?? ''}`;

    const finishedAt = this.finishedCombos.get(key);
    if (finishedAt && Date.now() - finishedAt < 5_000) return; // straggler tick after the end
    const existing = this.combos.get(key);
    if (existing) window.clearTimeout(existing.timer);

    const fire = () => {
      this.combos.delete(key);
      this.finishedCombos.set(key, Date.now());
      if (this.finishedCombos.size > 200) this.finishedCombos.clear();
      void this.ingest([
        {
          kind: 'gift',
          giftId: event.giftId,
          giftName: event.giftName,
          imageUrl: event.imageUrl,
          diamondCount: event.diamondCount,
          repeatCount: event.repeatCount,
          senderName: event.user.name,
          senderUniqueId: event.user.uniqueId,
        },
      ]);
    };

    if (event.repeatEnd) return fire();
    this.combos.set(key, { timer: window.setTimeout(fire, GIFT_COMBO_MS), event });
  }

  private report(event: Record<string, unknown>, force = false) {
    const now = Date.now();
    if (!force && now - this.lastStatusReport < STATUS_REPORT_MS) return;
    this.lastStatusReport = now;
    void this.ingest([event]);
  }

  private async ingest(events: Record<string, unknown>[]) {
    if (!this.session) return;
    try {
      const res = await fetch('/api/live/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: this.session, events }),
        keepalive: true,
      });
      if (!res.ok) return;
      const { broadcasts } = (await res.json()) as { broadcasts?: Broadcast[] };
      for (const b of broadcasts ?? []) this.broadcast(b.event, b.payload);
    } catch {
      // A missed status ping or alert is not worth breaking the stream over.
    }
  }
}
