FROM node:20-alpine3.21 AS builder

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ai-skills/package.json ./packages/ai-skills/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

COPY apps/web/ ./apps/web/
COPY packages/ai-skills/ ./packages/ai-skills/
COPY packages/config/ ./packages/config/
COPY packages/types/ ./packages/types/

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_AUTH_DISABLED=false
ENV VITE_DEV_AUTH_BYPASS=false

RUN pnpm --filter @music-os-360/types build \
 && pnpm --filter @music-os-360/web build

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/ >/dev/null || exit 1
