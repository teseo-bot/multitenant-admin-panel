/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Lint reactivado como gate del build: la deuda de rules-of-hooks (useMemo condicional en
  // assist-review-modal.tsx) y los prefer-const quedaron resueltos. Solo restan warnings.
  eslint: {
    ignoreDuringBuilds: false
  },
  experimental: {
    serverComponentsExternalPackages: ["playwright-core"]
  }
};

export default nextConfig;
