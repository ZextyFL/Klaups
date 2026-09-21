import { getCurrentCreator } from '@/lib/get-current-creator';
import { formatCents } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/PageHeader';

type ActivityItem =
  | {
      id: string;
      type: 'donation';
      at: string;
      title: string;
      subtitle: string | null;
      amount: string;
    }
  | {
      id: string;
      type: 'gift';
      at: string;
      title: string;
      subtitle: string | null;
      amount: string | null;
    };

export default async function ActivityPage() {
  const { supabase, user, settings } = await getCurrentCreator();

  const [{ data: donations }, { data: gifts }] = await Promise.all([
    supabase
      .from('donations')
      .select('*')
      .eq('profile_id', user.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('tiktok_gift_events')
      .select('*')
      .eq('profile_id', user.id)
      .order('received_at', { ascending: false })
      .limit(40),
  ]);

  const activity: ActivityItem[] = [
    ...(donations ?? []).map((donation) => ({
      id: `donation-${donation.id}`,
      type: 'donation' as const,
      at: donation.created_at,
      title: `${donation.donor_name} donated`,
      subtitle: donation.message,
      amount: formatCents(donation.amount_cents, donation.currency || settings.currency),
    })),
    ...(gifts ?? []).map((gift) => ({
      id: `gift-${gift.id}`,
      type: 'gift' as const,
      at: gift.received_at,
      title: `${gift.sender_name || 'Viewer'} sent ${gift.gift_name} ×${gift.repeat_count}`,
      subtitle: gift.sender_unique_id ? `@${gift.sender_unique_id}` : null,
      amount:
        gift.diamond_count !== null
          ? `◆ ${(gift.diamond_count * gift.repeat_count).toLocaleString()}`
          : null,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 60);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Activity"
        description="One feed for the moments that matter — donations and TikTok gifts, newest first."
      />

      <div className="card overflow-hidden rounded-3xl p-0">
        <div className="grid grid-cols-[1fr_auto] border-b border-white/[0.06] px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-white/30">
          <span>Event</span>
          <span>Value</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02]">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  item.type === 'donation'
                    ? 'bg-brand-500/10 text-brand-300'
                    : 'bg-cyan-500/10 text-cyan-200'
                }`}
              >
                {item.type === 'donation' ? '♥' : '🎁'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-white/35">
                  <span>{new Date(item.at).toLocaleString()}</span>
                  {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                </div>
              </div>
              {item.amount && <span className="shrink-0 text-sm font-semibold text-white/75">{item.amount}</span>}
            </div>
          ))}
          {activity.length === 0 && (
            <div className="px-5 py-16 text-center">
              <p className="font-medium">Your activity feed is waiting</p>
              <p className="mt-2 text-sm text-white/40">Test an alert or go LIVE to see events appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
