FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY start-standalone.js ./
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* requieren ARG porque Next.js los incrusta en el bundle estático en build time.
# SUPABASE_SERVICE_ROLE_KEY es server-only y NUNCA debe bakearse en una capa de imagen.
# Se inyecta exclusivamente en runtime desde GCP Secret Manager via Cloud Run.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Recuperamos las variables públicas para el entorno de runtime (OBLIGATORIO en output standalone)

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN npm install dotenv


COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# .env.production NO se copia al runner: los secretos llegan vía GCP Secret Manager en runtime.
COPY --from=builder --chown=nextjs:nodejs /app/start-standalone.js ./
CMD ["node", "start-standalone.js"]
