'use client';

import { useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';

export function ViewerCount({ overlayToken, initial }: { overlayToken: string; initial: number }) {
  const [count, setCount] = useState(initial);

  useOverlayChannel(overlayToken, ['viewer_count'], (event, payload) => {
    if (event === 'viewer_count') setCount((payload as { count: number }).count);
  });

  return (
    <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-white">
      <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
      <span className="text-xl font-semibold tabular-nums">{count.toLocaleString()}</span>
      <span className="text-white/60">watching</span>
    </div>
  );
}
