import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://klaups.com'),
  title: 'Klaups — TikTok LIVE creator control center',
  description:
    'TikTok LIVE gift sounds, transparent alerts, donations, TTS, goals, widgets, soundboard and creator payouts in one dashboard.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'Klaups — TikTok LIVE creator control center',
    description:
      'TikTok LIVE gift sounds, transparent alerts, donations, TTS, goals, widgets and payouts in one dashboard.',
    url: 'https://klaups.com',
    siteName: 'Klaups',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Klaups — TikTok LIVE creator control center',
    description:
      'Gift sounds, transparent alerts, donations, TTS, goals and widgets for TikTok LIVE creators.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-black font-sans text-white antialiased">{children}</body>
    </html>
  );
}
