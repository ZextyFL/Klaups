'use client';

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-white/45">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full border backdrop-blur-xl transition-colors duration-300 ${
          checked
            ? 'border-brand-400/40 bg-gradient-to-b from-brand-400 to-brand-600'
            : 'border-white/[0.14] bg-white/[0.08]'
        } ${disabled ? 'opacity-50' : ''}`}
        style={{
          boxShadow: checked
            ? 'inset 0 1px 1px 0 rgba(255,255,255,0.35), inset 0 -6px 10px -4px rgba(0,0,0,0.25)'
            : 'inset 0 1px 2px 0 rgba(0,0,0,0.35)',
        }}
      >
        <span
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-gradient-to-b from-white to-white/90 transition-transform duration-300 ${
            checked ? 'translate-x-[23px]' : 'translate-x-[3px]'
          }`}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.6) inset' }}
        />
      </button>
    </label>
  );
}
