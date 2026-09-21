import Link from 'next/link';

const FEATURES = [
  ['gift', 'Gift Reactor', 'Give every TikTok gift its own sound, volume and transparent on-stream alert.'],
  ['bell', 'Donation Alerts', 'Tiered alerts with MP3s, GIFs, TTS, presets and a real browser-source tester.'],
  ['heart', 'Creator Donations', 'A fast support page with suggested amounts and secure Stripe checkout.'],
  ['mic', 'Live Chat TTS', 'Read TikTok LIVE chat out loud with language and voice controls.'],
  ['music', 'Soundboard', 'Upload sounds, use built-in reactions and trigger them into your stream source.'],
  ['target', 'Live Goals', 'Donation goals that update in real time and drop into OBS as a browser source.'],
  ['grid', 'Stream Widgets', 'Chat, viewers, gift alerts, donation alerts and goals without scene plugins.'],
  ['bank', 'Creator Payouts', 'See balance and payout history and complete account verification through Stripe.'],
];

const ICON: Record<string, React.ReactNode> = {
  gift: <><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" /><path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-3 0h6" /></>,
  music: <><path d="M9 18V6l12-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
  bank: <><path d="M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" /></>,
};

function FeatureIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {ICON[name]}
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/65 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="text-xl font-semibold tracking-[-0.04em]">
            Kl<span className="text-brand-500">aups</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/45 md:flex">
            <a href="#product" className="transition hover:text-white">Product</a>
            <a href="#workflow" className="transition hover:text-white">How it works</a>
            <a href="#creators" className="transition hover:text-white">For creators</a>
          </nav>
          <Link href="/login" className="btn-primary px-5 py-2 text-sm">Open Klaups</Link>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(236,72,153,.22),transparent_65%)]" />
        <div className="pointer-events-none absolute left-[15%] top-56 -z-10 h-52 w-52 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.8)]" />
              Built for TikTok LIVE creators
            </div>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-7xl lg:text-[88px]">
              Make your LIVE
              <span className="block bg-gradient-to-r from-brand-300 via-white to-cyan-200 bg-clip-text text-transparent">
                impossible to ignore.
              </span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-8 text-white/45 sm:text-xl">
              Gift reactions, donations, alerts, TTS, goals, widgets, soundboard and payouts — one creator control center instead of six different tools.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn-accent px-7 py-3.5 text-base">Start with Google →</Link>
              <a href="#product" className="btn-secondary px-7 py-3.5 text-base">Explore the platform</a>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl rounded-[34px] border border-white/[0.09] bg-white/[0.04] p-3 shadow-[0_50px_120px_-40px_rgba(236,72,153,.28)] backdrop-blur-2xl">
            <div className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#070709]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 text-xs text-white/25">klaups.com/dashboard</span>
              </div>
              <div className="grid min-h-[420px] md:grid-cols-[180px_1fr]">
                <aside className="hidden border-r border-white/[0.06] p-4 md:block">
                  <p className="text-sm font-semibold">Kl<span className="text-brand-500">aups</span></p>
                  <div className="mt-7 space-y-2 text-xs text-white/[0.38]">
                    {['Overview','Donations','Donation Alerts','TikTok Gifts','Soundboard','Widgets','Goals','Payouts'].map((item, i) => (
                      <div key={item} className={`rounded-lg px-3 py-2 ${i === 3 ? 'bg-white/[0.08] text-white' : ''}`}>{item}</div>
                    ))}
                  </div>
                </aside>
                <div className="p-5 sm:p-7">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-white/35">TikTok Gifts</p><p className="mt-1 text-xl font-semibold">Gift Reactor</p></div>
                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-300">● LIVE</span>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      ['🌹','Rose','Cash.mp3','70%'],
                      ['🎁','TikTok Gift','Hype','85%'],
                      ['✨','Universe','Airhorn.mp3','100%'],
                    ].map(([emoji, gift, sound, volume]) => (
                      <div key={gift} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                        <div className="text-3xl">{emoji}</div>
                        <p className="mt-3 text-sm font-semibold">{gift}</p>
                        <p className="mt-1 text-xs text-white/35">{sound}</p>
                        <div className="mt-4 h-1.5 rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-brand-400" style={{ width: volume }} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/[0.07] bg-gradient-to-r from-brand-500/10 to-cyan-500/5 p-4">
                    <div className="flex items-center justify-between text-xs text-white/45"><span>Realtime event</span><span>just now</span></div>
                    <p className="mt-2 font-medium">Mia sent Universe ×1 ✨</p>
                    <p className="mt-1 text-xs text-cyan-200">Custom sound fired on stream</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="max-w-2xl">
          <p className="eyebrow">One streamer stack</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Everything reacts together.</h2>
          <p className="mt-4 text-lg leading-8 text-white/45">
            Your viewers send a gift, tip, chat message or song request. Klaups turns it into something the stream can see or hear instantly.
          </p>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([icon, title, body]) => (
            <div key={title} className="group rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.045]">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-brand-300 transition group-hover:bg-brand-500/15">
                <FeatureIcon name={icon} />
              </div>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/[0.42]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">Setup that makes sense</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Google in. TikTok connected. Go LIVE.</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/45">
              No password to remember. Sign in with Google, verify the TikTok creator account you actually own, add your browser sources once, then run the stream from Klaups.
            </p>
            <Link href="/login" className="btn-primary mt-7">Create your creator setup</Link>
          </div>
          <div className="grid gap-3">
            {[
              ['01','Sign in with Google','One secure Klaups identity.'],
              ['02','Verify TikTok','TikTok Login Kit binds the creator account to you.'],
              ['03','Add browser sources','Transparent alerts, gifts, TTS, goals and soundboard audio.'],
              ['04','Make the LIVE react','Every gift and donation becomes part of the show.'],
            ].map(([n,title,body]) => (
              <div key={n} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-xs font-semibold text-brand-300">{n}</span>
                <div><p className="font-medium">{title}</p><p className="mt-1 text-sm text-white/[0.38]">{body}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="creators" className="relative px-5 py-28 text-center sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_55%_60%_at_50%_100%,rgba(6,182,212,.12),transparent)]" />
        <p className="eyebrow">Build the show</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
          Your community already reacts. Give them something to react with.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/[0.42]">Turn gifts and support into moments people remember, clip and come back for.</p>
        <Link href="/login" className="btn-accent mt-9 px-8 py-3.5 text-base">Open Klaups →</Link>
      </section>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-semibold text-white/60">Kl<span className="text-brand-500">aups</span></p>
          <p>© {new Date().getFullYear()} Klaups. Built for creators who want their LIVE to move.</p>
        </div>
      </footer>
    </main>
  );
}
