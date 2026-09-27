import { createAdminClient } from '@/lib/supabase/admin';

// Two missed 30s beats plus slack.
const STALE_AFTER_MS = 90_000;

export type WorkerHealth = { online: boolean; lastBeatAt: string | null };

/** Is any LIVE worker alive right now? Server-only (service role). */
export async function getWorkerHealth(): Promise<WorkerHealth> {
  const { data } = await createAdminClient()
    .from('worker_heartbeats')
    .select('last_beat_at')
    .order('last_beat_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastBeatAt = data?.last_beat_at ?? null;
  const online = Boolean(lastBeatAt && Date.now() - new Date(lastBeatAt).getTime() < STALE_AFTER_MS);
  return { online, lastBeatAt };
}
