import type { Config } from "tailwindcss";

/**
 * Color de token que SÍ admite modificador de opacidad.
 *
 * Con `primary: "var(--primary)"` a secas, Tailwind v3 genera
 * `rgb(var(--primary) / 0.1)` para `bg-primary/10`. Como la variable guarda un
 * `oklch(...)` completo y no tres canales sueltos, esa declaración es inválida y
 * el navegador la tira entera: el elemento queda **transparente**, sin error ni
 * aviso. Medido en los tres paneles, eran 558 clases (`bg-primary/10`,
 * `border-destructive/40`, `bg-chart-2/10`, `hover:bg-sidebar-accent/60`…)
 * pintando nada mientras el código se leía correcto.
 *
 * `color-mix` resuelve la mezcla en el espacio del propio token, así que la
 * paleta sigue en oklch y el branding por tenant sigue funcionando.
 */
const token = (variable: string) => {
  const resolver = ({ opacityValue }: { opacityValue?: string }) => {
    // Sin modificador, o con uno que Tailwind difiere a una variable en runtime
    // (`bg-opacity-*`), se devuelve el color tal cual: color-mix no puede
    // resolver un porcentaje que todavía no existe.
    if (opacityValue === undefined || opacityValue.startsWith("var(")) {
      return `var(${variable})`;
    }
    return `color-mix(in oklab, var(${variable}) ${Number(opacityValue) * 100}%, transparent)`;
  };
  // Tailwind acepta esta forma de función en tiempo de ejecución, pero sus tipos
  // sólo declaran cadenas anidadas. El cast es para `tsc`, no para Tailwind.
  return resolver as unknown as string;
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: token("--border"),
        input: token("--input"),
        ring: token("--ring"),
        background: token("--background"),
        foreground: token("--foreground"),
        primary: {
          DEFAULT: token("--primary"),
          foreground: token("--primary-foreground"),
        },
        secondary: {
          DEFAULT: token("--secondary"),
          foreground: token("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("--destructive"),
          foreground: token("--destructive-foreground"),
        },
        muted: {
          DEFAULT: token("--muted"),
          foreground: token("--muted-foreground"),
        },
        accent: {
          DEFAULT: token("--accent"),
          foreground: token("--accent-foreground"),
        },
        popover: {
          DEFAULT: token("--popover"),
          foreground: token("--popover-foreground"),
        },
        card: {
          DEFAULT: token("--card"),
          foreground: token("--card-foreground"),
        },
        // Sin estos, `bg-sidebar` y `text-chart-2` no existían como clases
        // aunque las variables sí estuvieran definidas en globals.css — y el
        // primitivo de shadcn ya las usaba.
        chart: {
          "1": token("--chart-1"),
          "2": token("--chart-2"),
          "3": token("--chart-3"),
          "4": token("--chart-4"),
          "5": token("--chart-5"),
        },
        sidebar: {
          DEFAULT: token("--sidebar"),
          foreground: token("--sidebar-foreground"),
          primary: token("--sidebar-primary"),
          "primary-foreground": token("--sidebar-primary-foreground"),
          accent: token("--sidebar-accent"),
          "accent-foreground": token("--sidebar-accent-foreground"),
          border: token("--sidebar-border"),
          ring: token("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
