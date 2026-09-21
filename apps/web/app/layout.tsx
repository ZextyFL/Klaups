import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Klaups — live tools for streamers',
  description:
    'TikTok Live TTS, Spotify song requests, donation links, daily goals and alerts for streamers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-white antialiased">{children}</body>
    </html>
  );
}
