'use client';

import { useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { formatCents } from '@/lib/format';

interface GoalUpdatePayload {
  currentAmountCents: number;
  targetAmountCents: number;
  currency: string;
}

export function GoalBar({
  overlayToken,
  initial,
}: {
  overlayToken: string;
  initial: GoalUpdatePayload;
}) {
  const [goal, setGoal] = useState(initial);

  useOverlayChannel(overlayToken, ['goal_update'], (event, payload) => {
    if (event === 'goal_update') setGoal(payload as GoalUpdatePayload);
  });

  const pct = goal.targetAmountCents
    ? Math.min(100, Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100))
    : 0;

  return (
    <div className="w-[480px] rounded-2xl bg-black/60 p-4 font-sans text-white backdrop-blur">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Daily goal</span>
        <span>
          {formatCents(goal.currentAmountCents, goal.currency)} /{' '}
          {formatCents(goal.targetAmountCents, goal.currency)}
        </span>
      </div>
      <div className="mt-2 h-5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
