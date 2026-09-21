export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-white/50">{description}</p>}
      </div>
      {action}
    </div>
  );
}
