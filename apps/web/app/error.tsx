'use client';

import { useEffect } from 'react';

// Root error boundary. Without this, an uncaught error in a Server
// Component/Action (e.g. missing env vars) can render as a blank/unchanged
// page in production instead of a visible message.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold">Something went wrong.</p>
        <p className="max-w-md text-sm text-white/50">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
