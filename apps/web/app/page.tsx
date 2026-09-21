import Link from 'next/link';

const FEATURES = [
  {
    title: 'TikTok Live TTS',
    body: 'Every chat message read aloud on stream, straight from an OBS browser source. No login required — just your username.',
    span: 'lg:col-span-2',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 18.75a6 6 0 0 0 6-6v-1.5M12 18.75a6 6 0 0 1-6-6v-1.5m6 7.5v3m-3.75 0h7.5M12 15.75a3.75 3.75 0 0 1-3.75-3.75V6a3.75 3.75 0 1 1 7.5 0v6a3.75 3.75 0 0 1-3.75 3.75Z"
      />
    ),
  },
  {
    title: 'Spotify song requests',
    body: 'Viewers queue tracks with a chat command. Plays right on your own Spotify.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 18V6l12-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    ),
  },
  {
    title: 'Your donation link',
    body: 'A clean, branded page powered by Stripe Checkout.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 6v12m-4-9.5c0-1.38 1.79-2.5 4-2.5s4 1.12 4 2.5-1.79 2.5-4 2.5-4 1.12-4 2.5 1.79 2.5 4 2.5 4-1.12 4-2.5"
      />
    ),
  },
  {
    title: 'Live daily goals',
    body: 'A progress bar that climbs with every donation in real time, resets every day.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M3 3v16a2 2 0 0 0 2 2h16M7 16l4-6 3 4 5-8"
      />
    ),
  },
  {
    title: 'Sound + image alerts',
    body: 'Every donation pops an on-screen alert with your own sound and image or GIF.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M15 8a3 3 0 0 1 0 6M17.5 5.5a7 7 0 0 1 0 10.9M5 9v3a1 1 0 0 0 1 1h2.3l4.2 3.5a.5.5 0 0 0 .8-.4V5.9a.5.5 0 0 0-.8-.4L8.3 8H6a1 1 0 0 0-1 1Z"
      />
    ),
  },
  {
    title: 'Payouts every 4 days',
    body: 'We collect donations, hold your balance, and pay you out to your bank automatically via Stripe — on a fixed 4-day cycle. No chasing invoices.',
    span: 'lg:col-span-2',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M2.25 8.25h19.5M6 12.75h2.25M2.25 6a2 2 0 0 1 2-2h15.5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4.25a2 2 0 0 1-2-2Z"
      />
    ),
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Create your page',
    body: 'Sign up, pick your handle, and your donation link, overlays and dashboard exist instantly.',
  },
  {
    n: '02',
    title: 'Drop overlays into OBS',
    body: 'Chat TTS, alerts and the goal bar are just browser-source URLs — no plugins to install.',
  },
  {
    n: '03',
    title: 'Go live and get paid',
    body: 'Donations, gifts and song requests flow in automatically. Payouts land every 4 days.',
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-6 w-6 text-brand-400"
    >
      {children}
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-[19px] font-semibold tracking-tight">
            Kl<span className="text-brand-500">aups</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pb-28 pt-24 text-center sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(236,72,153,0.22),transparent)]"
        />
        <p className="eyebrow animate-fade-up">Built for TikTok LIVE creators</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-balance text-[44px] font-semibold leading-[1.05] tracking-tightest animate-fade-up sm:text-6xl md:text-[76px]">
          Everything your live needs.
          <br />
          <span className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
            One link away.
          </span>
        </h1>
        <p
          className="mx-auto mt-7 max-w-xl text-balance text-lg text-white/50 animate-fade-up sm:text-xl"
          style={{ animationDelay: '80ms' }}
        >
          TTS chat, Spotify requests, donation alerts, live goals, and payouts —
          built for one streamer at a time, not an agency.
        </p>
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
          style={{ animationDelay: '140ms' }}
        >
          <Link href="/signup" className="btn-accent px-7 py-3 text-base">
            Create your page — it&apos;s free
          </Link>
          <a href="#features" className="btn-ghost px-2 py-3 text-base">
            See what&apos;s inside ↓
          </a>
        </div>

        <div
          className="mx-auto mt-20 max-w-3xl animate-fade-up"
          style={{ animationDelay: '220ms' }}
        >
          <div className="card mx-auto flex max-w-md items-center gap-4 rounded-3xl p-5 text-left animate-float">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/15">
              <Icon>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M12 6v12m-4-9.5c0-1.38 1.79-2.5 4-2.5s4 1.12 4 2.5-1.79 2.5-4 2.5-4 1.12-4 2.5 1.79 2.5 4 2.5 4-1.12 4-2.5"
                />
              </Icon>
            </div>
            <div>
              <p className="text-sm text-white/50">New donation</p>
              <p className="font-semibold">
                Mia donated €25.00 <span className="text-white/40">— &quot;let&apos;s go!! 🔥&quot;</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bento grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24 scroll-mt-20">
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow">The whole stack</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Six tools. One dashboard.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`card group relative overflow-hidden rounded-3xl transition-all duration-300 hover:border-white/20 hover:bg-ink-800 ${f.span ?? ''}`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] transition-colors group-hover:bg-brand-500/15">
                <Icon>{f.icon}</Icon>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/50">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/[0.06] bg-ink-950">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-xl text-center">
            <p className="eyebrow">Getting started</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Live in under five minutes.
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="text-sm font-semibold text-brand-400">{s.n}</p>
                <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/50">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden px-6 py-28 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgba(236,72,153,0.18),transparent)]"
        />
        <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Your stream deserves better tools.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-lg text-white/50">
          Set up your page today — it takes less time than your next stream.
        </p>
        <div className="mt-9">
          <Link href="/signup" className="btn-accent px-8 py-3.5 text-base">
            Create your page
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm font-semibold tracking-tight text-white/70">
            Kl<span className="text-brand-500">aups</span>
          </span>
          <p className="text-sm text-white/30">© {new Date().getFullYear()} Klaups. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
