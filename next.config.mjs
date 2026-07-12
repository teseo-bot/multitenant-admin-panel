/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // El lint no debe gatear el deploy (cutover G2). ESLint corre aparte en CI.
  // Deuda anotada: react-hooks/rules-of-hooks en app/(partners)/lab/paquetes/[id]/drafts/[...path]/page.tsx
  // (useMemo condicional) — bug real a corregir en WU separada.
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverComponentsExternalPackages: ["playwright-core"]
  }
};

export default nextConfig;
