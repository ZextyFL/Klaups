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
  title: 'Klaups — live tools for streamers',
  description:
    'TikTok Live TTS, Spotify song requests, donation links, daily goals and alerts for streamers.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'Klaups — live tools for streamers',
    description:
      'TikTok Live TTS, Spotify song requests, donation links, daily goals and alerts for streamers.',
    url: 'https://klaups.com',
    siteName: 'Klaups',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Klaups — live tools for streamers',
    description:
      'TikTok Live TTS, Spotify song requests, donation links, daily goals and alerts for streamers.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-black font-sans text-white antialiased">{children}</body>
    </html>
  );
}
