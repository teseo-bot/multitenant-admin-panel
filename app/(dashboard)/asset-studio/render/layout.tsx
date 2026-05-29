export default function RenderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Override para aislar esta ruta del Layout principal que contiene sidebars/headers
  return (
    <div className="min-h-screen bg-transparent">
      {children}
    </div>
  );
}
