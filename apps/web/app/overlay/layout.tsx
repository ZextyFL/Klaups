export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'transparent' }} className="min-h-screen">
      {children}
    </div>
  );
}
