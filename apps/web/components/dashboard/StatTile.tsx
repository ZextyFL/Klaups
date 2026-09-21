import Link from 'next/link';

export function StatTile({
  label,
  value,
  hint,
  href,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={`card h-full rounded-2xl p-5 transition-colors ${
        href ? 'hover:border-white/20 hover:bg-ink-800' : ''
      }`}
    >
      <p className="text-[13px] font-medium text-white/50">{label}</p>
      <p className={`mt-2 text-[28px] font-semibold tracking-tight tabular-nums ${accent ? 'text-brand-400' : ''}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
