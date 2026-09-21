'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icons, type IconName } from './icons';

type NavItem = { href: string; label: string; icon: IconName; badge?: string };
type NavGroup = { title: string; items: NavItem[] };

function groups(verified: boolean): NavGroup[] {
  return [
    {
      title: '',
      items: [
        { href: '/dashboard', label: 'Overview', icon: 'home' },
        { href: '/dashboard/activity', label: 'Live Activity', icon: 'activity' },
      ],
    },
    {
      title: 'Money',
      items: [
        { href: '/dashboard/donations', label: 'Donations', icon: 'heart' },
        { href: '/dashboard/payouts', label: 'Payouts', icon: 'bank' },
        {
          href: '/dashboard/verify',
          label: 'Verify account',
          icon: 'shield',
          badge: verified ? 'Verified' : 'Required',
        },
      ],
    },
    {
      title: 'Streaming',
      items: [
        { href: '/dashboard/alerts', label: 'Donation Alerts', icon: 'bell' },
        { href: '/dashboard/tiktok-gifts', label: 'TikTok Gifts', icon: 'gift' },
        { href: '/dashboard/soundboard', label: 'Soundboard', icon: 'music' },
        { href: '/dashboard/widgets', label: 'Widgets', icon: 'grid' },
        { href: '/dashboard/goals', label: 'Goals', icon: 'target' },
        { href: '/dashboard/integrations', label: 'Connections & TTS', icon: 'link' },
      ],
    },
    {
      title: 'Your page',
      items: [
        { href: '/dashboard/donation-link', label: 'Donation page', icon: 'link' },
        { href: '/dashboard/profile', label: 'My page', icon: 'user' },
        { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ];
}

export function Sidebar({
  username,
  displayName,
  avatarUrl,
  live,
  viewerCount,
  verified,
  signOutAction,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  live: boolean;
  viewerCount: number;
  verified: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navGroups = groups(verified);

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.title || 'root'}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = Icons[item.icon];
              const active =
                item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] backdrop-blur-xl transition-colors ${
                      active
                        ? 'bg-white/[0.12] font-medium text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]'
                        : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${active ? 'text-brand-400' : ''}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          verified
                            ? 'bg-green-500/10 text-green-300'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-3 px-4 py-4">
      <div
        className="h-9 w-9 shrink-0 rounded-full bg-ink-700 bg-cover bg-center ring-2 ring-black"
        style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName || username}</p>
        <p className="truncate text-xs text-white/40">@{username}</p>
      </div>
    </div>
  );

  const liveChip = live ? (
    <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-green-400/25 bg-green-500/[0.08] px-3 py-2 text-xs text-green-300 backdrop-blur-xl">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
      </span>
      LIVE · {viewerCount.toLocaleString()} watching
    </div>
  ) : (
    <div className="mx-4 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/40">
      Offline
    </div>
  );

  const footer = (
    <form action={signOutAction} className="border-t border-white/[0.06] p-3">
      <button
        type="submit"
        className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        Log out
      </button>
    </form>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-black/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="text-[17px] font-semibold tracking-tight">
          Kl<span className="text-brand-500">aups</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-white/70 hover:bg-white/5"
          aria-label="Toggle menu"
        >
          {open ? <Icons.close /> : <Icons.menu />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col border-r border-white/[0.08] bg-black/90 pt-14 shadow-2xl backdrop-blur-2xl">
            {identity}
            {liveChip}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/[0.08] bg-black/45 backdrop-blur-2xl lg:flex">
        <div className="px-6 pb-2 pt-6">
          <Link href="/" className="text-[19px] font-semibold tracking-tight">
            Kl<span className="text-brand-500">aups</span>
          </Link>
        </div>
        {identity}
        {liveChip}
        {nav}
        {footer}
      </aside>
    </>
  );
}
