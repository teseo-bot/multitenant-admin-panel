import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import { TenantThemeStyle } from "@/components/TenantThemeStyle";
import { Toaster } from "@/components/ui/sonner";

// Fuentes locales: ya estaban en app/fonts/ sin usarse — el layout cargaba Inter
// desde Google. Servirlas nosotros quita una petición a un tercero en cada carga
// y hace que el build no dependa de la red.
const sans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

// El mono no es decorativo: todo dato duro (montos, conteos, horas, IDs) va en
// mono con cifras tabulares para que las columnas de números no bailen.
const mono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Control · micontexto",
    template: "%s · Control micontexto",
  },
  description: "Plano de control de micontexto: tenants, usuarios, consumo y aliados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={cn(sans.variable, mono.variable)}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TenantThemeStyle />
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
