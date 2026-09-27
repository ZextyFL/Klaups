'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSoundUrl, type StopSound } from '@/lib/play-sound';
import { AUDIO_ACCEPT, prepareAudioUpload } from '@/lib/audio-upload';
import { giftNameKey } from '@/lib/gift-catalog';
import type { GiftRow } from './gift-rows';

export type { GiftRow };

const BUILTIN_SOUNDS = [
  { value: '', label: 'No sound' },
  { value: 'builtin:chime', label: 'Klaups Chime' },
  { value: 'builtin:cash', label: 'Cash' },
  { value: 'builtin:hype', label: 'Hype' },
  { value: 'builtin:airhorn', label: 'Airhorn' },
  { value: 'builtin:applause', label: 'Applause' },
];

type Filter = 'all' | 'configured' | 'live' | 'events';

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked ? 'border-brand-400/40 bg-brand-500' : 'border-white/10 bg-white/[0.08]'
      }`}
    >
      <span
        className={`absolute top-0.5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-[3px]'}`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

function soundLabel(url: string | null) {
  if (!url) return 'No sound';
  return BUILTIN_SOUNDS.find((s) => s.value === url)?.label ?? 'Custom sound';
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
  const previewStop = useRef<StopSound | undefined>(undefined);
  const [uploadGift, setUploadGift] = useState<GiftRow | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(initialSettings.alertsEnabled);
  const [showGiftVisuals, setShowGiftVisuals] = useState(initialSettings.showGiftVisuals);
  const [drafts, setDrafts] = useState<Record<string, { volume?: number; displaySeconds?: number }>>({});
  const [customName, setCustomName] = useState('');

  const counts = useMemo(
    () => ({
      all: gifts.length,
      configured: gifts.filter((g) => g.configured).length,
      live: gifts.filter((g) => g.seenLive).length,
      events: gifts.filter((g) => g.kind === 'event').length,
    }),
    [gifts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gifts.filter((gift) => {
      if (filter === 'configured' && !gift.configured) return false;
      if (filter === 'live' && !gift.seenLive) return false;
      if (filter === 'events' && gift.kind !== 'event') return false;
      return !q || gift.giftName.toLowerCase().includes(q);
    });
  }, [gifts, search, filter]);

  async function saveGlobal(patch: Record<string, unknown>) {
    setError(null);
    const { error: updateError } = await supabase
      .from('tiktok_gift_settings')
      .upsert({ profile_id: profileId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  async function saveGift(gift: GiftRow, patch: Partial<GiftRow>) {
    setBusy(gift.rowKey);
    setError(null);

    const row = {
      profile_id: profileId,
      gift_id: gift.giftId,
      gift_name: gift.giftName,
      enabled: patch.enabled ?? gift.enabled,
      sound_url: patch.soundUrl !== undefined ? patch.soundUrl : gift.soundUrl,
      volume: patch.volume ?? gift.volume,
      display_seconds: patch.displaySeconds ?? gift.displaySeconds,
      wait_for_sound: patch.waitForSound ?? gift.waitForSound,
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

  async function resetGift(gift: GiftRow) {
    setBusy(gift.rowKey);
    const { error: deleteError } = await supabase
      .from('tiktok_gift_alerts')
      .delete()
      .eq('profile_id', profileId)
      .eq('gift_id', gift.giftId);
    setBusy(null);
    if (deleteError) setError(deleteError.message);
    else router.refresh();
  }

  async function upload(file: File) {
    const gift = uploadGift;
    if (!gift) return;
    const prepared = prepareAudioUpload(file);
    if (!prepared.ok) {
      setError(prepared.error);
      setUploadGift(null);
      if (uploadInput.current) uploadInput.current.value = '';
      return;
    }

    setBusy(gift.rowKey);
    setError(null);
    try {
      // Storage paths can't contain ':' reliably across tools; slug the key.
      const folder = gift.giftId.replace(/[^a-zA-Z0-9_-]+/g, '-');
      const path = `${profileId}/${folder}/${crypto.randomUUID()}.${prepared.extension}`;
      const { error: uploadError } = await supabase.storage
        .from('gift-sounds')
        .upload(path, file, { contentType: prepared.contentType, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('gift-sounds').getPublicUrl(path);
      await saveGift(gift, { soundUrl: data.publicUrl });
    } catch (e) {
      setError(e instanceof Error ? `Upload failed: ${e.message}` : 'Audio upload failed.');
      setBusy(null);
    } finally {
      setUploadGift(null);
      if (uploadInput.current) uploadInput.current.value = '';
    }
  }

  function preview(gift: GiftRow) {
    previewStop.current?.();
    previewStop.current = playSoundUrl(gift.soundUrl, (drafts[gift.rowKey]?.volume ?? gift.volume) / 100);
  }

  async function testGift(gift: GiftRow) {
    setTesting(gift.rowKey);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/test/tiktok-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: gift.giftId, giftName: gift.giftName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not test gift alert.');
      setNotice(`Sent a test ${gift.giftName} to your stream overlay.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not test gift alert.');
    } finally {
      window.setTimeout(() => setTesting(null), 450);
    }
  }

  function addCustom() {
    const name = customName.trim().slice(0, 60);
    if (!name) return;
    const key = giftNameKey(name);
    const existing = gifts.find((g) => g.rowKey === key);
    if (existing) {
      setOpen(existing.rowKey);
      setFilter('all');
      setSearch(existing.giftName);
      setCustomName('');
      return;
    }
    setCustomName('');
    void saveGift(
      {
        rowKey: key, giftId: key, giftName: name, kind: 'gift', icon: '🎁', imageUrl: null,
        diamondCount: null, timesReceived: 0, seenLive: false, configured: false, enabled: true,
        soundUrl: 'builtin:chime', volume: initialSettings.defaultVolume,
        displaySeconds: initialSettings.defaultDisplaySeconds, waitForSound: false,
        showVisual: initialSettings.showGiftVisuals, showSender: true, showGiftImage: true,
        messageTemplate: '{name} sent {gift} x{count}!',
      },
      {}
    ).then(() => setOpen(key));
  }

  const FILTERS: [Filter, string][] = [
    ['all', 'All'],
    ['configured', 'Configured'],
    ['live', 'Received live'],
    ['events', 'Follows & shares'],
  ];

  return (
    <div className="space-y-4">
      <div className="card rounded-3xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Control center</p>
            <h2 className="mt-1 text-lg font-semibold">Gift & event alerts</h2>
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
              Alerts on
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
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === value ? 'bg-white text-black' : 'bg-white/[0.05] text-white/55 hover:text-white'
                }`}
              >
                {label} <span className="opacity-50">{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <input className="input" placeholder="Search gifts…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {notice && !error && (
          <p className="mt-4 rounded-xl bg-green-500/10 px-3 py-2 text-sm text-green-300">{notice}</p>
        )}
      </div>

      <input
        ref={uploadInput}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />

      <div className="card overflow-hidden rounded-3xl p-0">
        <div className="divide-y divide-white/[0.06]">
          {filtered.map((gift) => {
            const isOpen = open === gift.rowKey;
            const volume = drafts[gift.rowKey]?.volume ?? gift.volume;
            const seconds = drafts[gift.rowKey]?.displaySeconds ?? gift.displaySeconds;
            const soundChoice = gift.soundUrl?.startsWith('builtin:') ? gift.soundUrl : gift.soundUrl ? 'custom' : '';

            return (
              <div key={gift.rowKey} className={isOpen ? 'bg-white/[0.02]' : ''}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(isOpen ? null : gift.rowKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpen(isOpen ? null : gift.rowKey);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] sm:px-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-xl">
                    {gift.imageUrl ? <img src={gift.imageUrl} alt="" className="h-9 w-9 object-contain" /> : gift.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {gift.giftName}
                      {gift.seenLive && (
                        <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200">
                          {gift.timesReceived.toLocaleString()}× live
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/35">
                      {gift.diamondCount !== null && <>◆ {gift.diamondCount.toLocaleString()} · </>}
                      {gift.configured ? (
                        <>
                          {soundLabel(gift.soundUrl)} · {gift.waitForSound ? `≥${gift.displaySeconds}s, until sound ends` : `${gift.displaySeconds}s`}
                        </>
                      ) : (
                        'Not set up — click to add a sound'
                      )}
                    </p>
                  </div>
                  {gift.configured && (
                    <Switch checked={gift.enabled} label={`${gift.giftName} enabled`} onChange={(enabled) => void saveGift(gift, { enabled })} />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void testGift(gift);
                    }}
                    disabled={testing === gift.rowKey}
                    className="btn-secondary hidden text-xs sm:inline-flex"
                  >
                    {testing === gift.rowKey ? 'Sending…' : 'Test'}
                  </button>
                  <span className={`text-white/35 transition ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                </div>

                {isOpen && (
                  <div className="grid gap-5 border-t border-white/[0.06] px-4 py-5 sm:px-5 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="label">Sound</label>
                      <select
                        className="input"
                        value={soundChoice}
                        disabled={busy === gift.rowKey}
                        onChange={(e) => {
                          if (e.target.value === 'custom') return;
                          void saveGift(gift, { soundUrl: e.target.value || null });
                        }}
                      >
                        {BUILTIN_SOUNDS.map((sound) => (
                          <option key={sound.value} value={sound.value}>{sound.label}</option>
                        ))}
                        {soundChoice === 'custom' && <option value="custom">Custom upload</option>}
                      </select>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/70 hover:text-white"
                          disabled={busy === gift.rowKey}
                          onClick={() => {
                            setUploadGift(gift);
                            uploadInput.current?.click();
                          }}
                        >
                          {busy === gift.rowKey && uploadGift ? 'Uploading…' : '⬆ Upload sound'}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.05] hover:text-white disabled:opacity-30"
                          disabled={!gift.soundUrl}
                          onClick={() => preview(gift)}
                        >
                          ▶ Preview
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-white/30">MP3, WAV, OGG, M4A, AAC · 15 MB</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label">Volume</label>
                        <span className="text-xs text-white/45">{volume}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={volume}
                        className="mt-2 w-full accent-pink-500"
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [gift.rowKey]: { ...d[gift.rowKey], volume: Number(e.target.value) } }))
                        }
                        onPointerUp={(e) => void saveGift(gift, { volume: Number((e.target as HTMLInputElement).value) })}
                        onKeyUp={(e) => void saveGift(gift, { volume: Number((e.target as HTMLInputElement).value) })}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label">Time on screen</label>
                        <span className="text-xs text-white/45">{seconds}s</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={60}
                        step={1}
                        value={seconds}
                        className="mt-2 w-full accent-pink-500"
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [gift.rowKey]: { ...d[gift.rowKey], displaySeconds: Number(e.target.value) } }))
                        }
                        onPointerUp={(e) => void saveGift(gift, { displaySeconds: Number((e.target as HTMLInputElement).value) })}
                        onKeyUp={(e) => void saveGift(gift, { displaySeconds: Number((e.target as HTMLInputElement).value) })}
                      />
                      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/60">
                        <span>
                          Stay until sound ends
                          <span className="block text-[11px] text-white/30">Never cuts a long sound off (max 60s)</span>
                        </span>
                        <Switch checked={gift.waitForSound} label="Stay until sound ends" onChange={(waitForSound) => void saveGift(gift, { waitForSound })} />
                      </label>
                    </div>

                    <div>
                      <label className="label">On stream</label>
                      <div className="space-y-2">
                        {(
                          [
                            ['showVisual', 'Show alert'],
                            ['showSender', 'Show sender name'],
                            ['showGiftImage', 'Show gift image'],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/55">
                            {label}
                            <Switch checked={gift[field]} label={label} onChange={(value) => void saveGift(gift, { [field]: value })} />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2 xl:col-span-4">
                      <label className="label">On-screen message</label>
                      <input
                        key={`${gift.rowKey}-${gift.messageTemplate}`}
                        className="input"
                        defaultValue={gift.messageTemplate}
                        onBlur={(e) => {
                          const next = e.target.value.trim() || '{name} sent {gift} x{count}!';
                          if (next !== gift.messageTemplate) void saveGift(gift, { messageTemplate: next });
                        }}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-white/30">Variables: {'{name}'} · {'{gift}'} · {'{count}'}</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void testGift(gift)} className="btn-secondary text-xs sm:hidden">
                            Test
                          </button>
                          {gift.configured && (
                            <button
                              type="button"
                              onClick={() => void resetGift(gift)}
                              className="rounded-lg px-3 py-1.5 text-xs text-red-300/80 hover:bg-red-500/10 hover:text-red-300"
                            >
                              Reset to default
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-white/40">No gifts match — add it by name below.</p>
          )}
        </div>
      </div>

      <div className="card flex flex-col gap-3 rounded-3xl sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Gift not in the list?</label>
          <input
            className="input"
            placeholder="Type the exact gift name, e.g. Sunglasses"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustom();
            }}
          />
        </div>
        <button type="button" className="btn-accent" onClick={addCustom} disabled={!customName.trim()}>
          Add gift
        </button>
      </div>
    </div>
  );
}
