'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSoundUrl } from '@/lib/play-sound';

export type GiftRow = {
  giftId: string;
  giftName: string;
  imageUrl: string | null;
  diamondCount: number | null;
  timesReceived: number;
  lastSeenAt: string;
  alertId: string | null;
  enabled: boolean;
  soundUrl: string | null;
  volume: number;
  displaySeconds: number;
  showVisual: boolean;
  showSender: boolean;
  showGiftImage: boolean;
  messageTemplate: string;
};

const BUILTIN_SOUNDS = [
  { value: '', label: 'No sound' },
  { value: 'builtin:chime', label: 'Klaups Chime' },
  { value: 'builtin:cash', label: 'Cash' },
  { value: 'builtin:hype', label: 'Hype' },
  { value: 'builtin:airhorn', label: 'Airhorn' },
  { value: 'builtin:applause', label: 'Applause' },
];

const ALLOWED_AUDIO = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg']);
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked
          ? 'border-brand-400/40 bg-brand-500'
          : 'border-white/10 bg-white/[0.08]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-[3px]'
        }`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

export function TikTokGiftManager({
  profileId,
  gifts,
  initialSettings,
}: {
  profileId: string;
  gifts: GiftRow[];
  initialSettings: {
    alertsEnabled: boolean;
    defaultVolume: number;
    defaultDisplaySeconds: number;
    showGiftVisuals: boolean;
  };
}) {
  const supabase = createClient();
  const router = useRouter();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [uploadGift, setUploadGift] = useState<GiftRow | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(initialSettings.alertsEnabled);
  const [showGiftVisuals, setShowGiftVisuals] = useState(initialSettings.showGiftVisuals);
  const [volumeDrafts, setVolumeDrafts] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gifts;
    return gifts.filter((gift) => gift.giftName.toLowerCase().includes(q));
  }, [gifts, search]);

  async function saveGlobal(patch: Record<string, unknown>) {
    setError(null);
    const { error: updateError } = await supabase.from('tiktok_gift_settings').upsert(
      {
        profile_id: profileId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  async function saveGift(gift: GiftRow, patch: Partial<GiftRow>) {
    setBusy(gift.giftId);
    setError(null);

    const row = {
      profile_id: profileId,
      gift_id: gift.giftId,
      gift_name: gift.giftName,
      enabled: patch.enabled ?? gift.enabled,
      sound_url: patch.soundUrl !== undefined ? patch.soundUrl : gift.soundUrl,
      volume: patch.volume ?? gift.volume,
      display_seconds: patch.displaySeconds ?? gift.displaySeconds,
      show_visual: patch.showVisual ?? gift.showVisual,
      show_sender: patch.showSender ?? gift.showSender,
      show_gift_image: patch.showGiftImage ?? gift.showGiftImage,
      message_template: patch.messageTemplate ?? gift.messageTemplate,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('tiktok_gift_alerts')
      .upsert(row, { onConflict: 'profile_id,gift_id' });

    setBusy(null);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  async function upload(file: File) {
    const gift = uploadGift;
    if (!gift) return;

    if (!ALLOWED_AUDIO.has(file.type)) {
      setError('Use an MP3, WAV or OGG audio file.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError('Gift sounds can be up to 15 MB.');
      return;
    }

    setBusy(gift.giftId);
    setError(null);
    try {
      const extension =
        file.type.includes('ogg') ? 'ogg' : file.type.includes('wav') ? 'wav' : 'mp3';
      const path = `${profileId}/${gift.giftId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('gift-sounds')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('gift-sounds').getPublicUrl(path);
      await saveGift(gift, { soundUrl: data.publicUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audio upload failed.');
      setBusy(null);
    } finally {
      setUploadGift(null);
      if (uploadInput.current) uploadInput.current.value = '';
    }
  }

  async function testGift(gift: GiftRow) {
    setTesting(gift.giftId);
    setError(null);
    try {
      const response = await fetch('/api/test/tiktok-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: gift.giftId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not test gift alert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not test gift alert.');
    } finally {
      window.setTimeout(() => setTesting(null), 450);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card rounded-3xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Control center</p>
            <h2 className="mt-1 text-lg font-semibold">Gift alerts</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/60">
              <Switch
                checked={alertsEnabled}
                label="Gift alerts enabled"
                onChange={(next) => {
                  setAlertsEnabled(next);
                  void saveGlobal({ alerts_enabled: next });
                }}
              />
              Sounds enabled
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/60">
              <Switch
                checked={showGiftVisuals}
                label="Gift visuals enabled"
                onChange={(next) => {
                  setShowGiftVisuals(next);
                  void saveGlobal({ show_gift_visuals: next });
                }}
              />
              Visuals
            </label>
            <div className="relative min-w-[230px] flex-1 lg:flex-none">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                className="input pl-9"
                placeholder="Search gifts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>

      <input
        ref={uploadInput}
        type="file"
        accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />

      {filtered.map((gift) => {
        const soundChoice = gift.soundUrl?.startsWith('builtin:') ? gift.soundUrl : gift.soundUrl ? 'custom' : '';
        const displayVolume = volumeDrafts[gift.giftId] ?? gift.volume;

        return (
          <div key={gift.giftId} className="card rounded-3xl p-0 overflow-hidden">
            <div className="grid gap-4 border-b border-white/[0.06] px-5 py-4 lg:grid-cols-[minmax(220px,1fr)_180px_150px_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035]">
                  {gift.imageUrl ? (
                    <img src={gift.imageUrl} alt="" className="h-11 w-11 object-contain" />
                  ) : (
                    <span className="text-xl">🎁</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{gift.giftName}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-white/35">
                    {gift.diamondCount !== null && <span>◆ {gift.diamondCount} diamonds</span>}
                    <span>{gift.timesReceived.toLocaleString()} received</span>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/55">
                <Switch
                  checked={gift.enabled}
                  label={`${gift.giftName} enabled`}
                  onChange={(enabled) => void saveGift(gift, { enabled })}
                />
                Enabled
              </label>

              <button
                type="button"
                onClick={() => testGift(gift)}
                disabled={testing === gift.giftId}
                className="btn-secondary text-sm"
              >
                {testing === gift.giftId ? 'Testing…' : 'Test gift'}
              </button>

              <button
                type="button"
                onClick={() => playSoundUrl(gift.soundUrl, gift.volume / 100)}
                disabled={!gift.soundUrl}
                className="btn-ghost justify-self-start text-sm disabled:cursor-not-allowed disabled:opacity-30 lg:justify-self-end"
              >
                ▶ Preview
              </button>
            </div>

            <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="label">Gift sound</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-10"
                    value={soundChoice}
                    disabled={busy === gift.giftId}
                    onChange={(e) => {
                      if (e.target.value === 'custom') return;
                      void saveGift(gift, { soundUrl: e.target.value || null });
                    }}
                  >
                    {BUILTIN_SOUNDS.map((sound) => (
                      <option key={sound.value} value={sound.value}>{sound.label}</option>
                    ))}
                    {gift.soundUrl && !gift.soundUrl.startsWith('builtin:') && (
                      <option value="custom">Custom upload</option>
                    )}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/35">⌄</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/60 hover:text-white"
                    onClick={() => {
                      setUploadGift(gift);
                      uploadInput.current?.click();
                    }}
                  >
                    Upload MP3
                  </button>
                  {gift.soundUrl && (
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                      onClick={() => void saveGift(gift, { soundUrl: null })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Volume</label>
                  <span className="text-xs font-medium text-white/45">{displayVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={displayVolume}
                  className="mt-2 w-full accent-pink-500"
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setVolumeDrafts((current) => ({ ...current, [gift.giftId]: value }));
                  }}
                  onPointerUp={(e) => {
                    const value = Number((e.target as HTMLInputElement).value);
                    void saveGift(gift, { volume: value });
                  }}
                  onKeyUp={(e) => {
                    const value = Number((e.target as HTMLInputElement).value);
                    void saveGift(gift, { volume: value });
                  }}
                />
              </div>

              <div>
                <label className="label">Alert duration</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-10"
                    value={String(gift.displaySeconds)}
                    onChange={(e) => void saveGift(gift, { displaySeconds: Number(e.target.value) })}
                  >
                    {[3, 4, 5, 6, 8, 10, 15].map((seconds) => (
                      <option key={seconds} value={seconds}>{seconds} seconds</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/35">⌄</span>
                </div>
              </div>

              <div>
                <label className="label">On stream</label>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/55">
                    Show visual
                    <Switch checked={gift.showVisual} label="Show visual" onChange={(showVisual) => void saveGift(gift, { showVisual })} />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/55">
                    Show sender
                    <Switch checked={gift.showSender} label="Show sender" onChange={(showSender) => void saveGift(gift, { showSender })} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-2xl">🎁</div>
          <p className="mt-4 font-semibold">{gifts.length ? 'No gifts match your search' : 'No gifts discovered yet'}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
            When somebody sends a completed TikTok LIVE gift, Klaups learns it automatically and it appears here ready to customize.
          </p>
        </div>
      )}
    </div>
  );
}
