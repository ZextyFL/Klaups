import Link from 'next/link';

const FEATURES = [
  {
    title: 'TikTok Live TTS',
    body: 'Chat is read aloud on stream in real time, straight from an OBS browser source.',
  },
  {
    title: 'Spotify song requests',
    body: 'Viewers queue tracks on your Spotify with a chat command — no alt-tabbing.',
  },
  {
    title: 'Your own donation link',
    body: 'A branded klaups.com/donate/you page powered by Stripe Checkout.',
  },
  {
    title: 'Daily goals on stream',
    body: 'A goal bar that climbs live with every donation, resettable every day.',
  },
  {
    title: 'Sound + image alerts',
    body: 'Every donation pops an on-screen alert with your own sound and image.',
  },
  {
    title: 'Payouts every 4 days',
    body: 'We handle Stripe payouts to your bank automatically, on a 4-day cycle.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ink-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xl font-bold tracking-tight">
          Kl<span className="text-brand-500">aups</span>
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start streaming
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
          Everything your TikTok live needs, <span className="text-brand-500">in one link.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
          TTS chat, Spotify requests, donation links, daily goals, alerts, and payouts —
          built for streamers, not agencies.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/signup" className="btn-primary text-base">
            Create your creator page
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-white/60">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/40">
        © {new Date().getFullYear()} Klaups
      </footer>
    </main>
  );
}
