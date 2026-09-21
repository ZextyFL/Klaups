export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html,
        body {
          margin: 0 !important;
          background: transparent !important;
          background-color: transparent !important;
          overflow: hidden !important;
        }

        body > div {
          background: transparent !important;
        }
      `}</style>
      <div style={{ background: 'transparent' }} className="min-h-screen">
        {children}
      </div>
    </>
  );
}
