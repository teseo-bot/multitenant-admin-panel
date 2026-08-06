import { Logotipo } from "@/components/brand/logotipo";

/**
 * Marco de autenticación del plano de control.
 *
 * Es la primera pantalla que se ve, y hasta ahora era una tarjeta anónima: no
 * decía de quién era el producto ni en cuál de los tres paneles estabas. El
 * logotipo lo dice; la línea de abajo, cuál es.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <Logotipo size={24} />
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Plano de control
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
